# Mermaid Visibility-Aware Render Design

Date: 2026-05-22
Priority: P0
Status: Approved design

## Summary
Fix Mermaid diagrams so they render correctly on first open in Doclume, including the VS Code webview path that currently shows raw Mermaid source until the document is reopened. The core change is to make Mermaid rendering visibility-aware instead of relying on a blind immediate pass or a full warm-up render.

The shared renderer should:
- keep the existing markdown HTML shape (`.mermaid` placeholders with `data-src`)
- render visible diagrams immediately
- defer hidden diagrams until they become visible
- avoid any full-document warm-up render
- work in both the web app and the VS Code preview because both consume `@doclume/core`
- use visibility/resize fallbacks only when the browser does not deliver the initial visibility transition in time

## Goals
- Render Mermaid diagrams correctly on first open.
- Keep the fix in shared core code, not separate app-only logic.
- Avoid the old warm-up strategy that rendered the same document twice.
- Preserve current markdown rendering behavior for non-Mermaid content.
- Keep the solution lightweight enough for frequent preview refreshes.

## Non-goals
- No redesign of markdown parsing.
- No change to Mermaid syntax support.
- No always-on background polling.
- No separate Mermaid implementations in web and VS Code.
- No attempt to pre-render every diagram before the page becomes visible.

## Context
Current flow:
- `packages/core/src/markdown.ts` emits Mermaid fences as `<div class="mermaid" data-src="...">...</div>`.
- `packages/core/src/mermaid.ts` imports Mermaid dynamically and renders each placeholder with `mermaid.render(...)`.
- `packages/web/src/App.tsx` and `packages/vscode/src/webview/Viewer.tsx` both call `renderMermaidDiagrams()` after HTML injection.

Observed bug:
- In VS Code, a document containing Mermaid can open with raw Mermaid text still visible in the code block area.
- Reopening the document makes it render correctly.
- A previous warm-up fix removed that symptom by rendering twice, but that was too expensive.

Relevant external pattern:
- Mermaid and related docs/issues commonly hit failures when rendering while the parent element is hidden, zero-sized, or not yet visible.
- A common mitigation is visibility-aware rendering using `IntersectionObserver`, sometimes paired with a visibility/resize retry.

## Options Considered

### Option 1 — Visibility-aware shared renderer (recommended)
Make `renderMermaidDiagrams()` observe `.mermaid` nodes and render each node only when it is visible.

Why this is best:
- shared fix for web and VS Code
- no full-doc warm-up
- avoids duplicate render of the same diagram source
- matches the actual failure mode: render timing vs element visibility

### Option 2 — Delayed one-shot render after layout settles
Wait for `requestAnimationFrame`, `document.fonts.ready`, or a short timeout, then render all diagrams once.

Why not:
- still a blunt whole-page pass
- can still race hidden tabs or collapsed containers
- less robust than node-level visibility handling

### Option 3 — Retry failed diagrams only
Render immediately, keep failures around, and retry only nodes that failed or stayed hidden.

Why not:
- more stateful
- harder to reason about
- still risks a first-paint flash of raw source

## Chosen Design

### Shared core helper
Update `packages/core/src/mermaid.ts` so `renderMermaidDiagrams(root, theme, options)` becomes visibility-aware.

Responsibilities:
1. Find all `.mermaid` nodes under `root`.
2. Render any node that is already visible right away.
3. Observe hidden nodes with `IntersectionObserver`.
4. When a node becomes visible, render it once and stop observing it.
5. Abort cleanly when the caller aborts or the document rerenders.
6. Re-check hidden nodes on `visibilitychange` and `ResizeObserver` notifications so tab activation and layout shifts can trigger the first render without a second document pass.

### Rendering flow
For each Mermaid node:
- read diagram source from `data-src` or text content
- skip empty nodes
- import Mermaid dynamically only when needed
- initialize Mermaid with current theme
- render SVG with `mermaid.render(...)`
- sanitize SVG and replace node content
- leave raw source in place if Mermaid parse/render fails

### Visibility strategy
Use a two-step strategy:

1. **Immediate pass**
   - If a `.mermaid` node is already visible when `renderMermaidDiagrams()` runs, render it immediately.
   - This avoids raw-source flash on normal first open.

2. **Deferred pass**
   - Hidden or zero-size nodes stay observed.
   - Render them when they intersect / become visible.
   - Add a lightweight fallback for environments where observer timing is delayed by hidden tabs or webview activation.

Fallback behavior:
- listen for `visibilitychange`
- re-check on `ResizeObserver` when available
- if observer support is missing, do a bounded retry on visibility changes instead of full-document warm-up

### Surface integration
No surface-specific Mermaid logic.

Both surfaces continue to call the shared helper after HTML injection:
- `packages/web/src/App.tsx`
- `packages/vscode/src/webview/Viewer.tsx`

No changes are required to the markdown renderer contract beyond the current `.mermaid` placeholder shape.

### Abort behavior
Keep the existing abort signal support.

Rules:
- rerendering a document aborts any in-flight Mermaid work for the previous document
- disposal aborts pending observers and render tasks
- stale callbacks must not mutate removed DOM nodes

## Files to Change
- `packages/core/src/mermaid.ts`
- tests under `tests/core`, `tests/web`, and `tests/vscode` as needed

## Risks and Mitigations

### Risk: raw Mermaid source flashes before render
Mitigation:
- render already-visible nodes immediately on mount
- keep the placeholder markup stable so the DOM can be replaced in place

### Risk: hidden-tab rendering still races on VS Code webview activation
Mitigation:
- use observer-driven rendering plus visibility/resize fallback
- do not rely on one eager whole-doc pass

### Risk: observer logic adds complexity
Mitigation:
- keep all Mermaid scheduling in one shared helper
- keep the API surface unchanged for callers

### Risk: performance regressions from repeated checks
Mitigation:
- render each node once
- unobserve after success
- avoid document-wide rerenders
- keep fallback bounded and event-driven

## Validation Plan
Implementation is complete when all of the following are true:
1. A markdown document containing Mermaid renders correctly on first open.
2. The same fix works in both the web app and VS Code preview.
3. The solution does not require opening the document twice.
4. No full-document warm-up render is introduced.
5. Hidden diagrams render when their container becomes visible.
6. Parse failures still fail softly by leaving raw source in place.

Planned verification after implementation:
- `pnpm typecheck`
- targeted core tests for Mermaid rendering behavior
- web preview regression coverage for Mermaid sample content
- VS Code smoke/visual coverage if the preview path needs a browser-level assertion

## Rollout Notes
This is a shared rendering fix with no persisted state changes. If any fallback proves too noisy, the first rollback option is to remove the fallback path while keeping the visibility-aware observer logic intact.