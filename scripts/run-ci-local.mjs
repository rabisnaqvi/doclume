#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { constants as osConstants } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_WORKFLOW = '.github/workflows/testing.yml';
const TERMINATION_SIGNALS = process.platform === 'win32'
  ? ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'SIGBREAK']
  : ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'];

const PRESETS = {
  install: { command: 'pnpm', args: ['install', '--frozen-lockfile'], deps: [] },
  typecheck: { command: 'pnpm', args: ['typecheck'], deps: ['install'] },
  'core:test': { command: 'pnpm', args: ['test:core'], deps: ['install'] },
  'web:deps': { command: 'pnpm', args: ['exec', 'playwright', 'install-deps'], deps: ['install'] },
  'web:browser': { command: 'pnpm', args: ['exec', 'playwright', 'install', 'chromium'], deps: ['install'] },
  'web:test': { command: 'pnpm', args: ['test:web'], deps: ['install', 'web:deps', 'web:browser'] },
  'vscode:test': {
    command: 'xvfb-run',
    args: ['-a', '--server-args=-screen 0 1920x1080x24', 'pnpm', 'test:vscode'],
    deps: ['install', 'web:deps', 'web:browser'],
  },
};

function usage() {
  const presetLines = Object.entries(PRESETS)
    .map(([name, preset]) => `    - ${name} → ${formatCommand(preset.command, preset.args)}`)
    .join('\n');

  return `Usage:
  node scripts/run-ci-local.mjs --help
  node scripts/run-ci-local.mjs --job <name> [--job <name> ...] [--workflow <path>] [--container-architecture <arch>] [--keep-container] [--fresh] [--concurrency <n>] [--dry-run] [--verbose]
  node scripts/run-ci-local.mjs --step <name> [--step <name> ...] [--concurrency <n>] [--dry-run] [--verbose]

Modes:
  Workflow/job mode runs a GitHub Actions job with act.
    - --job <name> selects workflow jobs (repeatable)
    - --workflow defaults to ${DEFAULT_WORKFLOW}
    - job runs reuse act containers by default; pass --fresh for a clean container
    - --container-architecture passes an architecture through to act
    - --keep-container leaves the container behind for inspection
    - --concurrency <n> runs independent jobs/steps in parallel (default: 1)

  Preset/step mode runs local CI presets in the order provided.
    - --step <name> is repeatable and preserves order
    - at least one --step is required in this mode
    - job batches and step batches remain mutually exclusive

Presets:
${presetLines}

Options:
  --help, -h                 Show this help and exit 0
  --job <name>               Run workflow jobs via act (repeatable)
  --step <name>              Run a local preset step (repeatable)
  --workflow <path>          Workflow file for job mode (default: ${DEFAULT_WORKFLOW})
  --container-architecture   Container architecture to pass to act (default: act's default)
  --keep-container           Keep the container after the run (default: off)
  --fresh                    Run the job in a clean container (default: reuse)
  --concurrency <n>          Run independent jobs/steps in parallel (default: 1)
  --dry-run                  Print the resolved command without running it (default: off)
  --verbose                  Print extra diagnostic information (default: off)
`;
}

class CliError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CliError';
  }
}

