# Mermaid Visibility-Aware Render Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Mermaid diagrams correctly on first open by deferring hidden diagrams until they become visible, without re-rendering the whole document.

**Architecture:** Keep Mermaid handling in `@doclume/core`. `renderMermaidDiagrams()` will render already-visible `.mermaid` nodes immediately, attach visibility observers for hidden nodes, and use a small visibility/resize fallback when the browser/tab activation timing is awkward. Web and VS Code keep calling the same shared helper after HTML injection.

**Tech Stack:** TypeScript, React, Mermaid, IntersectionObserver, ResizeObserver, Vitest, Playwright.

---

### Task 1: Make shared Mermaid rendering visibility-aware

**Files:**
- Modify: `packages/core/src/mermaid.ts`
- Create: `tests/core/mermaid.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderMermaidDiagrams } from '@doclume/core';

const mermaidModule = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(async () => undefined),
  render: vi.fn(async (_id: string, code: string) => ({
    svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${code}</text></svg>`,
  })),
}));

vi.mock('mermaid', () => ({
  default: mermaidModule,
}));

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe = (el: Element) => { this.observed.add(el); };
  unobserve = (el: Element) => { this.observed.delete(el); };
  disconnect = () => { this.observed.clear(); };
  trigger(el: Element, isIntersecting: boolean) {
    this.callback([
      {
        target: el,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
      } as IntersectionObserverEntry,
    ], this as unknown as IntersectionObserver);
  }
}

describe('renderMermaidDiagrams', () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    mermaidModule.initialize.mockClear();
    mermaidModule.parse.mockClear();
    mermaidModule.render.mockClear();
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as any).IntersectionObserver;
  });

  it('renders visible nodes immediately and defers hidden nodes', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const node = root?.querySelector('.mermaid') as HTMLElement;
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10,
      width: 10, height: 10, toJSON() {},
    });

    await renderMermaidDiagrams(root, 'manual');

    expect(mermaidModule.render).toHaveBeenCalledTimes(1);
    expect(node.innerHTML).toContain('<svg');
  });

  it('waits for intersection before rendering hidden nodes', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const node = root?.querySelector('.mermaid') as HTMLElement;
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0, toJSON() {},
    });

    await renderMermaidDiagrams(root, 'manual');
    expect(mermaidModule.render).toHaveBeenCalledTimes(0);

    FakeIntersectionObserver.instances[0]?.trigger(node, true);
    await Promise.resolve();

    expect(mermaidModule.render).toHaveBeenCalledTimes(1);
    expect(node.innerHTML).toContain('<svg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/core/mermaid.test.ts --config vitest.config.ts`

Expected: fail because current renderer does not wait on visibility and the hidden-node test renders too early or never rechecks.

- [ ] **Step 3: Write minimal implementation**

```ts
function isRenderable(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  return node.isConnected && rect.width > 0 && rect.height > 0;
}

export async function renderMermaidDiagrams(root: ParentNode | null | undefined, theme: ThemeId, options?: RenderMermaidOptions): Promise<void> {
  const nodes = Array.from(root?.querySelectorAll<HTMLElement>('.mermaid') ?? []);
  if (!nodes.length) return;

  const pending = new Set(nodes);
  const aborted = (): boolean => options?.signal?.aborted ?? false;
  let observer: IntersectionObserver | null = null;

  const renderOne = async (node: HTMLElement): Promise<boolean> => {
    if (aborted() || !pending.has(node)) return false;
    if (!isRenderable(node)) return false;
    const code = node.dataset.src ?? node.textContent ?? '';
    if (!code.trim()) return false;
    pending.delete(node);
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({ startOnLoad: false, theme: getMermaidTheme(theme), securityLevel: 'strict', htmlLabels: false });
    await ensureMermaidBootstrap(mermaid);
    const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code);
    node.innerHTML = sanitizeMermaidSvg(svg);
    return true;
  };

  observer = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
        void Promise.all(entries.map(async (entry) => {
          if (!entry.isIntersecting) return;
          const rendered = await renderOne(entry.target as HTMLElement);
          if (rendered) observer?.unobserve(entry.target as HTMLElement);
        }));
      })
    : null;

  for (const node of nodes) {
    if (await renderOne(node)) continue;
    observer?.observe(node);
  }

  const rerun = () => {
    void Promise.all(Array.from(pending).map((node) => renderOne(node)));
  };

  const eventOptions = options?.signal ? { signal: options.signal } : undefined;
  document.addEventListener('visibilitychange', rerun, eventOptions);

  const resizeRoot = root instanceof Element ? root : document.documentElement;
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(rerun) : null;
  if (resizeObserver) resizeObserver.observe(resizeRoot);

  options?.signal?.addEventListener('abort', () => {
    observer?.disconnect();
    resizeObserver?.disconnect();
  }, { once: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/core/mermaid.test.ts --config vitest.config.ts`

Expected: PASS with one render for visible nodes and delayed render for hidden nodes.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/mermaid.ts tests/core/mermaid.test.ts
git commit -m "fix(core): render mermaid on visibility"
```

### Task 2: Cover first-open Mermaid in web and VS Code

**Files:**
- Modify: `tests/web/specs/reader.spec.ts`
- Modify: `tests/vscode/specs/viewer.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { readFileSync } from 'node:fs';

const mermaidMarkdown = readFileSync('tests/fixtures/mermaid.md', 'utf8');

test('renders Mermaid on first open', async ({ page }) => {
  await page.addInitScript((markdown) => {
    localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'manual' }));
    localStorage.setItem('doclume-last-doc-v1', JSON.stringify({ markdown, name: 'mermaid.md' }));
  }, mermaidMarkdown);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const article = page.locator('article.markdown');
  await expect(article.locator('.mermaid svg')).toBeVisible();
  await expect(article.locator('.mermaid')).not.toContainText('flowchart TD');
});
```

```ts
import { readFileSync } from 'node:fs';

