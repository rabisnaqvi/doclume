import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderMarkdown } from '@doclume/core';

describe('support content', () => {
  const samples = [
    ['sample.md', resolve(process.cwd(), 'packages/web/public/sample.md')],
    ['basic.md', resolve(process.cwd(), 'tests/fixtures/basic.md')],
    ['rich.md', resolve(process.cwd(), 'tests/fixtures/rich.md')],
  ] as const;

  it.each(samples)('renders %s as non-empty HTML', (_, filePath) => {
    const markdown = readFileSync(filePath, 'utf8');
    const html = renderMarkdown(markdown).trim();

    expect(html).not.toBe('');
  });
});