function fail(message) {
  console.error(`Error: ${message}\n`);
  console.error(usage());
  throw new CliError(message);
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    fail(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInteger(value, flag) {
  if (!/^[1-9]\d*$/.test(value)) {
    fail(`${flag} requires a positive integer`);
  }

  return Number(value);
}

export function parseArgs(argv) {
  const options = {
    help: false,
    job: null,
    jobs: [],
    steps: [],
    workflow: DEFAULT_WORKFLOW,
    containerArchitecture: null,
    keepContainer: false,
    reuse: true,
    concurrency: 1,
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--keep-container') {
      options.keepContainer = true;
      continue;
    }

    if (arg === '--fresh') {
      options.reuse = false;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--concurrency') {
      options.concurrency = parsePositiveInteger(readValue(argv, i, '--concurrency'), '--concurrency');
      i += 1;
      continue;
    }

    if (arg.startsWith('--concurrency=')) {
      options.concurrency = parsePositiveInteger(arg.slice('--concurrency='.length), '--concurrency');
      continue;
    }

    if (arg === '--job') {
      if (options.steps.length > 0) fail('--job and --step are mutually exclusive');
      options.jobs.push(readValue(argv, i, '--job'));
      options.job ??= options.jobs[0];
      i += 1;
      continue;
    }

    if (arg.startsWith('--job=')) {
      if (options.steps.length > 0) fail('--job and --step are mutually exclusive');
      const value = arg.slice('--job='.length);
      if (!value) fail('--job requires a value');
      options.jobs.push(value);
      options.job ??= options.jobs[0];
      continue;
    }

    if (arg === '--step') {
      if (options.jobs.length > 0) fail('--job and --step are mutually exclusive');
      options.steps.push(readValue(argv, i, '--step'));
      i += 1;
      continue;
    }

    if (arg.startsWith('--step=')) {
      if (options.jobs.length > 0) fail('--job and --step are mutually exclusive');
      const value = arg.slice('--step='.length);
      if (!value) fail('--step requires a value');
      options.steps.push(value);
      continue;
    }

    if (arg === '--workflow') {
      options.workflow = readValue(argv, i, '--workflow');
      i += 1;
      continue;
    }

    if (arg.startsWith('--workflow=')) {
      options.workflow = arg.slice('--workflow='.length);
      if (!options.workflow) fail('--workflow requires a value');
      continue;
    }

    if (arg === '--container-architecture') {
      options.containerArchitecture = readValue(argv, i, '--container-architecture');
      i += 1;
      continue;
    }

    if (arg.startsWith('--container-architecture=')) {
      options.containerArchitecture = arg.slice('--container-architecture='.length);
      if (!options.containerArchitecture) fail('--container-architecture requires a value');
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_\-./:@+=]+$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function formatCommand(command, args) {
  return [command, ...args].map(shellQuote).join(' ');
}

function signalExitCode(signal) {
  const signalNumber = osConstants.signals[signal];
  return typeof signalNumber === 'number' ? 128 + signalNumber : 1;
}

const PROCESS_TREE_FORCE_KILL_DELAY_MS = 250;

function collectProcessTreePids(rootPid) {
  if (process.platform === 'win32') {
    return [rootPid];
  }

  const snapshot = spawnSync('ps', ['-A', '-o', 'pid=', '-o', 'ppid='], { encoding: 'utf8' });
  if (snapshot.error || snapshot.status !== 0 || typeof snapshot.stdout !== 'string') {
    return [rootPid];
  }

  const childrenByParent = new Map();
  for (const line of snapshot.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const [pidText, ppidText] = trimmed.split(/\s+/, 2);
    const pid = Number.parseInt(pidText, 10);
    const ppid = Number.parseInt(ppidText, 10);
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) {
      continue;
    }

    const children = childrenByParent.get(ppid) ?? [];
    children.push(pid);
    childrenByParent.set(ppid, children);
  }

  const ordered = [];
  const visited = new Set();

  const visit = (pid) => {
    if (visited.has(pid)) {
      return;
    }

    visited.add(pid);
    for (const childPid of childrenByParent.get(pid) ?? []) {
      visit(childPid);
    }
    ordered.push(pid);
  };

  visit(rootPid);
  return ordered;
}

function killPids(pids, signal) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal);
    } catch {
      // Ignore failures for processes that already exited.
    }
  }
}

function killProcessTreeViaTaskkill(child) {
  const taskkill = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
    stdio: 'ignore',
    windowsHide: true,
  });

  taskkill.once('error', () => {
    try {
      child.kill('SIGKILL');
    } catch {
      // Ignore fallback failures; the original child may already be gone.
    }
  });
}

function sendSignalToProcessTree(child, signal, treePids) {
  if (process.platform === 'win32') {
    killProcessTreeViaTaskkill(child);
    return;
  }

  killPids(treePids ?? collectProcessTreePids(child.pid), signal);

  try {
    process.kill(-child.pid, signal);
  } catch {
    // Ignore failures for process groups that already exited.
  }
}