const viewerMarkdown = readFileSync('tests/fixtures/mermaid.md', 'utf8');

test('renders Mermaid on first open', async ({ page }) => {
  await page.addInitScript((markdown) => {
    (globalThis as any).__DOCLUME_INIT__ = { markdown, theme: 'manual' };
    (globalThis as any).acquireVsCodeApi = () => ({ postMessage() {} });
  }, viewerMarkdown);

  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  const article = page.locator('article.markdown');
  await expect(article.locator('.mermaid svg')).toBeVisible();
  await expect(article.locator('.mermaid')).not.toContainText('flowchart TD');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
- `pnpm exec playwright test tests/web/specs/reader.spec.ts --config tests/web/playwright.config.ts`
- `pnpm exec playwright test tests/vscode/specs/viewer.spec.ts --config tests/vscode/playwright.config.ts`

Expected: fail before the core fix because Mermaid stays as raw source on first open.

- [ ] **Step 3: Run test to verify it passes**

Run:
- `pnpm exec playwright test tests/web/specs/reader.spec.ts --config tests/web/playwright.config.ts`
- `pnpm exec playwright test tests/vscode/specs/viewer.spec.ts --config tests/vscode/playwright.config.ts`

Expected: PASS after the shared renderer change.

- [ ] **Step 4: Commit**

```bash
git add tests/web/specs/reader.spec.ts tests/vscode/specs/viewer.spec.ts
git commit -m "test: cover mermaid first-open rendering"
```

### Task 3: Run full verification and tidy up

**Files:**
- None expected; only test output and possibly snapshots if a visual expectation changes.

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 2: Run full regression set**

Run:
- `pnpm test:core`
- `pnpm test:web`
- `pnpm test:vscode:smoke`
- `pnpm test:vscode:visual`

Expected: PASS, with any Mermaid snapshots updated only if the rendered SVG output changed intentionally.

- [ ] **Step 3: Commit final verification-only changes if any snapshots moved**

```bash
git add -u
git commit -m "test: verify mermaid first-open rendering"
```

## Self-check coverage
- Core visibility-aware render logic: Task 1
- Hidden/visible behavior and abort safety: Task 1
- Web first-open regression: Task 2
- VS Code first-open regression: Task 2
- Typecheck and full suite verification: Task 3