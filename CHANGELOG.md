# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Monorepo releases use one version across the repo root, `@doclume/core`, `@doclume/web`, and the `doclume` VS Code extension (`pnpm bump` moves `## [Unreleased]` into `## [x.y.z] - date` in this file).

## [Unreleased]

### Added
- Local CI runner — `pnpm ci:local` wraps `act` for workflow jobs and also runs ordered local step presets, with Podman socket detection and cleanup-friendly defaults.
- Admonition blocks — GitHub-style `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, and `[!CAUTION]` blockquotes now render as styled callouts with icons, themed per each of the five themes.
- Code block copy button and language label — code blocks now show an always-visible header on desktop and touch devices, with the language label on the left and a copy control on the right. Syntax-highlighted blocks now scroll horizontally without showing a scrollbar.

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
