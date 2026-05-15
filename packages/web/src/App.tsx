import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { marked } from 'marked';
import {
  THEMES,
  configureMarked,
  escapeHtml,
  extractToc,
  estimateReadingTime,
  type Theme,
  type ThemeId,
  type TocEntry,
  type DocState,
  type Prefs,
} from '@doclume/core';
import '@doclume/core/css/themes.css';
import '@doclume/core/css/markdown.css';

const PREFS_KEY = 'doclume-prefs-v1';
const DOC_KEY = 'doclume-last-doc-v1';

/* ---------- Persistence ---------- */

function loadPrefs(): Prefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : null;
  } catch (_) { return null; }
}

function savePrefs(prefs: Prefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

/** First visit / no saved theme: follow browser light (library) vs dark (lamplight). */
function preferredThemeFromBrowserScheme(): ThemeId {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'library';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'lamplight' : 'library';
}

function readStoredTheme(): ThemeId | null {
  try {
    const prefs = loadPrefs();
    if (!prefs?.theme) return null;
    const migrate: Record<string, ThemeId> = { paper: 'library', ivory: 'manual', dusk: 'lamplight', carbon: 'console' };
    const mapped = migrate[prefs.theme] ?? prefs.theme;
    const valid = THEMES.find((t) => t.id === mapped);
    return valid ? (mapped as ThemeId) : null;
  } catch (_) {
    return null;
  }
}

function loadLastDoc(): DocState | null {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    return raw ? (JSON.parse(raw) as DocState) : null;
  } catch (_) { return null; }
}

function saveLastDoc(doc: DocState): void {
  try { localStorage.setItem(DOC_KEY, JSON.stringify(doc)); } catch (_) {}
}

/* ---------- Search ---------- */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearHighlights(root: Element): void {
  if (!root) return;
  root.querySelectorAll('mark[data-search-hit]').forEach((m) => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    (parent as Element).normalize();
  });
}

