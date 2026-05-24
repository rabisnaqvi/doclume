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

  it('adds an icon plus label copy button to every highlighted code block and a label only for explicit languages', () => {
    const dom = new JSDOM(`
      <article class="markdown">
        <pre><code class="hljs language-typescript">const x = 1;</code></pre>
        <pre><code class="hljs">plain text</code></pre>
      </article>
    `);

    enhanceCodeBlocks(dom.window.document);

    const overlays = dom.window.document.querySelectorAll('.code-block__overlay');
    const firstButton = dom.window.document.querySelector('button.code-block__copy');

    expect(overlays).toHaveLength(2);
    expect(dom.window.document.querySelector('.code-block__label')?.textContent).toBe('typescript');
    expect(dom.window.document.querySelectorAll('.code-block__label')).toHaveLength(1);
    expect(dom.window.document.querySelectorAll('button.code-block__copy')).toHaveLength(2);
    expect(firstButton?.querySelector('.code-block__copy-icon')).not.toBeNull();
    expect(firstButton?.querySelector('.code-block__copy-label')?.textContent).toBe('Copy');
  });

  it('is idempotent and does not duplicate overlays or listeners on repeated calls', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    enhanceCodeBlocks(dom.window.document);
    enhanceCodeBlocks(dom.window.document);

    expect(dom.window.document.querySelectorAll('.code-block__overlay')).toHaveLength(1);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    button?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('handles overlapping roots without double-copying', async () => {
    const dom = new JSDOM(`
      <article class="markdown">
        <pre><code class="hljs language-bash">echo hi</code></pre>
      </article>
    `);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    const article = dom.window.document.querySelector('article');
    expect(article).not.toBeNull();

    enhanceCodeBlocks(dom.window.document);
    enhanceCodeBlocks(article as ParentNode);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    expect(button).not.toBeNull();

    button?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('copies code text and resets copied state after 2 seconds', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    enhanceCodeBlocks(dom.window.document);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    const copyLabel = button?.querySelector('.code-block__copy-label') as HTMLSpanElement | null;
    expect(button).not.toBeNull();
    expect(copyLabel).not.toBeNull();

    button?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('echo hi');
    expect(copyLabel?.textContent).toBe('Copied ✓');

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(copyLabel?.textContent).toBe('Copy');
  });

  it('keeps the button usable when clipboard is unavailable', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');

    enhanceCodeBlocks(dom.window.document);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    const copyLabel = button?.querySelector('.code-block__copy-label') as HTMLSpanElement | null;
    expect(button).not.toBeNull();
    expect(copyLabel).not.toBeNull();

    expect(() => button?.click()).not.toThrow();
    await Promise.resolve();

    expect(copyLabel?.textContent).toBe('Copy');
  });

  it('tracks copied state independently per button', async () => {
    const dom = new JSDOM(`
      <article class="markdown">
        <pre><code class="hljs language-bash">echo one</code></pre>
        <pre><code class="hljs language-bash">echo two</code></pre>
      </article>
    `);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    enhanceCodeBlocks(dom.window.document);

    const copyLabels = Array.from(dom.window.document.querySelectorAll('.code-block__copy-label')) as HTMLSpanElement[];
    expect(copyLabels).toHaveLength(2);

    const buttons = Array.from(dom.window.document.querySelectorAll('button.code-block__copy')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);

    buttons[0]?.click();
    await Promise.resolve();
    expect(copyLabels[0]?.textContent).toBe('Copied ✓');
    expect(copyLabels[1]?.textContent).toBe('Copy');

    buttons[1]?.click();
    await Promise.resolve();
    expect(copyLabels[0]?.textContent).toBe('Copied ✓');
    expect(copyLabels[1]?.textContent).toBe('Copied ✓');

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(copyLabels[0]?.textContent).toBe('Copy');
    expect(copyLabels[1]?.textContent).toBe('Copy');
  });

  it('keeps the button usable when clipboard copying is rejected', async () => {
    const dom = new JSDOM('<pre><code class="hljs language-bash">echo hi</code></pre>');
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(dom.window.navigator, { clipboard: { writeText } });

    enhanceCodeBlocks(dom.window.document);

    const button = dom.window.document.querySelector('button.code-block__copy') as HTMLButtonElement | null;
    const copyLabel = button?.querySelector('.code-block__copy-label') as HTMLSpanElement | null;
    expect(button).not.toBeNull();
    expect(copyLabel).not.toBeNull();

    button?.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('echo hi');
    expect(copyLabel?.textContent).toBe('Copy');
  });
});
