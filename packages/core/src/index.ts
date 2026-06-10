// packages/core/src/index.ts

export { renderDocument } from './renderer.js';

export { bootstrapRoot } from './bootstrap.js';
export { THEMES } from './themes.js';

export type {
  ThemeId,
  Theme,
  TocEntry,
  DocState,
  DocumentRenderResult,
  Prefs,
  WebviewMessage,
  HostMessage,
} from './types.js';
