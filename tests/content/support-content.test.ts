import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderDocument, THEMES } from '@doclume/core';
import type { Theme } from '@doclume/core';

const theme = THEMES.find((t) => t.id === 'manual')! as Theme;

async function render(markdown: string): Promise<string> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const ac = new AbortController();
  await renderDocument(container, markdown, theme, ac.signal);
  const html = container.innerHTML;
  container.remove();
  return html;
}

describe('support content', () => {
  const samples = [
    ['sample.md', resolve(process.cwd(), 'packages/web/public/sample.md')],
    ['basic.md', resolve(process.cwd(), 'tests/fixtures/basic.md')],
    ['rich.md', resolve(process.cwd(), 'tests/fixtures/rich.md')],
  ] as const;

  it.each(samples)('renders %s as non-empty HTML', async (_, filePath) => {
    const markdown = readFileSync(filePath, 'utf8');
    const html = (await render(markdown)).trim();

    expect(html).not.toBe('');
  });
});
