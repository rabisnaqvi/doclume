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
  isLoading?: boolean;
  /** Narrow layout: TOC hidden — inline control to open it (no floating rail) */
  tocTriggerVisible?: boolean;
  onShowToc?: () => void;
  contentRef: RefObject<HTMLElement>;
}

function Rail({ stats, theme, isLoading = false }: { stats: Stats; theme: ThemeId; isLoading?: boolean }) {
  const themeMeta = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  return (
    <aside className={`rail${isLoading ? ' rail--loading' : ''}`} aria-label="Document info" aria-busy={isLoading || undefined}>
      {isLoading ? (
        <>
          <div className="rail__row rail__row--loading"><span className="skeleton skeleton--icon" /><span className="skeleton skeleton--rail-line" /></div>
          <div className="rail__row rail__row--loading"><span className="skeleton skeleton--icon" /><span className="skeleton skeleton--rail-line" /></div>
          <div className="rail__row rail__row--loading"><span className="skeleton skeleton--icon" /><span className="skeleton skeleton--rail-line" /></div>
          <div className="rail__divider" />
          <div className="rail__row rail__row--loading"><span className="skeleton skeleton--icon" /><span className="skeleton skeleton--rail-line rail__row--wide" /></div>
        </>
      ) : (
        <>
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
        </>
      )}
    </aside>
  );
}

function ReaderPaneImpl({
  theme, stats, docName, focusMode, showRail, isLoading = false,
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
            <div className={`reader__header__stats-row${isLoading ? ' reader__header__stats-row--loading' : ''}`} aria-busy={isLoading || undefined}>
              {isLoading ? (
                <>
                  <span className="skeleton skeleton--stat" />
                  <span className="reader__dot" aria-hidden />
                  <span className="skeleton skeleton--stat" />
                </>
              ) : (
                <>
                  <span>{stats.minutes} min read</span>
                  <span className="reader__dot" aria-hidden />
                  <span>{stats.words.toLocaleString()} words</span>
                </>
              )}
            </div>
          </div>
        )}
        <div className={`reader__content${isLoading ? ' reader__content--loading' : ''}`} aria-busy={isLoading || undefined}>
          <div className={`markdown-skeleton${isLoading ? '' : ' markdown-skeleton--hidden'}`} aria-hidden="true">
            <div className="markdown-skeleton__line markdown-skeleton__line--title" />
            <div className="markdown-skeleton__line" />
            <div className="markdown-skeleton__line markdown-skeleton__line--wide" />
            <div className="markdown-skeleton__line" />
            <div className="markdown-skeleton__line markdown-skeleton__line--wide" />
            <div className="markdown-skeleton__line markdown-skeleton__line--narrow" />
          </div>
          <article ref={contentRef} className="markdown" />
        </div>
      </main>
      {!focusMode && showRail && <Rail stats={stats} theme={theme} isLoading={isLoading} />}
    </>
  );
}

export const ReaderPane = memo(ReaderPaneImpl);
