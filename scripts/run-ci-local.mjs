#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { constants as osConstants } from 'node:os';

const DEFAULT_WORKFLOW = '.github/workflows/testing.yml';
const TERMINATION_SIGNALS = process.platform === 'win32'
  ? ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'SIGBREAK']
  : ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'];

const PRESETS = {
  install: { command: 'pnpm', args: ['install', '--frozen-lockfile'] },
  typecheck: { command: 'pnpm', args: ['typecheck'] },
  'core:test': { command: 'pnpm', args: ['test:core'] },
  'web:deps': { command: 'pnpm', args: ['exec', 'playwright', 'install-deps'] },
  'web:browser': { command: 'pnpm', args: ['exec', 'playwright', 'install', 'chromium'] },
  'web:test': { command: 'pnpm', args: ['test:web'] },
  'vscode:test': {
    command: 'xvfb-run',
    args: ['-a', '--server-args=-screen 0 1920x1080x24', 'pnpm', 'test:vscode'],
  },
};

function usage() {
  const presetLines = Object.entries(PRESETS)
    .map(([name, preset]) => `    - ${name} → ${formatCommand(preset.command, preset.args)}`)
    .join('\n');

  return `Usage:
  node scripts/run-ci-local.mjs --help
  node scripts/run-ci-local.mjs --job <name> [--workflow <path>] [--container-architecture <arch>] [--keep-container] [--dry-run] [--verbose]
  node scripts/run-ci-local.mjs --step <name> [--step <name> ...] [--dry-run] [--verbose]

Modes:
  Workflow/job mode runs a GitHub Actions job with act.
    - --job <name> selects the workflow job
    - --workflow defaults to ${DEFAULT_WORKFLOW}
    - --container-architecture passes an architecture through to act
    - --keep-container leaves the container behind for inspection

  Preset/step mode runs local CI presets in the order provided.
    - --step <name> is repeatable and preserves order
    - at least one --step is required in this mode

Presets:
${presetLines}

Options:
  --help, -h                 Show this help and exit 0
  --job <name>               Run the named workflow job via act
  --step <name>              Run a local preset step (repeatable)
  --workflow <path>          Workflow file for job mode (default: ${DEFAULT_WORKFLOW})
  --container-architecture   Container architecture to pass to act (default: act's default)
  --keep-container           Keep the container after the run (default: off)
  --dry-run                  Print the resolved command without running it (default: off)
  --verbose                  Print extra diagnostic information (default: off)
`;
}

function fail(message) {
  console.error(`Error: ${message}\n`);
  console.error(usage());
  process.exit(1);
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    fail(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    help: false,
    job: null,
    steps: [],
    workflow: DEFAULT_WORKFLOW,
    containerArchitecture: null,
    keepContainer: false,
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

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }

    if (arg === '--job') {
      options.job = readValue(argv, i, '--job');
      i += 1;
      continue;
    }

    if (arg.startsWith('--job=')) {
      options.job = arg.slice('--job='.length);
      if (!options.job) fail('--job requires a value');
      continue;
    }

    if (arg === '--step') {
      options.steps.push(readValue(argv, i, '--step'));
      i += 1;
      continue;
    }

    if (arg.startsWith('--step=')) {
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

function buildActArgs(options) {
  const args = ['-W', options.workflow, '-j', options.job];

  if (!options.keepContainer) {
    args.push('--rm');
  }

  if (options.containerArchitecture) {
    args.push('--container-architecture', options.containerArchitecture);
  }

  return args;
}

function resolvePreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    fail(`Unknown preset: ${name}`);
  }

  return preset;
}

function formatPresetCommand(preset) {
  return formatCommand(preset.command, preset.args);
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

async function runPresetSteps(stepNames, { dryRun, verbose, env }) {
  const resolved = stepNames.map((name) => ({ name, ...resolvePreset(name) }));
  const commandList = resolved.map((step) => formatPresetCommand(step));

  if (dryRun) {
    console.log('Resolved preset commands:');
    for (const [index, step] of resolved.entries()) {
      console.log(`  ${index + 1}. ${step.name}: ${commandList[index]}`);
    }
    return 0;
  }

  for (const [index, step] of resolved.entries()) {
    const resolvedCommand = commandList[index];
    if (verbose) {
      console.error(`Verbose: running ${step.name}: ${resolvedCommand}`);
    }

    const exitCode = await runCommand(step.command, step.args, env);
    if (exitCode !== 0) {
      return exitCode;
    }
  }

  return 0;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return 0;
  }

  if (options.job && options.steps.length > 0) {
    fail('--job and --step are mutually exclusive');
  }

  if (!options.job && options.steps.length === 0) {
    fail('Specify either --job <name> or one or more --step <name> flags');
  }

  if (options.steps.length > 0) {
    const env = { ...process.env };
    return runPresetSteps(options.steps, {
      dryRun: options.dryRun,
      verbose: options.verbose,
      env,
    });
  }

  const dockerHost = await resolveDockerHost(options.verbose);
  const env = { ...process.env };

  if (dockerHost) {
    env.DOCKER_HOST = dockerHost;
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

main()
  .then((exitCode) => {
    process.exit(exitCode);
  })
  .catch((error) => {
    if (error?.signal) {
      process.exit(signalExitCode(error.signal));
      return;
    }

    if (error?.code === 'ENOENT' && error?.path === 'act') {
      console.error('Error: act is not installed or not on PATH');
    } else {
      console.error(error instanceof Error ? error.stack || error.message : String(error));
    }

    process.exit(1);
  });
