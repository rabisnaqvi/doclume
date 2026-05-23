import { describe, expect, it } from 'vitest';
import { buildActArgs, buildPresetGraph, parseArgs } from '../../scripts/run-ci-local.mjs';

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
