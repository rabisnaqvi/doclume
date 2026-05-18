import { useState, useEffect, useRef, useReducer, useMemo } from 'react';
import { configureMarked, renderMarkdown, extractToc, getMermaidTheme, MATH_READY_EVENT, type ThemeId, type TocEntry, type WebviewMessage, type HostMessage } from '@doclume/core';
import '@doclume/core/css/themes.css';
import '@doclume/core/css/markdown.css';
import './fonts.css';

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

declare global {
  interface Window {
    __DOCLUME_INIT__?: { markdown: string; name: string; theme: ThemeId };
  }
}

// Tracks whether mermaid parsers have been warmed up this session.
// Avoids re-running the warmup on every re-render (theme change, edit).
let mermaidReady = false;

function readInit() {
  return typeof window !== 'undefined' ? window.__DOCLUME_INIT__ : undefined;
}

export function Viewer() {
  const init = readInit();

  const [markdown, setMarkdown] = useState(init?.markdown ?? '');
  const [docName, setDocName] = useState(init?.name ?? '');
  const [theme, setTheme] = useState<ThemeId>(init?.theme ?? 'manual');
  const [toc, setToc] = useState<TocEntry[]>([]);
  const [mathVersion, bumpMathVersion] = useReducer((v: number) => v + 1, 0);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    configureMarked();

    // Apply initial theme to <html> (extension also sets data-theme on the element,
    // but doing it here avoids a flash if init data is present).
    if (init?.theme) document.documentElement.dataset.theme = init.theme;

    const handler = (event: MessageEvent<WebviewMessage>) => {
      const msg = event.data;
      if (msg.type === 'update') {
        setMarkdown(msg.markdown);
        setDocName(msg.name);
      } else if (msg.type === 'theme') {
        document.documentElement.dataset.theme = msg.id;
        setTheme(msg.id);
      }
    };

    window.addEventListener('message', handler);

    const ready: HostMessage = { type: 'ready' };
    vscode?.postMessage(ready);

    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const onMathReady = () => bumpMathVersion();
    window.addEventListener(MATH_READY_EVENT, onMathReady);
    return () => window.removeEventListener(MATH_READY_EVENT, onMathReady);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setToc(extractToc(contentRef.current));
    }
  }, [markdown]);

  const renderedHtml = useMemo(() => (markdown ? renderMarkdown(markdown) : ''), [markdown, mathVersion]);

  useEffect(() => {
    const nodes = Array.from(
      contentRef.current?.querySelectorAll<HTMLElement>('.mermaid') ?? []
    );
    if (!nodes.length) return;
    let cancelled = false;
    import('mermaid').then(async ({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme(theme), securityLevel: 'loose' });
      if (!mermaidReady) {
        await Promise.allSettled(
          nodes.map((node) => {
            const code = node.dataset.src ?? node.textContent ?? '';
            return code.trim() ? mermaid.parse(code) : Promise.resolve();
          })
        );
        mermaidReady = true;
      }
      if (cancelled) return;
      for (let i = 0; i < nodes.length; i++) {
        if (cancelled) return;
        const node = nodes[i];
        const code = node.dataset.src ?? node.textContent ?? '';
        if (!code.trim()) continue;
        const renderId = `mermaid-${i}-${Date.now()}`;
        try {
          const { svg, bindFunctions } = await mermaid.render(renderId, code);
          if (cancelled) return;
          node.innerHTML = svg;
          bindFunctions?.(node);
        } catch { /* leave raw code on parse error */ }
        finally { document.getElementById(`d${renderId}`)?.remove(); }
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [renderedHtml, theme]);

  if (!markdown) {
    return (
      <div className="vsc-empty">
        <p>Open a <code>.md</code>, <code>.prompt</code>, <code>.instructions</code>, <code>.chatagent</code>, or <code>.skill</code> file and click <strong>Open in Doclume</strong> to preview it here.</p>
      </div>
    );
  }

  return (
    <div className="vsc-viewer">
      <article
        ref={contentRef}
        className="markdown"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
