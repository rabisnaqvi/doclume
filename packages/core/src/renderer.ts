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

  const view = container.ownerDocument?.defaultView ?? (typeof window !== 'undefined' ? window : undefined);

  if (view && container.querySelector('.math-pending')) {
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();

      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', onAbort);
        view.removeEventListener(MATH_READY_EVENT, onMathReady);
        view.clearTimeout(timeout);
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

      const timeout = view.setTimeout(finish, 2000);

      signal.addEventListener('abort', onAbort, { once: true });
      view.addEventListener(MATH_READY_EVENT, onMathReady, { once: true });

      if (signal.aborted) finish();
    });
  }

  if (signal.aborted) return;

  const raf: ((cb: FrameRequestCallback) => number) | undefined =
    view && typeof view.requestAnimationFrame === 'function'
      ? view.requestAnimationFrame.bind(view)
      : (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : undefined);

  if (view) {
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();

      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        signal.removeEventListener('abort', handleAbort);
        resolve();
      };

      const handleAbort = (): void => finish();
      signal.addEventListener('abort', handleAbort, { once: true });

      if (raf) {
        raf(() => finish());
        return;
      }

      setTimeout(() => finish(), 0);
    });
    if (signal.aborted) return;

    await renderMermaidDiagrams(container, theme.mermaidTheme, { signal });
  }
}
