import { marked, Renderer } from 'marked';
import markedFootnote from 'marked-footnote';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import makefile from 'highlight.js/lib/languages/makefile';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import shell from 'highlight.js/lib/languages/shell';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import type { TocEntry } from './types.js';
import {
  createHeadingSlugAllocator,
  stripFrontMatter,
  headingSlugInput,
  headingDisplayText,
  extractTocFromDom,
} from './toc.js';

/** Curated highlight.js grammars (core build); `bash` before `shell` (shell session embeds bash). */
const HIGHLIGHT_LANGUAGES: Array<[string, any]> = [
  ['bash', bash],
  ['c', c],
  ['cpp', cpp],
  ['csharp', csharp],
  ['css', css],
  ['diff', diff],
  ['dockerfile', dockerfile],
  ['go', go],
  ['java', java],
  ['javascript', javascript],
  ['json', json],
  ['kotlin', kotlin],
  ['makefile', makefile],
  ['markdown', markdown],
  ['php', php],
  ['python', python],
  ['ruby', ruby],
  ['rust', rust],
  ['scss', scss],
  ['shell', shell],
  ['sql', sql],
  ['swift', swift],
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
  docker: 'dockerfile',
  mk: 'makefile',
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

export interface MarkdownResult {
  html: string;
  toc: TocEntry[];
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
      html += `<dt>${escapeHtml(term)}</dt>\n`;
      for (const def of defs) html += `<dd>${escapeHtml(def)}</dd>\n`;
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

function parseMarkdownDocument(markdown: string): MarkdownResult {
  configureMarked();
  const toc: TocEntry[] = [];
  const nextSlug = createHeadingSlugAllocator();
  const baseRenderer = marked.defaults.renderer;
  if (!baseRenderer) {
    return {
      html: `<p style="color:var(--muted)">Could not render markdown: renderer not configured</p>`,
      toc: [],
    };
  }
  const renderer = Object.assign(Object.create(Object.getPrototypeOf(baseRenderer)), baseRenderer);
  renderer.heading = function (text: string, level: number, raw?: string): string {
    const plain = headingSlugInput(text, raw);
    const slug = nextSlug(plain);
    toc.push({ id: slug, level, text: headingDisplayText(text, raw) });
    return `<h${level} id="${slug}">${text}</h${level}>\n`;
  };
  try {
    const html = marked.parse(stripFrontMatter(markdown), { renderer }) as string;
    return { html, toc };
  } catch (e) {
    return {
      html: `<p style="color:var(--muted)">Could not render markdown: ${escapeHtml((e as Error).message)}</p>`,
      toc: [],
    };
  }
}

export function renderMarkdownWithMeta(markdown: string): MarkdownResult {
  return parseMarkdownDocument(markdown);
}

export function renderMarkdown(markdown: string): string {
  return parseMarkdownDocument(markdown).html;
}

export function extractToc(source: string | Element): TocEntry[] {
  if (typeof source === 'string') return parseMarkdownDocument(source).toc;
  return extractTocFromDom(source);
}

