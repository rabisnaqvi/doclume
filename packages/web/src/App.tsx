import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect, useReducer } from 'react';
import {
  THEMES,
  configureMarked,
  renderMarkdownWithMeta,
  renderMermaidDiagrams,
  estimateReadingTime,
  MATH_READY_EVENT,
  type Theme,
  type ThemeId,
  type DocState,
  type Prefs,
} from '@doclume/core';
import '@doclume/core/css/themes.css';
import '@doclume/core/css/markdown.css';
import { DocumentShell } from './components/DocumentShell.js';
import { Icon } from './components/Icon.js';
import { ReaderPane } from './components/ReaderPane.js';
import { Sidebar, SidebarRail } from './components/Sidebar.js';

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
  const q = query.trim();
  if (!root || !q) return [];
  const matches: HTMLElement[] = [];
  const needle = q.toLowerCase();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      let p = node.parentNode;
      while (p && p !== root) {
        if (['SCRIPT', 'STYLE', 'MARK'].includes((p as Element).nodeName)) return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return node.nodeValue!.toLowerCase().includes(needle)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const candidates: Node[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) candidates.push(n);

  candidates.forEach((node) => {
    const text = node.nodeValue!;
    const localRe = new RegExp(escapeRegExp(q), 'gi');
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
        <span className="theme-switch__label">{current.name}</span>
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

/** Viewport matches `query` (syncs on resize). */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useLayoutEffect(() => {
    const media = window.matchMedia(query);
    const handler = () => setMatches(media.matches);
    handler();
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

const MOBILE_SEARCH_MQ = '(max-width: 640px)';
/** Same breakpoint as `.sidebar { position: static }` in app.css */
const STACKED_TOC_MQ = '(max-width: 820px)';

function readInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const prefs = loadPrefs();
  const stacked = window.matchMedia(STACKED_TOC_MQ).matches;
  if (typeof prefs?.sidebarCollapsed === 'boolean') return prefs.sidebarCollapsed;
  return stacked;
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
  const narrowSearchUi = useMediaQuery(MOBILE_SEARCH_MQ);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchPanelOpen = !narrowSearchUi || mobileSearchOpen;

  useEffect(() => {
    if (narrowSearchUi) setMobileSearchOpen(false);
  }, [narrowSearchUi]);

  useEffect(() => {
    if (!hasDocument || !narrowSearchUi || !mobileSearchOpen) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [hasDocument, narrowSearchUi, mobileSearchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!hasDocument) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setMobileSearchOpen(true);
        window.setTimeout(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        }, 0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hasDocument]);

  return (
    <header className={`topbar${narrowSearchUi && !searchPanelOpen ? ' topbar--search-collapsed' : ''}`}>
      <div className="topbar__left">
        <button type="button" className="brand brand--button" onClick={onHome} title="Back to start" aria-label="Back to start">
          <img src="/favicon.svg" className="brand__mark" alt="Doclume"/>
          <span className="brand__title">Doclume</span>
        </button>
        <a
          href="https://github.com/rabisnaqvi/doclume"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--ghost btn--github"
          title="Star on GitHub"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="btn__icon" style={{ stroke: 'none' }}>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10Z" />
          </svg>
          <span>Star</span>
        </a>
        {docName && (
          <span className="brand__crumb">
            <span className="brand__sep">/</span>
            <span className="brand__doc" title={docName}>{docName}</span>
          </span>
        )}
      </div>

      {hasDocument && searchPanelOpen && (
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
                if (e.key === 'Escape') {
                  e.preventDefault();
                  if (searchQuery.trim()) onSearchChange('');
                  else if (narrowSearchUi) setMobileSearchOpen(false);
                  else e.currentTarget.blur();
                }
              }}
            />
            {searchQuery.trim() && (
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
            {narrowSearchUi && (
              <button
                type="button"
                className="search__close"
                onClick={() => { setMobileSearchOpen(false); searchRef.current?.blur(); }}
                aria-label="Close search"
                title="Close"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="topbar__right">
        <div className="topbar__actions-scroll">
          {hasDocument && narrowSearchUi && !searchPanelOpen && (
            <button
              type="button"
              className="btn btn--ghost btn--search-toggle"
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Find in document"
              title="Find in document (⌘F)"
            >
              <Icon name="search" size={14} />
            </button>
          )}
          <button className="btn btn--ghost btn--collapsible" onClick={onOpen} title="Open markdown, text, or prompt-like files (.md, .txt, .prompt, …) (⌘O)">
            <Icon name="file" size={14} /> <span className="btn--collapsible-label">Open</span>
          </button>
          <button className="btn btn--ghost btn--collapsible" onClick={onPaste} title="Paste markdown">
            <Icon name="paste" size={14} /> <span className="btn--collapsible-label">Paste</span>
          </button>
        </div>
        <ThemeSwitcher theme={theme} onChange={onTheme} />
        <button className="btn btn--focus btn--focus-toggle" onClick={onFocus} title="Focus mode (⌘⇧F)">
          <Icon name="focus" size={14} /> <span className="btn--focus-text">Focus</span>
        </button>
      </div>
    </header>
  );
}

/* ---------- Empty state ---------- */

function EmptyState({ onOpen, onPaste, onSample }: { onOpen: () => void; onPaste: () => void; onSample: () => void }) {
  return (
    <div className="empty">
      <div className="empty__card">
        <img src="/favicon.svg" className="empty__mark" alt="Doclume"/>
        <h1 className="empty__title">Open a document in Doclume.</h1>
        <p className="empty__sub">
          Drop or open a markdown or plain-text file (.md, .markdown, .txt, …) or a `.prompt`, `.instructions`, `.chatagent`, or `.skill` file. Or paste raw markdown.
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
        <a
          href="https://github.com/rabisnaqvi/doclume"
          target="_blank"
          rel="noopener noreferrer"
          className="empty__github"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ stroke: 'none', flexShrink: 0 }}>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10Z" />
          </svg>
          Star on GitHub
        </a>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readInitialSidebarCollapsed);
  const stackedTocLayout = useMediaQuery(STACKED_TOC_MQ);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCount, setSearchCount] = useState(0);
  const [searchIndex, setSearchIndex] = useState(-1);
  const searchMatchesRef = useRef<HTMLElement[]>([]);
  const [mathVersion, bumpMathVersion] = useReducer((v: number) => v + 1, 0);

  const [activeId, setActiveId] = useState('');
  const contentRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    configureMarked();
    const last = loadLastDoc();
    if (last?.markdown) setDoc({ markdown: last.markdown, name: last.name ?? '' });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const prefs = loadPrefs() ?? ({} as Prefs);
    savePrefs({ ...prefs, theme, sidebarCollapsed });
  }, [theme, sidebarCollapsed]);

  useEffect(() => {
    const onMathReady = () => bumpMathVersion();
    window.addEventListener(MATH_READY_EVENT, onMathReady);
    return () => window.removeEventListener(MATH_READY_EVENT, onMathReady);
  }, []);

  const { renderedHtml, toc } = useMemo(() => {
    if (!doc.markdown) return { renderedHtml: '', toc: [] };
    const { html, toc: nextToc } = renderMarkdownWithMeta(doc.markdown);
    return { renderedHtml: html, toc: nextToc };
  }, [doc.markdown, mathVersion]);

  useEffect(() => {
    const ac = new AbortController();
    void renderMermaidDiagrams(contentRef.current, theme, { signal: ac.signal });
    return () => ac.abort();
  }, [renderedHtml, theme]);

  useEffect(() => {
    setActiveId(toc[0]?.id ?? '');
    searchMatchesRef.current = [];
    setSearchCount(0);
    setSearchIndex(-1);
    if (searchQuery) setSearchQuery('');
    if (doc.markdown) saveLastDoc(doc);
  }, [doc.markdown, toc]);

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
      .filter(Boolean) as HTMLElement[];
    const headingMap = new Map(headingEls.map((el) => [el.id, el] as const));

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
        else visible.delete(e.target.id);
      });
      let best: string | null = null, bestTop = Infinity;
      visible.forEach((_, id) => {
        const el = headingMap.get(id);
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
  const body = doc.markdown ? (
    <div className={`workspace ${!showSidebar ? 'workspace--no-toc' : ''}`}>
      {showSidebar && (
        <Sidebar
          toc={toc}
          activeId={activeId}
          onJump={jumpToHeading}
          onCollapse={() => setSidebarCollapsed(true)}
          stackedToc={stackedTocLayout}
        />
      )}
      {!showSidebar && toc.length > 0 && !focusMode && !stackedTocLayout && (
        <SidebarRail onExpand={() => setSidebarCollapsed(false)} />
      )}
      <ReaderPane
        renderedHtml={renderedHtml}
        theme={theme}
        stats={stats}
        docName={doc.name}
        focusMode={focusMode}
        showRail={!focusMode && showSidebar}
        tocTriggerVisible={stackedTocLayout && sidebarCollapsed && toc.length > 0}
        onShowToc={() => setSidebarCollapsed(false)}
        contentRef={contentRef}
      />
    </div>
  ) : null;

  return (
    <>
      <DocumentShell
        focusMode={focusMode}
        hasDocument={Boolean(doc.markdown)}
        topbar={
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
        }
        focusExit={
          <button className="btn btn--ghost focus-exit" onClick={() => setFocusMode(false)} title="Exit focus mode (Esc)">
            <Icon name="close" size={14} /> Exit focus
          </button>
        }
        body={body}
        emptyState={<EmptyState onOpen={() => fileInputRef.current?.click()} onPaste={() => setPasteOpen(true)} onSample={loadSample} />}
        footer={
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} Rabis Naqvi</span>
            <span className="app-footer__dot" />
            <span>five themes, zero Comic Sans</span>
            <span className="app-footer__dot" />
            <span>made with AI, not by AI</span>
          </footer>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.mdown,.mkdn,.txt,.prompt,.instructions,.chatagent,.skill,text/markdown,text/plain"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) readFile(f); }}
      />

      <PasteModal open={pasteOpen} onClose={() => setPasteOpen(false)} onRender={renderPasted} />

      {dragActive && (
        <div className="drop-overlay">
          <div className="drop-overlay__inner">Drop a markdown, text, or prompt file to open</div>
        </div>
      )}
    </>
  );
}
