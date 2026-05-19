export type ThemeId = 'library' | 'lamplight' | 'manual' | 'console' | 'contrast';

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  use: string;
  swatchBg: string;
  swatchFg: string;
  swatchAccent: string;
  fontPreview: string;
  letter: string;
}

export interface TocEntry {
  id: string;
  level: number;
  text: string;
}

export interface DocState {
  markdown: string;
  name: string;
}

export interface ReadingStats {
  words: number;
  minutes: number;
}

export interface Prefs {
  theme: ThemeId;
  sidebarCollapsed: boolean;
}

export type WebviewMessage =
  | { type: 'update'; markdown: string }
  | { type: 'theme'; id: ThemeId };

export type HostMessage = { type: 'ready' };
