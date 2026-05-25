import React, { useState, useEffect, useRef } from 'react';
import {
  THEMES,
  renderDocument,
  type ThemeId,
  type WebviewMessage,
  type HostMessage,
} from '@doclume/core';
import '@doclume/core/css/themes.css';
import '@doclume/core/css/markdown.css';
import './fonts.css';

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

declare global {
  interface Window {
    __DOCLUME_INIT__?: { markdown: string; theme: ThemeId };
  }
}

function readInit() {
  return typeof window !== 'undefined' ? window.__DOCLUME_INIT__ : undefined;
}

export function Viewer() {
  const init = readInit();

  const [markdown, setMarkdown] = useState(init?.markdown ?? '');
  const [theme, setTheme] = useState<ThemeId>(init?.theme ?? 'manual');
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Apply initial theme to <html> (extension also sets data-theme on the element,
    // but doing it here avoids a flash if init data is present).
    if (init?.theme) document.documentElement.dataset.theme = init.theme;

    const handler = (event: MessageEvent<WebviewMessage>) => {
      const msg = event.data;
      if (msg.type === 'update') {
        setMarkdown(msg.markdown);
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
    if (!contentRef.current || !markdown) return;
    const themeObj = THEMES.find((t) => t.id === theme) ?? THEMES[0]!;
    const ac = new AbortController();
    const container = contentRef.current;

    void renderDocument(container, markdown, themeObj, ac.signal).catch((err) => {
      if (ac.signal.aborted) return;
      console.error('Doclume: renderDocument failed', err);
      container.innerHTML = '<p><strong>Render failed.</strong> Open Developer Tools console for details.</p>';
    });

    return () => ac.abort();
  }, [markdown, theme]);

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
      />
    </div>
  );
}
