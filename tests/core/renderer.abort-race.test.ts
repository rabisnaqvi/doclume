import { describe, it, expect, vi } from 'vitest';
import type { Theme } from '@doclume/core';

let abortNow: (() => void) | undefined;
let callIndex = 0;

vi.mock('../../packages/core/src/markdown.js', () => {
  return {
    MATH_READY_EVENT: 'doclume:math-ready',
    renderMarkdownWithMeta: (_markdown: string) => {
      callIndex++;
      abortNow?.();
      abortNow = undefined;

      // Call 1: initial render
      if (callIndex === 1) return { html: '<span class="math-pending">pending</span>' };

      // Call 2: math-ready rerender
      return { html: '<p>updated</p>' };
    },
    extractToc: () => [],
  };
});

describe('renderDocument abort race', () => {
  it('does not inject HTML if aborted after initial guard but before initial DOM mutation', async () => {
    callIndex = 0;

    const { renderDocument, THEMES } = await import('@doclume/core');
    const theme = THEMES.find((t) => t.id === 'manual')! as Theme;
    const container = document.createElement('div');

    const ac = new AbortController();
    abortNow = () => ac.abort();

    await expect(renderDocument(container, '# ignored by mock', theme, ac.signal)).resolves.toBeUndefined();
    expect(container.innerHTML).toBe('');
  });

  it('does not re-render on math-ready if aborted after handler starts but before DOM mutation', async () => {
    callIndex = 0;

    const { renderDocument, THEMES } = await import('@doclume/core');
    const theme = THEMES.find((t) => t.id === 'manual')! as Theme;
    const container = document.createElement('div');

    const ac = new AbortController();

    const renderPromise = renderDocument(container, '# ignored by mock', theme, ac.signal);
    // Wait a tick so renderDocument installs the math-ready listener.
    await Promise.resolve();

    // Abort during the handler (triggered when the second renderMarkdownWithMeta runs).
    abortNow = () => ac.abort();
    window.dispatchEvent(new Event('doclume:math-ready'));

    await expect(renderPromise).resolves.toBeUndefined();

    // Should still be initial HTML, not the updated one.
    expect(container.innerHTML).toBe('<span class="math-pending">pending</span>');
  });
});
