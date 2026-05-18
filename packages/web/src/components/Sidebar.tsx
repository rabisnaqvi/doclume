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
}

function SidebarImpl({ toc, activeId, onJump, onCollapse, stackedToc }: SidebarProps) {
  if (!toc.length) return null;
  const collapseIcon = stackedToc ? 'chevronUp' : 'chevronLeft';
  return (
    <aside className="sidebar" aria-label="Table of contents">
      <div className="sidebar__head">
        <p className="sidebar__eyebrow">Contents</p>
        <button type="button" className="sidebar__collapse" onClick={onCollapse} title="Hide contents" aria-label="Hide contents">
          <Icon name={collapseIcon} size={14} />
        </button>
      </div>
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
