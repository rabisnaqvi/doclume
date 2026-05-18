import { marked, Renderer } from 'marked';
import markedFootnote from 'marked-footnote';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import type { ThemeId } from './types.js';
import { slugifyHeading } from './toc.js';

const HIGHLIGHT_LANGUAGES: Array<[string, any]> = [
  ['bash', bash],
  ['css', css],
  ['diff', diff],
  ['javascript', javascript],
  ['json', json],
  ['markdown', markdown],
  ['python', python],
  ['typescript', typescript],
  ['xml', xml],
  ['yaml', yaml],
];

for (const [name, language] of HIGHLIGHT_LANGUAGES) {
  hljs.registerLanguage(name, language);
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  html: 'xml',
  xml: 'xml',
  md: 'markdown',
  py: 'python',
};

type KatexRuntime = {
  renderToString: (expression: string, options?: { displayMode?: boolean; throwOnError?: boolean }) => string;
};

let katexRuntime: KatexRuntime | null = null;
let katexPromise: Promise<KatexRuntime> | null = null;

export const MATH_READY_EVENT = 'doclume:math-ready';

function notifyMathReady(): void {
  if (typeof window === 'undefined') return;
  window.setTimeout(() => {
    try {
      window.dispatchEvent(new Event(MATH_READY_EVENT));
    } catch {
      // ignore
    }
  }, 0);
}

async function ensureKatex(): Promise<KatexRuntime> {
  if (katexRuntime) return katexRuntime;
  if (!katexPromise) {
    katexPromise = import('katex').then((mod) => {
      const runtime = ((mod as { default?: KatexRuntime }).default ?? mod) as KatexRuntime;
      katexRuntime = runtime;
      notifyMathReady();
      return runtime;
    }).catch((error) => {
      katexPromise = null;
      throw error;
    });
  }
  return katexPromise;
}

export function escapeHtml(s: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

export function getMermaidTheme(theme: ThemeId): 'dark' | 'neutral' {
  return (theme === 'lamplight' || theme === 'console' || theme === 'contrast') ? 'dark' : 'neutral';
}

/* ── Extensions ── */

const mathBlock = {
  name: 'mathBlock',
  level: 'block' as const,
  start(src: string) { return src.search(/^\$\$/m); },
  tokenizer(src: string) {
    const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (match) return { type: 'mathBlock', raw: match[0], text: match[1].trim() };
  },
  renderer(token: Record<string, unknown>) {
    const text = token.text as string;
    if (!katexRuntime) {
      void ensureKatex().catch(() => {});
      return `<div class="math-block math-pending"><code>${escapeHtml(text)}</code></div>\n`;
    }
    try {
      return `<div class="math-block">${katexRuntime.renderToString(text, { displayMode: true, throwOnError: false })}</div>\n`;
    } catch {
      return `<div class="math-block math-error"><code>${escapeHtml(text)}</code></div>\n`;
    }
  },
};

const mathInline = {
  name: 'mathInline',
  level: 'inline' as const,
  start(src: string) { return src.indexOf('$'); },
  tokenizer(src: string) {
    const match = /^\$([^$\n]+?)\$/.exec(src);
    if (match) return { type: 'mathInline', raw: match[0], text: match[1] };
  },
  renderer(token: Record<string, unknown>) {
    const text = token.text as string;
    if (!katexRuntime) {
      void ensureKatex().catch(() => {});
      return `<span class="math-inline math-pending"><code>${escapeHtml(text)}</code></span>`;
    }
    try {
      return `<span class="math-inline">${katexRuntime.renderToString(text, { throwOnError: false })}</span>`;
    } catch {
      return `<span class="math-inline math-error"><code>${escapeHtml(text)}</code></span>`;
    }
  },
};

interface DeflistItem { term: string; defs: string[] }

const deflist = {
  name: 'deflist',
  level: 'block' as const,
  start(src: string) { return src.search(/^[^\n]+\n:\s/m); },
  tokenizer(src: string) {
    const match = /^((?:[^\n]+\n(?::\s[^\n]*\n?)+)+)/.exec(src);
    if (!match) return;
    const raw = match[0];
    const items: DeflistItem[] = [];
    const lines = raw.split('\n');
    let i = 0;
    while (i < lines.length) {
      const term = lines[i++];
      if (!term) continue;
      const defs: string[] = [];
      while (i < lines.length && lines[i]?.startsWith(': ')) {
        defs.push(lines[i++].slice(2));
      }
      if (defs.length) items.push({ term, defs });
    }
    if (items.length) return { type: 'deflist', raw, items };
  },
  renderer(token: Record<string, unknown>) {
    const items = token.items as DeflistItem[];
    let html = '<dl>\n';
    for (const { term, defs } of items) {
      html += `<dt>${term}</dt>\n`;
      for (const def of defs) html += `<dd>${def}</dd>\n`;
    }
    return html + '</dl>\n';
  },
};

function normalizeLanguage(lang: string | undefined): string | undefined {
  if (!lang) return undefined;
  const lowered = lang.toLowerCase();
  return LANGUAGE_ALIASES[lowered] ?? lowered;
}

function renderCodeBlock(code: string, lang: string | undefined): string {
  if (lang === 'mermaid') {
    const escaped = escapeHtml(code);
    return `<div class="mermaid" data-src="${escaped}">${escaped}</div>\n`;
  }

  const normalized = normalizeLanguage(lang);
  if (normalized && hljs.getLanguage(normalized)) {
    try {
      return `<pre><code class="hljs language-${normalized}">${hljs.highlight(code, { language: normalized, ignoreIllegals: true }).value}</code></pre>\n`;
    } catch {
      // fall through to auto-detection
    }
  }

  try {
    return `<pre><code class="hljs language-${normalized ?? ''}">${hljs.highlightAuto(code).value}</code></pre>\n`;
  } catch {
    return `<pre><code class="hljs language-${normalized ?? ''}">${escapeHtml(code)}</code></pre>\n`;
  }
}

let markedPipelineInitialized = false;

export function configureMarked(): void {
  if (markedPipelineInitialized) return;
  markedPipelineInitialized = true;

  marked.setOptions({ gfm: true, breaks: false });

  const renderer = new Renderer();
  const defaultTable = renderer.table.bind(renderer);

  renderer.heading = function (text: string, level: number): string {
    const slug = slugifyHeading(text);
    return `<h${level} id="${slug}">${text}</h${level}>\n`;
  };

  renderer.code = function (code: string, lang: string | undefined): string {
    return renderCodeBlock(code, lang);
  };

  renderer.table = function (header: string, body: string): string {
    const inner = defaultTable(header, body);
    return `<div class="markdown-table-wrap">\n${inner}</div>\n`;
  };

  marked.use({ renderer, extensions: [mathBlock, mathInline, deflist] });
  marked.use(markedFootnote());
}

export function renderMarkdown(markdown: string): string {
  configureMarked();
  try { return marked.parse(stripFrontMatter(markdown)) as string; }
  catch (e) {
    return `<p style="color:var(--muted)">Could not render markdown: ${escapeHtml((e as Error).message)}</p>`;
  }
}
