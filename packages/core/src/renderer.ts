import { renderMarkdownWithMeta, MATH_READY_EVENT } from './markdown.js';
import { renderMermaidDiagrams } from './mermaid.js';
import { enhanceCodeBlocks } from './code-blocks.js';
import type { Theme } from './types.js';

export async function renderDocument(
  container: Element,
  markdown: string,
  theme: Theme,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return;

  const { html } = renderMarkdownWithMeta(markdown);

  // Abort can race between the initial guard and DOM mutation.
  if (signal.aborted) return;
  container.innerHTML = html;

  // DOM enhancement mutates the container as well.
  if (signal.aborted) return;
  enhanceCodeBlocks(container);

  if (typeof window !== 'undefined' && container.querySelector('.math-pending')) {
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();

      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', onAbort);
        window.removeEventListener(MATH_READY_EVENT, onMathReady);
        window.clearTimeout(timeout);
        resolve();
      };

      const onAbort = (): void => finish();
      const onMathReady = (_event: Event): void => {
        if (signal.aborted) return finish();

        const { html: updatedHtml } = renderMarkdownWithMeta(markdown);

        // Abort can race inside the math-ready callback too.
        if (signal.aborted) return finish();
        container.innerHTML = updatedHtml;

        if (signal.aborted) return finish();
        enhanceCodeBlocks(container);

        finish();
      };

      const timeout = window.setTimeout(finish, 2000);

      signal.addEventListener('abort', onAbort, { once: true });
      window.addEventListener(MATH_READY_EVENT, onMathReady, { once: true });

      if (signal.aborted) finish();
    });
  }

  if (signal.aborted) return;

  const raf: ((cb: FrameRequestCallback) => number) | undefined =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : undefined);

  await new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();

    const handleAbort = (): void => resolve();
    signal.addEventListener('abort', handleAbort, { once: true });

    if (raf) {
      raf(() => resolve());
      return;
    }

    setTimeout(() => resolve(), 0);
  });
  if (signal.aborted) return;

  await renderMermaidDiagrams(container, theme.mermaidTheme, { signal });
}
