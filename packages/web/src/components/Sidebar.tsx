import { memo } from 'react';
import { type TocEntry } from '@doclume/core';
import { Icon } from './Icon.js';

interface SidebarProps {
  toc: TocEntry[];
  activeId: string;
  onJump: (id: string) => void;
  onCollapse: () => void;
  /** Stacked: TOC above content — collapse chevron points up */
  stackedToc: boolean;
  isLoading?: boolean;
}

function SidebarImpl({ toc, activeId, onJump, onCollapse, stackedToc, isLoading = false }: SidebarProps) {
  if (!toc.length && !isLoading) return null;
  const collapseIcon = stackedToc ? 'chevronUp' : 'chevronLeft';
  return (
    <aside className={`sidebar${isLoading ? ' sidebar--loading' : ''}`} aria-label="Table of contents" aria-busy={isLoading || undefined}>
      <div className="sidebar__head">
        <p className="sidebar__eyebrow">{isLoading ? <span className="skeleton skeleton--text skeleton--eyebrow" /> : 'Contents'}</p>
        {!isLoading && (
          <button type="button" className="sidebar__collapse" onClick={onCollapse} title="Hide contents" aria-label="Hide contents">
            <Icon name={collapseIcon} size={14} />
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="toc toc--loading" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <div className={`toc__skeleton toc__skeleton--${(i % 3) + 1}`} key={i} />
          ))}
        </div>
      ) : (
        <ul className="toc">
          {toc.map((item) => (
            <li key={item.id} className={`toc__item toc__item--l${item.level}`}>
              <a
                className="toc__link"
                href={`#${item.id}`}
                data-active={item.id === activeId}
                onClick={(e) => { e.preventDefault(); onJump(item.id); }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export const Sidebar = memo(SidebarImpl);

export function SidebarRail({ onExpand }: { onExpand: () => void }) {
  return (
    <button type="button" className="sidebar-rail" onClick={onExpand} title="Show contents" aria-label="Show contents">
      <Icon name="chevronRight" size={14} />
      <span className="sidebar-rail__label">Contents</span>
    </button>
  );
}
