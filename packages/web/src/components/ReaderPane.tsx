import { memo, type RefObject } from 'react';
import { THEMES, type ThemeId } from '@doclume/core';
import { Icon } from './Icon.js';

interface Stats {
  words: number;
  minutes: number;
  headings: number;
}

interface ReaderPaneProps {
  theme: ThemeId;
  stats: Stats;
  docName: string;
  focusMode: boolean;
  showRail: boolean;
  /** Narrow layout: TOC hidden — inline control to open it (no floating rail) */
  tocTriggerVisible?: boolean;
  onShowToc?: () => void;
  contentRef: RefObject<HTMLElement>;
}

function Rail({ stats, theme }: { stats: Stats; theme: ThemeId }) {
  const themeMeta = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  return (
    <aside className="rail" aria-label="Document info">
      <div className="rail__row">
        <Icon name="clock" size={14} />
        <span><span className="rail__num">{stats.minutes}</span> min read</span>
      </div>
      <div className="rail__row">
        <Icon name="type" size={14} />
        <span><span className="rail__num">{stats.words.toLocaleString()}</span> words</span>
      </div>
      <div className="rail__row">
        <Icon name="hash" size={14} />
        <span><span className="rail__num">{stats.headings}</span> sections</span>
      </div>
      <div className="rail__divider" />
      <div className="rail__row">
        <span
          className="theme-swatch"
          style={{ width: 14, height: 14, borderRadius: 4, background: themeMeta.swatchBg, color: themeMeta.swatchFg, fontSize: 7 }}
        >
          A
        </span>
        <span>{themeMeta.name}</span>
      </div>
    </aside>
  );
}

function ReaderPaneImpl({
  theme, stats, docName, focusMode, showRail,
  tocTriggerVisible = false, onShowToc, contentRef,
}: ReaderPaneProps) {
  return (
    <>
      <main className="reader">
        {!focusMode && (
          <div className="reader__header">
            <div className="reader__header__title-row">
              <strong className="reader__filename" title={docName || 'Untitled'}>
                {docName || 'Untitled'}
              </strong>
              {tocTriggerVisible && onShowToc && (
                <button
                  type="button"
                  className="reader__toc-btn btn btn--ghost"
                  onClick={onShowToc}
                  title="Show table of contents"
                  aria-label="Show table of contents"
                >
                  <Icon name="chevronDown" size={14} />
                  <span>Contents</span>
                </button>
              )}
            </div>
            <div className="reader__header__stats-row">
              <span>{stats.minutes} min read</span>
              <span className="reader__dot" aria-hidden />
              <span>{stats.words.toLocaleString()} words</span>
            </div>
          </div>
        )}
        <article ref={contentRef} className="markdown" />
      </main>
      {!focusMode && showRail && <Rail stats={stats} theme={theme} />}
    </>
  );
}

export const ReaderPane = memo(ReaderPaneImpl);
