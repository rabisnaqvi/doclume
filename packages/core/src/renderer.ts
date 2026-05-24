import { configureMarked, renderMarkdownWithMeta, MATH_READY_EVENT } from './markdown.js';
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

  configureMarked();

  const { html } = renderMarkdownWithMeta(markdown);
  container.innerHTML = html;

  enhanceCodeBlocks(container);

  if (typeof window !== 'undefined' && container.querySelector('.math-pending')) {
    const handleMathReady = (): void => {
      if (signal.aborted) return;
      const { html: updatedHtml } = renderMarkdownWithMeta(markdown);
      container.innerHTML = updatedHtml;
      enhanceCodeBlocks(container);
    };
    window.addEventListener(MATH_READY_EVENT, handleMathReady, { once: true, signal });
  }

  await renderMermaidDiagrams(container, theme.mermaidTheme, { signal });
}
