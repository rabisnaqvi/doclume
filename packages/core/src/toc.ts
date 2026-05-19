import type { TocEntry } from './types.js';

export function stripFrontMatter(markdown: string): string {
  return markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

export function slugifyHeading(text: string): string {
  return String(text).toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

const EMPTY_SLUG_FALLBACK = 'heading';

/**
 * Heading ids in document order: first `foo`, then `foo-1`, `foo-2`, … (GitHub-style).
 */
export function createHeadingSlugAllocator(): (plainHeadingText: string) => string {
  const counts = new Map<string, number>();
  return (plainHeadingText: string) => {
    const slug = slugifyHeading(plainHeadingText);
    const base = slug.length > 0 ? slug : EMPTY_SLUG_FALLBACK;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    if (n === 1) return base;
    return `${base}-${n - 1}`;
  };
}

const HEADING_MARKDOWN_PREFIX = /^#{1,6}\s+/;

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** Plain text used for heading slug ids (must match between TOC and render). */
export function headingSlugInput(text: string, raw?: string): string {
  let plain = String(raw ?? text);
  plain = plain.replace(HEADING_MARKDOWN_PREFIX, '');
  plain = stripHtmlTags(plain);
  return plain.trim();
}

/** Sidebar-safe heading label without HTML or `#` markers. */
export function headingDisplayText(text: string, raw?: string): string {
  if (raw !== undefined && raw !== '') {
    return String(raw).replace(HEADING_MARKDOWN_PREFIX, '').trim();
  }
  return stripHtmlTags(String(text)).trim();
}

export function extractTocFromDom(source: Element): TocEntry[] {
  if (!source) return [];
  return Array.from(source.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
    id: h.id,
    level: Number(h.tagName[1]),
    text: h.textContent ?? '',
  }));
}
