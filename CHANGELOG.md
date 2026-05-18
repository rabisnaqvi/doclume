# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Monorepo releases use one version across the repo root, `@doclume/core`, `@doclume/web`, and the `doclume` VS Code extension (`pnpm bump` moves `## [Unreleased]` into `## [x.y.z] - date` in this file).

## [Unreleased]

## [0.2.0] - 2026-05-18

### Added

- **Core:** LaTeX-style math via KaTeX — display `$$…$$`, inline `$…$`.
- **Core:** Mermaid diagrams from fenced blocks with language `mermaid`.
- **Core:** GitHub-style footnotes (`marked-footnote`) and PHP Markdown Extra–style definition lists (`term` + `: definition` lines).
- **Core:** Wrapped markdown tables for horizontal scroll; stable heading `id`s for deep links.
- **Web:** Reader chrome with outline/sidebar, responsive top bar and in-page search.
- **VS Code:** Bundled variable fonts (Inter, Source Serif 4, JetBrains Mono) in the webview — no Google Fonts fetch; CSP tightened for fonts/styles accordingly.

### Changed

- **Core:** Markdown pipeline centralized behind `renderMarkdown` / `configureMarked` (consumers use shared extensions and highlighting).
- **VS Code:** Faster first paint — initial document and theme embedded in HTML; webview asset filenames cached across opens; document `postMessage` updates debounced (~120 ms) while typing.
- **Web:** Layout and styling refactor (shell components, CSS) aligned with the shared reader experience.

## [0.1.1] - 2026-05-16

Prior releases were not tracked here. For history before this file, see `git log`.
