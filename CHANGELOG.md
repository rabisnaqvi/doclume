# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Monorepo releases use one version across the repo root, `@doclume/core`, `@doclume/web`, and the `doclume` VS Code extension (`pnpm bump` moves `## [Unreleased]` into `## [x.y.z] - date` in this file).

## [Unreleased]

### Added
- Admonition blocks — GitHub-style `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` blockquotes now render as styled callouts with icons, themed per each of the five themes.
- Code block copy button and language label — hovering a code block reveals a copy-to-clipboard button and a language tag; both are always visible on touch devices. Syntax-highlighted blocks now scroll horizontally without showing a scrollbar.

### Fixed
- Mermaid diagrams failed to render on first open in VS Code and Cursor; diagrams now initialize reliably via visibility-aware deferred rendering with bootstrap parsing and do not duplicate work when visibility or resize rechecks fire during an in-flight render.

## [0.2.0] - 2026-05-20

### Added

### Changed
- Markdown rendering now strips front matter, preserves inline formatting in definition lists, and handles code blocks more safely.
- Mermaid diagrams are initialized up front so the first diagram renders reliably.
- The web preview now uses a refreshed reader-style layout with sidebar navigation.
- The VS Code viewer now shares the updated markdown and Mermaid rendering behavior for more consistent previews.

## [0.1.1] - 2026-05-16

Prior releases were not tracked here. For history before this file, see `git log`.