function forceKillProcessTree(child, treePids) {
  if (process.platform === 'win32') {
    killProcessTreeViaTaskkill(child);
    return;
  }

  killPids(treePids ?? collectProcessTreePids(child.pid), 'SIGKILL');

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    // Ignore failures for process groups that already exited.
  }
}

function waitForChild(command, args, { env, stdio, captureOutput = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio,
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    let settled = false;
    let forwardedSignal = null;
    let closeResult = null;
    let forceKillIssued = false;
    let forceKillTimer = null;
    let treePids = null;

    const cleanup = () => {
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }

      for (const signal of TERMINATION_SIGNALS) {
        process.off(signal, onSignal);
      }
    };

    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      resolve(result);
    };

    const maybeSettleAfterSignal = () => {
      if (!forwardedSignal || !forceKillIssued || !closeResult) {
        return;
      }

      settle({
        code: closeResult.code,
        signal: forwardedSignal,
        stdout,
        stderr,
        error: null,
      });
    };

    const onSignal = (signal) => {
      if (forwardedSignal) {
        return;
      }

      forwardedSignal = signal;
      treePids = collectProcessTreePids(child.pid);
      sendSignalToProcessTree(child, signal, treePids);

      if (signal === 'SIGKILL') {
        forceKillIssued = true;
        return;
      }

      forceKillTimer = setTimeout(() => {
        forceKillIssued = true;
        forceKillProcessTree(child, treePids);
        maybeSettleAfterSignal();
      }, PROCESS_TREE_FORCE_KILL_DELAY_MS);
    };

    const onError = (error) => {
      settle({ code: null, signal: null, stdout, stderr, error });
    };

    const onClose = (code, signal) => {
      if (!forwardedSignal) {
        settle({
          code: code ?? null,
          signal: signal ?? null,
          stdout,
          stderr,
          error: null,
        });
        return;
      }

      closeResult = { code: code ?? null, signal: signal ?? null };
      maybeSettleAfterSignal();
    };

    for (const signal of TERMINATION_SIGNALS) {
      process.on(signal, onSignal);
    }

    child.once('error', onError);
    child.once('close', onClose);
  });
}

async function resolveDockerHost(verbose) {
  if (process.env.DOCKER_HOST) {
    if (verbose) {
      console.error(`Verbose: using existing DOCKER_HOST=${process.env.DOCKER_HOST}`);
    }

    return process.env.DOCKER_HOST;
  }

  const result = await waitForChild(
    'podman',
    ['machine', 'inspect', '--format', '{{.ConnectionInfo.PodmanSocket.Path}}'],
    { stdio: ['ignore', 'pipe', 'pipe'], captureOutput: true },
  );

  if (result.signal) {
    const error = new Error(`podman machine inspect terminated by ${result.signal}`);
    error.signal = result.signal;
    throw error;
  }

  if (result.code === 0) {
    const socketPath = result.stdout.trim();
    if (socketPath) {
      const resolved = socketPath.startsWith('unix://') ? socketPath : `unix://${socketPath}`;
      if (verbose) {
        console.error(`Verbose: resolved DOCKER_HOST from podman machine inspect -> ${resolved}`);
      }

      return resolved;
    }
  }

  if (verbose) {
    const reason = result.error?.message || result.stderr.trim() || `exit code ${result.code ?? 'unknown'}`;
    console.error(`Verbose: unable to resolve DOCKER_HOST from podman machine inspect (${reason})`);
  }

  return null;
}

export function buildActArgs(options) {
  const args = ['-W', options.workflow, '-j', options.job];

  if (options.reuse) {
    args.push('--reuse');
  }

  if (!options.keepContainer) {
    args.push('--rm');
  }

  if (options.containerArchitecture) {
    args.push('--container-architecture', options.containerArchitecture);
  }

  return args;
}

function getPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    fail(`Unknown preset: ${name}`);
  }

  return { name, command: preset.command, args: [...preset.args], deps: [...preset.deps] };
}

