# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm dev                    # web app dev server
pnpm build                  # build all packages (core → web → vscode ext)
pnpm build:core             # @doclume/core type-check only
pnpm build:web              # Vite build for web app
pnpm build:ext              # Vite + esbuild bundle for VS Code extension
pnpm package:ext            # .vsix package
pnpm publish:ext            # publish to VS Code Marketplace + OVSX
pnpm deploy:worker          # deploy web app to Cloudflare Workers

pnpm test                   # full suite (core + web + vscode)
pnpm test:core              # vitest (jsdom) — unit tests in tests/core/ and tests/content/
pnpm test:web               # Playwright — tests/web/
pnpm test:vscode            # smoke + visual (builds ext first)
pnpm test:vscode:smoke      # builds ext then runs electron smoke runner
pnpm test:vscode:visual     # Playwright visual snapshots for vscode
pnpm test:update-snapshots  # regenerate all Playwright screenshot baselines

pnpm typecheck              # tsc --build across all packages + tests/tsconfig.json
pnpm bump                   # bump version across all packages via scripts/bump-version.mjs
```

Install Playwright browsers once if missing:
```sh
pnpm exec playwright install chromium
```

After ad hoc runs, clean up: `.vscode-test/` and `test-results/`.

## Architecture

Monorepo (`pnpm` workspaces): `packages/core`, `packages/web`, `packages/vscode`.

### `packages/core` — source of truth

All markdown rendering and shared document logic lives here. The web and VS Code packages are wrappers — **never fork rendering logic into app layers**.

Key modules:
- `markdown.ts` — marked-based pipeline with KaTeX, footnotes, definition lists
 - `mermaid.ts` — visibility-aware lazy renderer (IntersectionObserver + ResizeObserver); dynamic-imports mermaid at runtime; uses a one-time `parse` bootstrap before rendering
- `code-blocks.ts` — syntax highlighting via highlight.js, copy controls, language labels
- `toc.ts` — table of contents extraction
- `stats.ts` — word count / reading time
- `sanitize.ts` — DOMPurify post-processing (also sanitizes mermaid SVG output)
- `themes.ts` — theme IDs and config; five themes: `library`, `lamplight`, `manual`, `console`, `contrast`
- `bootstrap.ts` — document initialisation entry point
- `index.ts` — re-exports everything above

CSS lives in `packages/core/css/` (`themes.css`, `markdown.css`) and is consumed directly by both apps.

### `packages/web` — Vite + React SPA

Deployed to Cloudflare Workers (`wrangler.toml`). React components in `src/components/`: `App.tsx` → `DocumentShell` → `ReaderPane` + `Sidebar`. Fonts bundled locally (no Google Fonts).

### `packages/vscode` — VS Code extension

Extension host: `src/extension.ts` (TypeScript, bundled by `build.mjs` via esbuild).
Webview: `src/webview/` (React, bundled by Vite into `dist/webview/`). The webview receives markdown as inline JSON via a `<script>` tag; it does not fetch over the network. Fonts ship with the extension.

Supported file types: `.md`, `.prompt`, `.instructions`, `.chatagent`, `.skill`.

Theme `auto` maps to `manual` (light VS Code themes) or `console` (dark/high-contrast).

### Tests

- **Unit** (`tests/core/`, `tests/content/`): vitest + jsdom. Run with `pnpm test:core`.
- **Web visual** (`tests/web/`): Playwright against the running web app.
- **VS Code smoke** (`tests/vscode/smoke/`): electron-based smoke via `@vscode/test-electron`.
- **VS Code visual** (`tests/vscode/specs/`): Playwright screenshot snapshots.

Snapshot baselines are committed with platform-neutral names. Update with `pnpm test:update-snapshots`.

## Workflow for non-trivial changes

1. Brainstorm → plan → get approval before implementing.
2. If shared rendering changes, update `packages/core` first.
3. Update `CHANGELOG.md` (unreleased section) for user-visible changes.
4. Verify with the smallest relevant check before claiming done.
