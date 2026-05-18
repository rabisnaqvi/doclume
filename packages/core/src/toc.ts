import { marked } from 'marked';
import type { TocEntry } from './types.js';

function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

export function slugifyHeading(text: string): string {
  return String(text).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

/**
 * Heading ids in document order: first `foo`, then `foo-1`, `foo-2`, … (GitHub-style).
 */
export function createHeadingSlugAllocator(): (plainHeadingText: string) => string {
  const counts = new Map<string, number>();
  return (plainHeadingText: string) => {
    const base = slugifyHeading(plainHeadingText);
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    if (n === 1) return base;
    return `${base}-${n - 1}`;
  };
}

function collectHeadings(tokens: unknown, out: TocEntry[], nextSlug: (plain: string) => string): void {
  if (!Array.isArray(tokens)) return;

  for (const token of tokens as Array<Record<string, unknown>>) {
    if (!token || typeof token !== 'object') continue;
    const heading = token as Record<string, unknown>;

    if (heading.type === 'heading') {
      const plain = String(heading.text ?? heading.raw ?? '');
      out.push({
        id: nextSlug(plain),
        level: Number(heading.depth ?? 1),
        text: String(heading.text ?? ''),
      });
    }

    if (Array.isArray(heading.tokens)) collectHeadings(heading.tokens, out, nextSlug);
    if (Array.isArray(heading.items)) collectHeadings(heading.items, out, nextSlug);
  }
}

function extractFromMarkdown(markdown: string): TocEntry[] {
  const tokens = marked.lexer(stripFrontMatter(markdown));
  const out: TocEntry[] = [];
  collectHeadings(tokens, out, createHeadingSlugAllocator());
  return out;
}

export function extractToc(source: string | Element): TocEntry[] {
  if (typeof source === 'string') return extractFromMarkdown(source);
  if (!source) return [];
  return Array.from(source.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
    id: h.id,
    level: Number(h.tagName[1]),
    text: h.textContent ?? '',
  }));
}