export function buildPresetGraph(stepNames) {
  const requested = new Set();
  const nodesByName = new Map();
  const order = [];

  function visit(name) {
    if (nodesByName.has(name)) {
      return;
    }

    const preset = getPreset(name);
    for (const dep of preset.deps) {
      visit(dep);
    }

    nodesByName.set(name, preset);
    order.push(preset);
  }

  for (const name of stepNames) {
    if (requested.has(name)) {
      fail(`Duplicate preset in batch: ${name}`);
    }

    requested.add(name);
    visit(name);
  }

  return { nodes: order, order, byName: nodesByName };
}

async function runCommand(command, args, env) {
  const result = await waitForChild(command, args, { stdio: 'inherit', env });

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    return signalExitCode(result.signal);
  }

  return result.code ?? 0;
}

async function runAct(args, env) {
  return runCommand('act', args, env);
}

function writePrefixedLines(label, text, writer) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (const line of normalized.split('\n')) {
    if (!line) {
      continue;
    }

    writer(`[${label}] ${line}`);
  }
}

async function runPrefixedCommand(label, command, args, env, verbose = false) {
  const resolvedCommand = formatCommand(command, args);
  if (verbose) {
    console.error(`[${label}] running ${resolvedCommand}`);
  }

  const result = await waitForChild(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
    captureOutput: true,
  });

  if (result.stdout) {
    writePrefixedLines(label, result.stdout, console.log);
  }

  if (result.stderr) {
    writePrefixedLines(label, result.stderr, console.error);
  }

  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    return signalExitCode(result.signal);
  }

  return result.code ?? 0;
}

export async function scheduleNodes(nodes, { concurrency = 1, execute }) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    fail('--concurrency requires a positive integer');
  }

  const states = new Map(nodes.map((node) => [node.name, 'pending']));
  const started = [];
  const succeeded = [];
  const failed = [];
  const skipped = [];
  const running = new Map();
  let stopScheduling = false;
  let exitCode = 0;

  for (const node of nodes) {
    for (const dep of node.deps) {
      if (!states.has(dep)) {
        fail(`Unknown dependency: ${dep}`);
      }
    }
  }

  const canRun = (node) => node.deps.every((dep) => states.get(dep) === 'succeeded');

  const launch = (node) => {
    states.set(node.name, 'running');
    started.push(node.name);

    const promise = Promise.resolve()
      .then(() => execute(node))
      .then(
        (result) => ({ node, code: typeof result === 'number' ? result : Number(result ?? 0), error: null }),
        (error) => ({ node, code: 1, error }),
      );

    running.set(node.name, promise);
  };

  while (true) {
    while (!stopScheduling && running.size < concurrency) {
      const next = nodes.find((node) => states.get(node.name) === 'pending' && canRun(node));
      if (!next) {
        break;
      }

      launch(next);
    }

    if (running.size === 0) {
      break;
    }

    const settled = await Promise.race(running.values());
    running.delete(settled.node.name);
    if (settled.error || settled.code !== 0) {
      states.set(settled.node.name, 'failed');
      failed.push(settled.node.name);
      exitCode ||= settled.code || 1;
      stopScheduling = true;
      continue;
    }

    states.set(settled.node.name, 'succeeded');
    succeeded.push(settled.node.name);
  }

  for (const node of nodes) {
    if (states.get(node.name) === 'pending') {
      states.set(node.name, 'skipped');
      skipped.push(node.name);
    }
  }

  return { started, succeeded, failed, skipped, exitCode };
}

function buildJobNodes(jobNames, baseOptions) {
  const requested = new Set();
  return jobNames.map((jobName) => {
    if (requested.has(jobName)) {
      fail(`Duplicate job in batch: ${jobName}`);
    }

    requested.add(jobName);
    return {
      name: jobName,
      command: 'act',
      args: buildActArgs({ ...baseOptions, job: jobName }),
      deps: [],
    };
  });
}

