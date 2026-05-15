import type { ReadingStats } from './types.js';

export function estimateReadingTime(markdown: string): ReadingStats {
  const words = (markdown ?? '').trim().split(/\s+/).filter(Boolean).length;
  return { words, minutes: Math.max(1, Math.round(words / 220)) };
}
