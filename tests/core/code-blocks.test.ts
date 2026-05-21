import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { enhanceCodeBlocks } from '@doclume/core';

describe('enhanceCodeBlocks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a copy button to every highlighted code block and a label only for explicit languages', () => {
    const dom = new JSDOM(`
      <article class="markdown">
        <pre><code class="hljs language-typescript">const x = 1;</code></pre>
        <pre><code class="hljs">plain text</code></pre>
      </article>
    `);

    enhanceCodeBlocks(dom.window.document);

    const overlays = dom.window.document.querySelectorAll('.code-block__overlay');
    expect(overlays).toHaveLength(2);
    expect(dom.window.document.querySelector('.code-block__label')?.textContent).toBe('typescript');
    expect(dom.window.document.querySelectorAll('.code-block__label')).toHaveLength(1);
    expect(dom.window.document.querySelectorAll('button.code-block__copy')).toHaveLength(2);
  });

  it('is idempotent and does not duplicate overlays on repeated calls', () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');

    enhanceCodeBlocks(dom.window.document);
    enhanceCodeBlocks(dom.window.document);

    expect(dom.window.document.querySelectorAll('.code-block__overlay')).toHaveLength(1);
  });

  it('copies code text and resets copied state after 2 seconds', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    enhanceCodeBlocks(dom.window.document);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    button?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('echo hi');
    expect(button?.textContent).toBe('Copied ✓');

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(button?.textContent).toBe('Copy');
  });

  it('keeps the button usable when clipboard is unavailable', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');

    enhanceCodeBlocks(dom.window.document);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    expect(() => button?.click()).not.toThrow();
    await Promise.resolve();

    expect(button?.textContent).toBe('Copy');
  });

  it('keeps the button usable when clipboard copying is rejected', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    enhanceCodeBlocks(dom.window.document);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    button?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('echo hi');
    expect(button?.textContent).toBe('Copy');
  });
});
