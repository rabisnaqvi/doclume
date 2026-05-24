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
  runtime?: MermaidRuntime;
}

export function runAbortableTask(task: (signal: AbortSignal) => void | Promise<void>): () => void {
  const ac = new AbortController();
  void task(ac.signal);
  return () => ac.abort();
}

function isRenderable(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  return node.isConnected && rect.width > 0 && rect.height > 0;
}

type MermaidRuntime = {
  initialize: (options: { startOnLoad: boolean; theme: 'dark' | 'neutral'; securityLevel: 'strict'; htmlLabels: false }) => void;
  parse: (code: string) => Promise<unknown>;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

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

  const pending = new Set(nodes);
  const inFlight = new WeakSet<HTMLElement>();
  let observer: IntersectionObserver | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let runtimePromise: Promise<MermaidRuntime> | null = null;
  let configuredPromise: Promise<MermaidRuntime> | null = null;
  let runtime: MermaidRuntime | null = null;
  let initialized = false;
  let cleanedUp = false;
  let recheckHandle: number | undefined;
  const recheckQueue = new Set<HTMLElement>();

  const cleanup = (): void => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (recheckHandle !== undefined) {
      window.cancelAnimationFrame(recheckHandle);
      recheckHandle = undefined;
    }
    recheckQueue.clear();
    observer?.disconnect();
    resizeObserver?.disconnect();
  };

  const ensureRuntime = async (): Promise<MermaidRuntime> => {
    if (runtime) return runtime;
    if (options?.runtime) {
      runtime = options.runtime;
      return runtime;
    }
    if (!runtimePromise) {
      runtimePromise = import('mermaid').then(({ default: mermaid }) => {
        runtime = mermaid as MermaidRuntime;
        return runtime;
      });
    }
    return runtimePromise;
  };

  const ensureConfigured = async (): Promise<MermaidRuntime> => {
    if (runtime && initialized) return runtime;
    if (!configuredPromise) {
      configuredPromise = (async () => {
        const mermaid = await ensureRuntime();
        if (!initialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: getMermaidTheme(theme),
            securityLevel: 'strict',
            htmlLabels: false,
          });
          await ensureMermaidBootstrap(mermaid);
          initialized = true;
        }
        return mermaid;
      })().catch((error) => {
        configuredPromise = null;
        throw error;
      });
    }
    return configuredPromise;
  };

  const renderOne = async (node: HTMLElement): Promise<'rendered' | 'deferred' | 'failed' | 'aborted'> => {
    if (aborted() || !pending.has(node)) return 'aborted';
    if (inFlight.has(node)) return 'deferred';
    if (!isRenderable(node)) return 'deferred';

    const code = node.dataset.src ?? node.textContent ?? '';
    if (!code.trim()) {
      pending.delete(node);
      observer?.unobserve(node);
      resizeObserver?.unobserve(node);
      return 'failed';
    }

    inFlight.add(node);
    let renderId: string | null = null;
    try {
      const mermaid = await ensureConfigured();
      if (aborted()) return 'aborted';
      renderId = `mermaid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const { svg } = await mermaid.render(renderId, code);
      if (aborted()) return 'aborted';
      node.innerHTML = sanitizeMermaidSvg(svg);
      pending.delete(node);
      observer?.unobserve(node);
      resizeObserver?.unobserve(node);
      return 'rendered';
    } catch {
      pending.delete(node);
      observer?.unobserve(node);
      resizeObserver?.unobserve(node);
      return 'failed';
    } finally {
      if (renderId) {
        document.getElementById(`d${renderId}`)?.remove();
      }
      inFlight.delete(node);
    }
  };

  const handleVisibilityChange = (): void => {
    recheckPending();
  };

  const handleResize = (entries: ResizeObserverEntry[]): void => {
    recheckPending(entries.map((entry) => entry.target as HTMLElement));
  };

  const recheckPending = (candidates: Iterable<HTMLElement> = pending): void => {
    if (cleanedUp || !pending.size) return;
    for (const node of candidates) {
      recheckQueue.add(node);
    }
    if (recheckHandle !== undefined) return;
    recheckHandle = window.requestAnimationFrame(() => {
      recheckHandle = undefined;
      const queued = Array.from(recheckQueue);
      recheckQueue.clear();
      const visible = queued.filter((node) => pending.has(node) && isRenderable(node));
      void (async () => {
        for (const node of visible) {
          await renderOne(node);
        }
        if (!pending.size) cleanup();
      })();
    });
  };

  if (typeof IntersectionObserver === 'function') {
    observer = new IntersectionObserver((entries) => {
      void Promise.all(entries.map(async (entry) => {
        if (!entry.isIntersecting) return;
        const result = await renderOne(entry.target as HTMLElement);
        if (result === 'rendered' || result === 'failed') return;
        if (result === 'deferred') observer?.observe(entry.target as HTMLElement);
      })).then(() => {
        if (!pending.size) cleanup();
      });
    });
  }

  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(handleResize);
    for (const node of nodes) {
      resizeObserver.observe(node);
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange);
  options?.signal?.addEventListener('abort', cleanup, { once: true });

  for (const node of nodes) {
    const result = await renderOne(node);
    if (result === 'deferred') observer?.observe(node);
  }

  if (!pending.size) cleanup();
}
