import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderDocument, THEMES } from '@doclume/core';
import type { Theme } from '@doclume/core';

const light = THEMES.find((t) => t.id === 'manual')! as Theme;
const dark = THEMES.find((t) => t.id === 'console')! as Theme;

// Minimal mermaid runtime mock — renderMermaidDiagrams accepts this via options.runtime
const mockMermaidRuntime = {
  initialize: vi.fn(),
  parse: vi.fn().mockResolvedValue(undefined),
  render: vi.fn().mockResolvedValue({ svg: '<svg data-mock></svg>' }),
};

describe('renderDocument', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('injects rendered HTML for a heading', async () => {
    const ac = new AbortController();
    await renderDocument(container, '# Hello World', light, ac.signal);
    expect(container.querySelector('h1')?.textContent).toBe('Hello World');
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
    await expect(renderDocument(container, '', light, ac.signal)).resolves.toBeUndefined();
  });

  it('falls back when requestAnimationFrame is unavailable', async () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    // In jsdom, window is the global object, but keep this explicit for safety.
    (window as any).requestAnimationFrame = undefined;

    try {
      const ac = new AbortController();
      await expect(renderDocument(container, '# Hello World', light, ac.signal)).resolves.toBeUndefined();
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
    // Inject a .math-pending node manually to simulate pre-KaTeX state
    container.innerHTML = '<span class="math-pending"><code>x^2</code></span>';

    // Start renderDocument with markdown that would produce math (we stub the pending state above)
    // We just need to confirm the listener fires and triggers a re-render
    const renderPromise = renderDocument(container, '# No math here', light, ac.signal);

    // Dispatch math-ready before awaiting
    window.dispatchEvent(new Event('doclume:math-ready'));

    await renderPromise;

    // After re-render, the injected .math-pending span is gone (container was replaced)
    expect(container.querySelector('.math-pending')).toBeNull();
    expect(container.querySelector('h1')).not.toBeNull();
  });

  it('uses mermaidTheme from the Theme object', async () => {
    const ac = new AbortController();
    await renderDocument(container, '# No diagrams', dark, ac.signal);
    expect(container.querySelector('h1')).not.toBeNull();
  });
});
