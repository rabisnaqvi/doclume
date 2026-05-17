import { useState, useEffect, useRef } from 'react';
import { configureMarked, renderMarkdown, extractToc, type ThemeId, type TocEntry, type WebviewMessage, type HostMessage } from '@doclume/core';
import '@doclume/core/css/themes.css';
import '@doclume/core/css/markdown.css';

const vscode = typeof acquireVsCodeApi !== 'undefined' ? acquireVsCodeApi() : null;

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };

export function Viewer() {
  const [markdown, setMarkdown] = useState('');
  const [docName, setDocName] = useState('');
  const [toc, setToc] = useState<TocEntry[]>([]);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    configureMarked();

    const handler = (event: MessageEvent<WebviewMessage>) => {
      const msg = event.data;
      if (msg.type === 'update') {
        setMarkdown(msg.markdown);
        setDocName(msg.name);
      } else if (msg.type === 'theme') {
        document.documentElement.dataset.theme = msg.id;
      }
    };

    window.addEventListener('message', handler);

    // Signal ready to extension host
    const ready: HostMessage = { type: 'ready' };
    vscode?.postMessage(ready);

    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setToc(extractToc(contentRef.current));
    }
  }, [markdown]);

  const renderedHtml = markdown ? renderMarkdown(markdown) : '';

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
