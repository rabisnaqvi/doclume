import { marked, Renderer } from 'marked';
import hljs from 'highlight.js';

export function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

const slugify = (text: string): string =>
  String(text).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

export function configureMarked(): void {
  marked.setOptions({ gfm: true, breaks: false });

  const renderer = new Renderer();

  renderer.heading = function (text: string, level: number, raw: string): string {
    const slug = slugify(raw);
    return `<h${level} id="${slug}">${text}</h${level}>\n`;
  };

  renderer.code = function (code: string, lang: string | undefined): string {
    let highlighted = code;
    if (lang && hljs.getLanguage(lang)) {
      try { highlighted = hljs.highlight(code, { language: lang }).value; }
      catch (_) { highlighted = hljs.highlightAuto(code).value; }
    } else {
      try { highlighted = hljs.highlightAuto(code).value; }
      catch (_) { highlighted = escapeHtml(code); }
    }
    return `<pre><code class="hljs language-${lang ?? ''}">${highlighted}</code></pre>\n`;
  };

  marked.use({ renderer });
}

export function renderMarkdown(markdown: string): string {
  try { return marked.parse(markdown) as string; }
  catch (e) {
    return `<p style="color:var(--muted)">Could not render markdown: ${escapeHtml((e as Error).message)}</p>`;
  }
}
