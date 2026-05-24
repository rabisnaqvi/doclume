// packages/core/src/index.ts

// Public rendering API — one function owns the lifecycle
export { renderDocument } from './renderer.js';

// Document utilities
export { extractToc } from './markdown.js';
export { estimateReadingTime } from './stats.js';
export { bootstrapRoot } from './bootstrap.js';

// Theme catalogue
export { THEMES } from './themes.js';

// Types
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
