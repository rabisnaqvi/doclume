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
      const handleMathReady = (): void => {
        if (signal.aborted) return resolve();

        const { html: updatedHtml } = renderMarkdownWithMeta(markdown);

        // Abort can race inside the math-ready callback too.
        if (signal.aborted) return resolve();
        container.innerHTML = updatedHtml;

        if (signal.aborted) return resolve();
        enhanceCodeBlocks(container);

        resolve();
      };
      signal.addEventListener('abort', () => resolve(), { once: true });
      window.addEventListener(MATH_READY_EVENT, handleMathReady, { once: true, signal });
    });
  }

  if (signal.aborted) return;

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (signal.aborted) return;

  await renderMermaidDiagrams(container, theme.mermaidTheme, { signal });
}