function printJobBatchDryRun(jobNodes, concurrency) {
  console.log('Resolved job batch:');
  console.log(`  concurrency: ${concurrency}`);
  for (const [index, jobNode] of jobNodes.entries()) {
    console.log(`  ${index + 1}. ${jobNode.name}: ${formatCommand(jobNode.command, jobNode.args)}`);
  }
}

async function runPresetSteps(stepNames, { concurrency, dryRun, verbose, env }) {
  const graph = buildPresetGraph(stepNames);
  const resolved = graph.order;
  const commandList = resolved.map((step) => formatCommand(step.command, step.args));

  if (dryRun) {
    console.log('Resolved preset commands:');
    console.log(`  concurrency: ${concurrency}`);
    for (const [index, step] of resolved.entries()) {
      console.log(`  ${index + 1}. ${step.name}: ${commandList[index]}`);
    }
    return 0;
  }

  const summary = await scheduleNodes(resolved, {
    concurrency,
    execute: (node) => runPrefixedCommand(node.name, node.command, node.args, env, verbose),
  });

  return summary.exitCode;
}

async function runJobBatch(jobNames, { concurrency, verbose, env, workflow, keepContainer, reuse, containerArchitecture }) {
  const jobNodes = buildJobNodes(jobNames, {
    workflow,
    keepContainer,
    reuse,
    containerArchitecture,
  });

  const summary = await scheduleNodes(jobNodes, {
    concurrency,
    execute: (node) => runPrefixedCommand(node.name, node.command, node.args, env, verbose),
  });

  return summary.exitCode;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return 0;
  }

  if (options.jobs.length > 0 && options.steps.length > 0) {
    fail('--job and --step are mutually exclusive');
  }

  if (options.jobs.length === 0 && options.steps.length === 0) {
    fail('Specify either --job <name> or one or more --step <name> flags');
  }

  const env = { ...process.env };

  if (options.steps.length > 0) {
    return runPresetSteps(options.steps, {
      concurrency: options.concurrency,
      dryRun: options.dryRun,
      verbose: options.verbose,
      env,
    });
  }

  const dockerHost = await resolveDockerHost(options.verbose);
  if (dockerHost) {
    env.DOCKER_HOST = dockerHost;
  }

  if (options.jobs.length > 1) {
    if (options.dryRun) {
      console.log(`Resolved DOCKER_HOST: ${dockerHost ?? '<unset>'}`);
      printJobBatchDryRun(buildJobNodes(options.jobs, {
        workflow: options.workflow,
        keepContainer: options.keepContainer,
        reuse: options.reuse,
        containerArchitecture: options.containerArchitecture,
      }), options.concurrency);
      return 0;
    }

    return runJobBatch(options.jobs, {
      concurrency: options.concurrency,
      verbose: options.verbose,
      env,
      workflow: options.workflow,
      keepContainer: options.keepContainer,
      reuse: options.reuse,
      containerArchitecture: options.containerArchitecture,
    });
  }

  const actArgs = buildActArgs(options);
  const resolvedCommand = dockerHost
    ? `DOCKER_HOST=${shellQuote(dockerHost)} ${formatCommand('act', actArgs)}`
    : formatCommand('act', actArgs);

  if (options.dryRun) {
    console.log(`Resolved DOCKER_HOST: ${dockerHost ?? '<unset>'}`);
    console.log(`Resolved command: ${resolvedCommand}`);
    return 0;
  }

  if (options.verbose) {
    console.error(`Verbose: resolved DOCKER_HOST=${dockerHost ?? '<unset>'}`);
    console.error(`Verbose: running ${resolvedCommand}`);
  }

  return runAct(actArgs, env);
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
}

if (isDirectExecution()) {
  main()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error) => {
      if (error?.signal) {
        process.exit(signalExitCode(error.signal));
        return;
      }

      if (error instanceof CliError) {
        process.exit(1);
        return;
      }

      if (error?.code === 'ENOENT' && error?.path === 'act') {
        console.error('Error: act is not installed or not on PATH');
      } else {
        console.error(error instanceof Error ? error.stack || error.message : String(error));
      }

      process.exit(1);
    });
}
