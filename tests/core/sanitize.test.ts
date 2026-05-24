import { describe, it, expect } from 'vitest';
import { renderDocument, THEMES } from '@doclume/core';
import type { Theme } from '@doclume/core';
import { fixtures } from '../fixtures';

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

describe('markdown sanitization', () => {
  it('renders the sanitization fixture without javascript URLs', async () => {
    const html = await render(fixtures.sanitization);

    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/onerror=/i);
    expect(html).toContain('href="#"');
    expect(html).toContain('<img>');
  });

  it('sanitizes links inside definition lists', async () => {
    const html = await render(`Term\n: [bad](javascript:alert(1))`);

    expect(html).not.toMatch(/javascript:/i);
    expect(html).toContain('href="#"');
  });
});
