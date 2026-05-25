# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Monorepo releases use one version across the repo root, `@doclume/core`, `@doclume/web`, and the `doclume` VS Code extension (`pnpm bump` moves `## [Unreleased]` into `## [x.y.z] - date` in this file).

## [Unreleased]

### Fixed
- Handle `renderDocument()` failures in web app + VS Code webview (avoid unhandled promise rejections, show fallback message, keep observers in sync).

## [0.3.0] - 2026-05-24

### Added
- Admonition blocks — GitHub-style `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` blockquotes now render as styled callouts with icons, themed per each of the five themes.
- Code block copy button and language label — code blocks now show an always-visible header on desktop and touch devices, with the language label on the left and a copy control on the right. Syntax-highlighted blocks now scroll horizontally without showing a scrollbar.

### Fixed
- Mermaid fences are now case-insensitive during markdown rendering, so `Mermaid` and `MERMAID` render as diagrams instead of highlighted code.
- Mermaid diagrams failed to render on first open in VS Code and Cursor; diagrams now initialize reliably via visibility-aware deferred rendering with bootstrap parsing and do not duplicate work when visibility or resize rechecks fire during an in-flight render.
- Reader TOC state no longer resets when Mermaid bootstrap re-renders markdown; math-ready events now refresh rendered HTML without churning the TOC array or clearing search/active heading state.
- Upgraded `qs` to `^6.15.2` via a pnpm override to address the known vulnerability.
- Aligned the repo and CI to pnpm 11 so frozen installs no longer fail the lockfile config check under `ci:local`.

## [0.2.0] - 2026-05-20

### Added

### Changed
- Markdown rendering now strips front matter, preserves inline formatting in definition lists, and handles code blocks more safely.
- Mermaid diagrams are initialized up front so the first diagram renders reliably.
- The web preview now uses a refreshed reader-style layout with sidebar navigation.
- The VS Code viewer now shares the updated markdown and Mermaid rendering behavior for more consistent previews.

## [0.1.1] - 2026-05-16

Prior releases were not tracked here. For history before this file, see `git log`.
