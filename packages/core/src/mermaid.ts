import type { ThemeId } from './types.js';

let mermaidWarm = false;

export function getMermaidTheme(theme: ThemeId): 'dark' | 'neutral' {
  return (theme === 'lamplight' || theme === 'console' || theme === 'contrast') ? 'dark' : 'neutral';
}

export interface RenderMermaidOptions {
  signal?: AbortSignal;
}

/** Render `.mermaid` placeholders under `root` (dynamic import; safe in browser/webview only). */
export async function renderMermaidDiagrams(
  root: ParentNode | null | undefined,
  theme: ThemeId,
  options?: RenderMermaidOptions,
): Promise<void> {
  const nodes = Array.from(root?.querySelectorAll<HTMLElement>('.mermaid') ?? []);
  if (!nodes.length) return;

  const aborted = (): boolean => options?.signal?.aborted ?? false;
  if (aborted()) return;

  try {
    const { default: mermaid } = await import('mermaid');
    if (aborted()) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: getMermaidTheme(theme),
      securityLevel: 'loose',
    });

    if (!mermaidWarm) {
      await Promise.allSettled(
        nodes.map((node) => {
          const code = node.dataset.src ?? node.textContent ?? '';
          return code.trim() ? mermaid.parse(code) : Promise.resolve();
        }),
      );
      mermaidWarm = true;
    }
    if (aborted()) return;

    for (let i = 0; i < nodes.length; i++) {
      if (aborted()) return;
      const node = nodes[i];
      const code = node.dataset.src ?? node.textContent ?? '';
      if (!code.trim()) continue;
      const renderId = `mermaid-${i}-${Date.now()}`;
      try {
        const { svg, bindFunctions } = await mermaid.render(renderId, code);
        if (aborted()) return;
        node.innerHTML = svg;
        bindFunctions?.(node);
      } catch {
        /* leave raw code on parse error */
      } finally {
        document.getElementById(`d${renderId}`)?.remove();
      }
    }
  } catch {
    /* ignore load failures */
  }
}
