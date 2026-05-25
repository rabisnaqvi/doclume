// packages/core/src/index.ts

export { renderDocument } from './renderer.js';

export { extractToc } from './markdown.js';
export { estimateReadingTime } from './stats.js';
export { bootstrapRoot } from './bootstrap.js';
export { THEMES } from './themes.js';

export type {
  ThemeId,
  Theme,
  TocEntry,
  DocState,
  ReadingStats,
  Prefs,
  WebviewMessage,
  HostMessage,
} from './types.js';
