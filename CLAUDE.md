# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install
pnpm install

# Dev (web app only)
pnpm dev

# Build all (core → web → vscode, in order)
pnpm build

# Build individual packages
pnpm build:core    # tsc --noEmit (type-check only, no output)
pnpm build:web     # vite build
pnpm build:ext     # esbuild (extension host) + vite build (webview)

# Typecheck entire monorepo
pnpm typecheck

# Package VS Code extension (.vsix)
pnpm package:ext

# Watch extension host (esbuild)
cd packages/vscode && pnpm watch
```

No test runner or lint config is configured.

## Architecture

pnpm monorepo with three packages:

### `packages/core` (`@doclume/core`)
Shared logic consumed by both `web` and `vscode`. Has **no build step** — exports point directly to `./src/index.ts` and are resolved via TypeScript in consumers. Exports:
- `markdown.ts` — parses markdown with `marked` + syntax highlighting via `highlight.js`
- `themes.ts` — theme metadata for the 5 themes (library, lamplight, manual, console, contrast)
- `toc.ts` — table of contents extraction
- `stats.ts` — word count / reading time
- `types.ts` — shared types: `ThemeId`, `Theme`, `DocState`, `ReadingStats`, `Prefs`, `WebviewMessage`, `HostMessage`
- CSS via named exports: `@doclume/core/css/themes.css`, `@doclume/core/css/markdown.css`

### `packages/web` (`@doclume/web`)
React 18 + Vite standalone web app. Single `App` component, no router. Used for developing the preview UI outside VS Code.

### `packages/vscode` (`doclume`)
VS Code extension with a two-artifact build:
1. **Extension host** (`src/extension.ts` → `dist/extension.js`) — bundled with esbuild via `build.mjs`
2. **Webview** (React app → `dist/webview/assets/`) — bundled with Vite

The extension registers one command (`doclume.openPreview`) that opens a `WebviewPanel` beside the active editor. The extension host communicates with the webview via `panel.webview.postMessage` using `WebviewMessage` (extension→webview: `update` with markdown content, `theme` with theme id) and `HostMessage` (webview→extension: `ready`). The webview's built assets are loaded dynamically by scanning `dist/webview/assets/` at runtime.

## Key constraint
`@doclume/core` must always build before `web` or `vscode`. The root `pnpm build` script enforces this order. When working on core, run `pnpm typecheck` to validate — there are no emitted JS files to check.
