import type { TocEntry } from './types.js';

export function extractToc(rootEl: Element): TocEntry[] {
  if (!rootEl) return [];
  return Array.from(rootEl.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => ({
    id: h.id,
    level: Number(h.tagName[1]),
    text: h.textContent ?? '',
  }));
}
