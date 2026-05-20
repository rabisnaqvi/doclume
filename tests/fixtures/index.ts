import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const fixtureNames = {
  basic: 'basic.md',
  rich: 'rich.md',
  mermaid: 'mermaid.md',
  sanitization: 'sanitization.md',
} as const;

export type FixtureName = keyof typeof fixtureNames;

const baseDir = dirname(fileURLToPath(import.meta.url));

function readFixture(name: string): string {
  return readFileSync(resolve(baseDir, name), 'utf8');
}

export const fixtures = {
  basic: readFixture(fixtureNames.basic),
  rich: readFixture(fixtureNames.rich),
  mermaid: readFixture(fixtureNames.mermaid),
  sanitization: readFixture(fixtureNames.sanitization),
} as const;
