import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderMarkdown } from '@doclume/core';

describe('support content', () => {
  const samplesDir = resolve(process.cwd(), 'docs/samples');
  const sampleFiles = readdirSync(samplesDir).filter((name) => name.startsWith('markdown-coverage.'));

  it.each(sampleFiles)('renders %s as non-empty HTML', (filename) => {
    const markdown = readFileSync(resolve(samplesDir, filename), 'utf8');
    const html = renderMarkdown(markdown).trim();

    expect(html).not.toBe('');
  });
});
