import { describe, expect, it } from 'vitest';
import { buildActArgs, parseArgs } from '../../scripts/run-ci-local.mjs';

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
