import { describe, expect, it, vi } from 'vitest';
import { buildActArgs, buildPresetGraph, parseArgs, printRunSummary, scheduleNodes } from '../../scripts/run-ci-local.mjs';

describe('run-ci-local CLI parsing', () => {
  it('accepts repeated jobs and concurrency', () => {
    expect(parseArgs(['--job', 'typecheck', '--job', 'core', '--concurrency', '2'])).toMatchObject({
      jobs: ['typecheck', 'core'],
      concurrency: 2,
    });
  });

  it('accepts repeated steps', () => {
    expect(parseArgs(['--step', 'install', '--step', 'typecheck'])).toMatchObject({
      steps: ['install', 'typecheck'],
    });
  });

  it('rejects mixed jobs and steps', () => {
    expect(() => parseArgs(['--job', 'typecheck', '--step', 'install'])).toThrow(/mutually exclusive/);
  });

  it('rejects invalid concurrency', () => {
    expect(() => parseArgs(['--concurrency', '0'])).toThrow(/positive integer/);
  });

  it('orders install before dependent preset nodes', () => {
    expect(buildPresetGraph(['install', 'typecheck', 'core:test']).order.map((node) => node.name)).toEqual([
      'install',
      'typecheck',
      'core:test',
    ]);
  });

  it('expands preset dependencies into a closed graph', () => {
    expect(buildPresetGraph(['web:test']).order.map((node) => node.name)).toEqual([
      'install',
      'web:deps',
      'web:browser',
      'web:test',
    ]);
  });

  it('rejects duplicate preset names', () => {
    expect(() => buildPresetGraph(['install', 'install'])).toThrow(/duplicate/i);
  });

  it('rejects unknown presets', () => {
    expect(() => buildPresetGraph(['unknown'])).toThrow(/unknown preset/i);
  });

  it('runs independent nodes in parallel up to concurrency', async () => {
    const started: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const gates = new Map<string, () => void>();

    const execute = async (node: { name: string }) => {
      started.push(node.name);
      running += 1;
      maxRunning = Math.max(maxRunning, running);

      await new Promise<void>((resolve) => {
        gates.set(node.name, resolve);
      });

      running -= 1;
      return 0;
    };

    const run = scheduleNodes([
      { name: 'install', deps: [] },
      { name: 'core:test', deps: ['install'] },
      { name: 'web:deps', deps: ['install'] },
    ], {
      concurrency: 2,
      execute,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(['install']);

    gates.get('install')!();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(started).toEqual(['install', 'core:test', 'web:deps']);
    expect(maxRunning).toBe(2);

    gates.get('core:test')!();
    gates.get('web:deps')!();

    const summary = await run;
    expect(summary.failed).toEqual([]);
    expect(summary.skipped).toEqual([]);
    expect(summary.succeeded.sort()).toEqual(['core:test', 'install', 'web:deps']);
  });

  it('stops queueing new nodes after the first failure', async () => {
    const started: string[] = [];
    const summary = await scheduleNodes([
      { name: 'install', deps: [] },
      { name: 'typecheck', deps: ['install'] },
      { name: 'core:test', deps: ['install'] },
    ], {
      concurrency: 1,
      execute: async (node: { name: string }) => {
        started.push(node.name);
        return node.name === 'typecheck' ? 1 : 0;
      },
    });

    expect(started).toEqual(['install', 'typecheck']);
    expect(summary.failed).toEqual(['typecheck']);
    expect(summary.skipped).toEqual(['core:test']);
  });

  it('prints a final summary', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    printRunSummary({
      succeeded: ['install'],
      failed: ['typecheck'],
      skipped: ['core:test'],
    });

    expect(logSpy).toHaveBeenNthCalledWith(1, 'Summary:');
    expect(logSpy).toHaveBeenNthCalledWith(2, '  succeeded: install');
    expect(logSpy).toHaveBeenNthCalledWith(3, '  failed: typecheck');
    expect(logSpy).toHaveBeenNthCalledWith(4, '  skipped: core:test');
    logSpy.mockRestore();
  });

  it('keeps single-job act behavior', () => {
    expect(
      buildActArgs({
        workflow: '.github/workflows/testing.yml',
        job: 'typecheck',
        keepContainer: false,
        reuse: true,
        containerArchitecture: null,
      }),
    ).toContain('--reuse');
  });
});