function highlightMatches(root: Element, query: string): HTMLElement[] {
  if (!root || !query) return [];
  const matches: HTMLElement[] = [];
  const re = new RegExp(escapeRegExp(query), 'gi');

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      let p = node.parentNode;
      while (p && p !== root) {
        if (['SCRIPT', 'STYLE', 'MARK'].includes((p as Element).nodeName)) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return re.test(node.nodeValue!) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const candidates: Node[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) candidates.push(n);

  candidates.forEach((node) => {
    const text = node.nodeValue!;
    const localRe = new RegExp(escapeRegExp(query), 'gi');
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    const frag = document.createDocumentFragment();
    while ((m = localRe.exec(text)) !== null) {
      if (m.index > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      const mark = document.createElement('mark');
      mark.dataset.searchHit = '';
      mark.textContent = m[0];
      frag.appendChild(mark);
      matches.push(mark);
      lastIndex = m.index + m[0].length;
      if (m[0].length === 0) localRe.lastIndex++;
    }
    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    node.parentNode!.replaceChild(frag, node);
  });

  return matches;
}

/* ---------- Icons ---------- */

const iconPaths: Record<string, React.ReactNode> = {
  file: <><path d="M14 3v5h5" /><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l7 7v9a2 2 0 0 1-2 2Z" /></>,
  paste: <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  focus: <><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3" /></>,
  check: <path d="m4 12 5 5L20 6" />,
  arrowUp: <path d="m6 14 6-6 6 6" />,
  arrowDown: <path d="m6 10 6 6 6-6" />,
  close: <><path d="M6 6 18 18" /><path d="m18 6-12 12" /></>,
  book: <><path d="M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2Z" /><path d="M4 19a2 2 0 0 1 2-2h12" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  hash: <><path d="M4 9h16" /><path d="M4 15h16" /><path d="M10 3 8 21" /><path d="M16 3l-2 18" /></>,
  type: <><path d="M4 7V5h16v2" /><path d="M9 19h6" /><path d="M12 5v14" /></>,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
};

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="btn__icon"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

/* ---------- Theme switcher ---------- */

function ThemeSwitcher({ theme, onChange }: { theme: ThemeId; onChange: (id: ThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  const groups = useMemo(() => {
    const m = new Map<string, Theme[]>();
    THEMES.forEach((t) => {
      if (!m.has(t.use)) m.set(t.use, []);
      m.get(t.use)!.push(t);
    });
    return Array.from(m.entries());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="theme-switch" ref={ref}>
      <button
        className="btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Change theme"
      >
        <span
          className="theme-swatch"
          style={{ width: 18, height: 18, borderRadius: 6, background: current.swatchBg, color: current.swatchFg, fontSize: 9, fontWeight: 600 }}
        >
          Aa
        </span>
        <span>{current.name}</span>
      </button>
      {open && (
        <div className="theme-menu" role="menu">
          {groups.map(([groupName, list], gi) => (
            <React.Fragment key={groupName}>
              <div className="theme-menu__group">{groupName}</div>
              {list.map((t) => (
                <button
                  key={t.id}
                  role="menuitemradio"
                  aria-current={t.id === theme}
                  className="theme-option"
                  onClick={() => { onChange(t.id); setOpen(false); }}
                >
                  <span
                    className="theme-swatch"
                    style={{ background: t.swatchBg, color: t.swatchFg, fontFamily: t.fontPreview, boxShadow: `inset 0 0 0 2px ${t.swatchAccent}33` }}
                  >
                    {t.letter}
                  </span>
                  <span className="theme-option__meta">
                    <span className="theme-option__name">{t.name}</span>
                    <span className="theme-option__desc">{t.description}</span>
                  </span>
                  <span className="theme-option__check">
                    <Icon name="check" size={14} />
                  </span>
                </button>
              ))}
              {gi < groups.length - 1 && <div className="theme-menu__divider" />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Topbar ---------- */

interface TopbarProps {
  docName: string;
  hasDocument: boolean;
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  onOpen: () => void;
  onPaste: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchCount: number;
  searchIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onFocus: () => void;
  onHome: () => void;
}

function Topbar({
  docName, hasDocument, theme, onTheme, onOpen, onPaste,
  searchQuery, onSearchChange, searchCount, searchIndex, onPrev, onNext,
  onFocus, onHome,
}: TopbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasDocument) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hasDocument]);

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button type="button" className="brand brand--button" onClick={onHome} title="Back to start" aria-label="Back to start">
          <span className="brand__mark">D</span>
          <span className="brand__title">Doclume</span>
        </button>
        {docName && (
          <span className="brand__crumb">
            <span className="brand__sep">/</span>
            <span className="brand__doc" title={docName}>{docName}</span>
          </span>
        )}
      </div>

      {hasDocument && (
        <div className="topbar__center">
          <div className="search">
            <Icon name="search" size={14} />
            <input
              ref={searchRef}
              className="search__input"
              type="search"
              placeholder="Find in document…"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? onPrev() : onNext(); }
                if (e.key === 'Escape') { e.currentTarget.blur(); onSearchChange(''); }
              }}
            />
            {searchQuery && (
              <span className="search__count">
                {searchCount === 0 ? '0' : `${searchIndex + 1} / ${searchCount}`}
              </span>
            )}
            <button className="search__nav" onClick={onPrev} disabled={!searchCount} aria-label="Previous match" title="Previous (⇧⏎)">
              <Icon name="arrowUp" size={12} />
            </button>
            <button className="search__nav" onClick={onNext} disabled={!searchCount} aria-label="Next match" title="Next (⏎)">
              <Icon name="arrowDown" size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="topbar__right">
        <button className="btn btn--ghost btn--collapsible" onClick={onOpen} title="Open .md file (⌘O)">
          <Icon name="file" size={14} /> <span className="btn--collapsible-label">Open</span>
        </button>
        <button className="btn btn--ghost btn--collapsible" onClick={onPaste} title="Paste markdown">
          <Icon name="paste" size={14} /> <span className="btn--collapsible-label">Paste</span>
        </button>
        <ThemeSwitcher theme={theme} onChange={onTheme} />
        <button className="btn btn--focus" onClick={onFocus} title="Focus mode (⌘⇧F)">
          <Icon name="focus" size={14} /> <span>Focus</span>
        </button>
      </div>
    </header>
  );
}

/* ---------- Sidebar TOC ---------- */

interface SidebarProps {
  toc: TocEntry[];
  activeId: string;
  onJump: (id: string) => void;
  onCollapse: () => void;
}

function Sidebar({ toc, activeId, onJump, onCollapse }: SidebarProps) {
  if (!toc.length) return null;
  return (
    <aside className="sidebar" aria-label="Table of contents">
      <div className="sidebar__head">
        <p className="sidebar__eyebrow">Contents</p>
        <button type="button" className="sidebar__collapse" onClick={onCollapse} title="Hide contents" aria-label="Hide contents">
          <Icon name="chevronLeft" size={14} />
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

function SidebarRail({ onExpand }: { onExpand: () => void }) {
  return (
    <button type="button" className="sidebar-rail" onClick={onExpand} title="Show contents" aria-label="Show contents">
      <Icon name="chevronRight" size={14} />
      <span className="sidebar-rail__label">Contents</span>
    </button>
  );
}

/* ---------- Right rail ---------- */

function Rail({ stats, theme }: { stats: { words: number; minutes: number; headings: number }; theme: ThemeId }) {
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

/* ---------- Empty state ---------- */

function EmptyState({ onOpen, onPaste, onSample }: { onOpen: () => void; onPaste: () => void; onSample: () => void }) {
  return (
    <div className="empty">
      <div className="empty__card">
        <span className="empty__mark">D</span>
        <h1 className="empty__title">Open a document in Doclume.</h1>
        <p className="empty__sub">
          Drop a markdown file into Doclume, open one from disk, or paste raw markdown.
          Doclume remembers your last document, theme, and view settings.
        </p>
        <div className="empty__actions">
          <button className="btn btn--primary" onClick={onOpen}>
            <Icon name="file" size={14} /> Open file
          </button>
          <button className="btn" onClick={onPaste}>
            <Icon name="paste" size={14} /> Paste markdown
          </button>
          <button className="btn btn--ghost" onClick={onSample}>
            <Icon name="book" size={14} /> Try the sample
          </button>
        </div>
        <p className="empty__hint">
          <kbd>⌘O</kbd> open · <kbd>⌘F</kbd> find · <kbd>⌘⇧F</kbd> focus
        </p>
      </div>
    </div>
  );
}

/* ---------- Paste modal ---------- */

function PasteModal({ open, onClose, onRender }: { open: boolean; onClose: () => void; onRender: (text: string) => void }) {
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 60);
    else setText('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); onRender(text); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, text, onClose, onRender]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="paste-title">
        <div className="modal__head">
          <h2 className="modal__title" id="paste-title">Paste markdown</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            <Icon name="close" size={14} />
          </button>
        </div>
        <div className="modal__body">
          <textarea
            ref={ref}
            className="modal__textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"# Paste your markdown here…\n\nAnything in CommonMark + GFM works."}
            spellCheck={false}
          />
        </div>
        <div className="modal__foot">
          <span className="modal__foot-hint"><kbd>⌘↵</kbd> to render</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn--primary" onClick={() => onRender(text)} disabled={!text.trim()}>
              Render
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- App ---------- */

export function App() {
  const [doc, setDoc] = useState<DocState>({ markdown: '', name: '' });
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme() ?? preferredThemeFromBrowserScheme());
  const [focusMode, setFocusMode] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  const [searchIndex, setSearchIndex] = useState(-1);
  const searchMatchesRef = useRef<HTMLElement[]>([]);

  const [toc, setToc] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState('');
  const contentRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    configureMarked();
    const prefs = loadPrefs();
    if (typeof prefs?.sidebarCollapsed === 'boolean') setSidebarCollapsed(prefs.sidebarCollapsed);
    const last = loadLastDoc();
    if (last?.markdown) setDoc({ markdown: last.markdown, name: last.name ?? '' });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const prefs = loadPrefs() ?? ({} as Prefs);
    savePrefs({ ...prefs, theme, sidebarCollapsed });
  }, [theme, sidebarCollapsed]);

  const renderedHtml = useMemo(() => {
    if (!doc.markdown) return '';
    try { return marked.parse(doc.markdown) as string; }
    catch (e) { return `<p style="color:var(--muted)">Could not render markdown: ${escapeHtml((e as Error).message)}</p>`; }
  }, [doc.markdown]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;
    const newToc = extractToc(contentRef.current);
    setToc(newToc);
    setActiveId(newToc[0]?.id ?? '');
    clearHighlights(contentRef.current);
    searchMatchesRef.current = [];
    setSearchCount(0);
    setSearchIndex(-1);
    if (searchQuery) setSearchQuery('');
    if (doc.markdown) saveLastDoc(doc);
  }, [renderedHtml]);

  useEffect(() => {
    if (!contentRef.current) return;
    clearHighlights(contentRef.current);
    searchMatchesRef.current = [];
    const q = searchQuery.trim();
    if (!q) { setSearchCount(0); setSearchIndex(-1); return; }
    const handle = setTimeout(() => {
      const matches = highlightMatches(contentRef.current!, q);
      searchMatchesRef.current = matches;
      setSearchCount(matches.length);
      setSearchIndex(matches.length ? 0 : -1);
    }, 100);
    return () => clearTimeout(handle);
  }, [searchQuery, renderedHtml]);

  useEffect(() => {
    const matches = searchMatchesRef.current;
    matches.forEach((m, i) => {
      if (i === searchIndex) m.dataset.searchHitActive = 'true';
      else delete m.dataset.searchHitActive;
    });
    if (searchIndex >= 0 && matches[searchIndex]) {
      const rect = matches[searchIndex].getBoundingClientRect();
      const inView = rect.top > 100 && rect.bottom < window.innerHeight - 40;
      if (!inView) window.scrollTo({ top: window.scrollY + rect.top - window.innerHeight * 0.3, behavior: 'smooth' });
    }
  }, [searchIndex]);

  useEffect(() => {
    if (!contentRef.current || !toc.length) return;
    const headingEls = toc
      .map((h) => contentRef.current!.querySelector(`#${CSS.escape(h.id)}`))
      .filter(Boolean) as Element[];

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
        else visible.delete(e.target.id);
      });
      let best: string | null = null, bestTop = Infinity;
      visible.forEach((_, id) => {
        const el = contentRef.current!.querySelector(`#${CSS.escape(id)}`);
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top < bestTop) { bestTop = top; best = id; }
      });
      if (best) { setActiveId(best); return; }
      let cand = toc[0]?.id ?? '', candTop = -Infinity;
      headingEls.forEach((el) => {
        const top = el.getBoundingClientRect().top;
        if (top < 120 && top > candTop) { candTop = top; cand = el.id; }
      });
      setActiveId(cand);
    }, { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.5, 1] });

    headingEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [toc]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusMode((f) => !f);
      }
      if (e.key === 'Escape' && focusMode) setFocusMode(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [focusMode]);

  useEffect(() => {
    let counter = 0;
    const onDragEnter = (e: DragEvent) => { e.preventDefault(); counter++; if (e.dataTransfer?.types?.includes('Files')) setDragActive(true); };
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); if (--counter <= 0) { setDragActive(false); counter = 0; } };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => { e.preventDefault(); setDragActive(false); counter = 0; const f = e.dataTransfer?.files?.[0]; if (f) readFile(f); };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  useEffect(() => { document.body.classList.toggle('is-focus', focusMode); }, [focusMode]);

  const readFile = useCallback(async (file: File) => {
    try { setDoc({ markdown: await file.text(), name: file.name }); }
    catch (err) { console.error('Failed to read file', err); }
  }, []);

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch('/sample.md');
      if (!res.ok) throw new Error('Could not load sample');
      setDoc({ markdown: await res.text(), name: 'sample.md' });
    } catch (e) { console.error(e); }
  }, []);

  const goHome = useCallback(() => {
    setDoc({ markdown: '', name: '' });
    setSearchQuery('');
    setToc([]);
    setActiveId('');
    try { localStorage.removeItem(DOC_KEY); } catch (_) {}
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const renderPasted = useCallback((text: string) => {
    if (!text.trim()) return;
    setDoc({ markdown: text, name: 'Pasted markdown' });
    setPasteOpen(false);
  }, []);

  const jumpToHeading = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (!el) return;
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 76, behavior: 'smooth' });
    setActiveId(id);
  }, []);

  const onPrev = useCallback(() => {
    if (searchCount) setSearchIndex((i) => (i - 1 + searchCount) % searchCount);
  }, [searchCount]);

  const onNext = useCallback(() => {
    if (searchCount) setSearchIndex((i) => (i + 1) % searchCount);
  }, [searchCount]);

  const stats = useMemo(() => {
    const r = estimateReadingTime(doc.markdown);
    return { ...r, headings: toc.length };
  }, [doc.markdown, toc]);

  const showSidebar = !focusMode && toc.length > 0 && !sidebarCollapsed;

  return (
    <div className="app">
      {!focusMode && (
        <Topbar
          docName={doc.name}
          hasDocument={Boolean(doc.markdown)}
          theme={theme}
          onTheme={setTheme}
          onOpen={() => fileInputRef.current?.click()}
          onPaste={() => setPasteOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchCount={searchCount}
          searchIndex={searchIndex}
          onPrev={onPrev}
          onNext={onNext}
          onFocus={() => setFocusMode(true)}
          onHome={goHome}
        />
      )}

      {focusMode && (
        <button className="btn btn--ghost focus-exit" onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)">
          <Icon name="close" size={14} /> Exit focus
        </button>
      )}

      {doc.markdown ? (
        <div className={`workspace ${!showSidebar ? 'workspace--no-toc' : ''}`}>
          {showSidebar && (
            <Sidebar toc={toc} activeId={activeId} onJump={jumpToHeading} onCollapse={() => setSidebarCollapsed(true)} />
          )}
          {!showSidebar && toc.length > 0 && !focusMode && (
            <SidebarRail onExpand={() => setSidebarCollapsed(false)} />
          )}
          <main className="reader">
            {!focusMode && (
              <div className="reader__header">
                <strong>{doc.name || 'Untitled'}</strong>
                <span className="reader__dot" />
                <span>{stats.minutes} min read</span>
                <span className="reader__dot" />
                <span>{stats.words.toLocaleString()} words</span>
              </div>
            )}
            <article ref={contentRef} className="markdown" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          </main>
          {!focusMode && showSidebar && <Rail stats={stats} theme={theme} />}
        </div>
      ) : (
        <EmptyState onOpen={() => fileInputRef.current?.click()} onPaste={() => setPasteOpen(true)} onSample={loadSample} />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkdn,.txt,text/markdown,text/plain"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readFile(f); }}
      />

      <PasteModal open={pasteOpen} onClose={() => setPasteOpen(false)} onRender={renderPasted} />

      {dragActive && (
        <div className="drop-overlay">
          <div className="drop-overlay__inner">Drop your markdown file to open</div>
        </div>
      )}
    </div>
  );
}
