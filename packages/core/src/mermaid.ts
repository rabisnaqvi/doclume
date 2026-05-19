import type { ThemeId } from './types.js';
import { sanitizeMermaidSvg } from './sanitize.js';

let mermaidBootstrap: Promise<void> | null = null;

async function ensureMermaidBootstrap(mermaid: { parse: (code: string) => Promise<unknown> }): Promise<void> {
  if (!mermaidBootstrap) {
    mermaidBootstrap = mermaid
      .parse('flowchart TD\nA[Doclume]-->B[Ready]')
      .then(() => undefined, () => undefined);
  }
  await mermaidBootstrap;
}

export function getMermaidTheme(theme: ThemeId): 'dark' | 'neutral' {
  return (theme === 'lamplight' || theme === 'console' || theme === 'contrast') ? 'dark' : 'neutral';
}

export interface RenderMermaidOptions {
  signal?: AbortSignal;
}

export function runAbortableTask(task: (signal: AbortSignal) => void | Promise<void>): () => void {
  const ac = new AbortController();
  void task(ac.signal);
  return () => ac.abort();
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
      securityLevel: 'strict',
      htmlLabels: false,
    });

    if (aborted()) return;

    await ensureMermaidBootstrap(mermaid);
    if (aborted()) return;

    for (let i = 0; i < nodes.length; i++) {
      if (aborted()) return;
      const node = nodes[i];
      const code = node.dataset.src ?? node.textContent ?? '';
      if (!code.trim()) continue;
      const renderId = `mermaid-${i}-${Date.now()}`;
      try {
        const { svg } = await mermaid.render(renderId, code);
        if (aborted()) return;
        node.innerHTML = sanitizeMermaidSvg(svg);
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
