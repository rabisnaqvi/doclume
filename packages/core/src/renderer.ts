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
  container.innerHTML = html;

  enhanceCodeBlocks(container);

  if (typeof window !== 'undefined' && container.querySelector('.math-pending')) {
    await new Promise<void>((resolve) => {
      const handleMathReady = (): void => {
        if (!signal.aborted) {
          const { html: updatedHtml } = renderMarkdownWithMeta(markdown);
          container.innerHTML = updatedHtml;
          enhanceCodeBlocks(container);
        }
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
