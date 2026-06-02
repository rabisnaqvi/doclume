import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderDocument, THEMES } from '@doclume/core';
import type { Theme, DocumentRenderResult } from '@doclume/core';

const light = THEMES.find((t) => t.id === 'manual')! as Theme;

describe('renderDocument', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('returns html, toc, and stats while hydrating the root', async () => {
    const ac = new AbortController();
    const result = await renderDocument(container, '# Hello World\n\n## Subhead', light, ac.signal);

    expect(result).toEqual<DocumentRenderResult>(expect.objectContaining({
      html: expect.stringContaining('<h1 id="hello-world">Hello World</h1>'),
      toc: [
        { id: 'hello-world', level: 1, text: 'Hello World' },
        { id: 'subhead', level: 2, text: 'Subhead' },
      ],
      stats: { words: 5, minutes: 1 },
    }));
    expect(container.querySelector('h1')?.textContent).toBe('Hello World');
    expect(container.querySelector('h2')?.textContent).toBe('Subhead');
  });

  it('renders a paragraph', async () => {
    const ac = new AbortController();
    await renderDocument(container, 'Just a paragraph.', light, ac.signal);
    expect(container.querySelector('p')?.textContent).toBe('Just a paragraph.');
  });

  it('enhances code blocks with a copy button', async () => {
    const ac = new AbortController();
    await renderDocument(container, '```js\nconsole.log("hi");\n```', light, ac.signal);
    expect(container.querySelector('.code-block__copy')).not.toBeNull();
    expect(container.querySelector('pre')?.classList.contains('code-block--enhanced')).toBe(true);
  });

  it('does not inject HTML when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await renderDocument(container, '# Should not render', light, ac.signal);
    expect(container.innerHTML).toBe('');
  });

  it('renders empty string without throwing', async () => {
    const ac = new AbortController();
    await expect(renderDocument(container, '', light, ac.signal)).resolves.toEqual({
      html: '',
      toc: [],
      stats: { words: 0, minutes: 1 },
    });
  });

  it('falls back when requestAnimationFrame is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    // In jsdom, window is the global object, but keep this explicit for safety.
    (window as any).requestAnimationFrame = undefined;

    try {
      const ac = new AbortController();
      await expect(renderDocument(container, '# Hello World', light, ac.signal)).resolves.toMatchObject({
        html: expect.stringContaining('<h1 id="hello-world">Hello World</h1>'),
        toc: [{ id: 'hello-world', level: 1, text: 'Hello World' }],
        stats: { words: 3, minutes: 1 },
      });
      expect(container.querySelector('h1')?.textContent).toBe('Hello World');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is idempotent for code block enhancement on re-render', async () => {
    const ac1 = new AbortController();
    await renderDocument(container, '```ts\nconst x = 1;\n```', light, ac1.signal);
    const copyButtons1 = container.querySelectorAll('.code-block__copy').length;

    const ac2 = new AbortController();
    await renderDocument(container, '```ts\nconst x = 1;\n```', light, ac2.signal);
    const copyButtons2 = container.querySelectorAll('.code-block__copy').length;

    expect(copyButtons1).toBe(1);
    expect(copyButtons2).toBe(1);
  });

  it('re-renders when MATH_READY_EVENT fires and math-pending elements exist', async () => {
    const ac = new AbortController();

    // Render markdown that produces a `.math-pending` node (KaTeX is lazy-loaded).
    const renderPromise = renderDocument(container, 'Inline math: $x^2$', light, ac.signal);

    // `renderDocument` runs synchronously until it starts awaiting the math-ready event.
    expect(container.querySelector('.math-pending')).not.toBeNull();
    expect(container.querySelector('.katex')).toBeNull();

    await renderPromise;

    // After math-ready, `renderDocument` should re-render with KaTeX output.
    expect(container.querySelector('.math-pending')).toBeNull();
    expect(container.querySelector('.katex')).not.toBeNull();
  });

});
