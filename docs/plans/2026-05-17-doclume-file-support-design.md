# Doclume file support design

## Goal
Make `.prompt`, `.instructions`, `.chatagent`, and `.skill` files behave like markdown-like documents in Doclume, matching the README claims in plain VS Code and in editors that already use those language IDs.

## Current gap
- `packages/vscode/package.json` already advertises support in activation events and menus.
- `packages/vscode/src/extension.ts` only treats those files as supported when VS Code gives them a markdown-like `languageId`, or when the filename ends in `.md`.
- `packages/vscode/src/webview/Viewer.tsx` still tells users to open only `.md` files.

## Decision
Use three layers of support:

1. **Automatic VS Code recognition**
   - Add `contributes.configurationDefaults` in `packages/vscode/package.json`.
   - Map:
     - `*.prompt` → `markdown`
     - `*.instructions` → `markdown`
     - `*.chatagent` → `markdown`
     - `*.skill` → `markdown`
   - This makes the files open as markdown-like documents in plain VS Code without inventing new language IDs or grammars.

2. **Runtime fallback**
   - Extend `isMarkdownLikeDocument(...)` in `packages/vscode/src/extension.ts` to accept filename suffixes for:
     - `.md`
     - `.prompt`
     - `.instructions`
     - `.chatagent`
     - `.skill`
   - Keep the existing `MARKDOWN_LIKE` regex unchanged so Cursor-like environments that already expose `prompt|instructions|chatagent|skill` continue to work.

3. **Copy/docs cleanup**
   - Update `packages/vscode/src/webview/Viewer.tsx` empty state text.
   - Keep `README.md` and `packages/vscode/README.md` aligned with the actual behavior.

## Why this approach
- Works automatically in plain VS Code.
- Avoids owning custom language IDs or grammars.
- Preserves compatibility with existing markdown-like editor IDs.
- Keeps preview rendering exactly the same as `.md`.

## Non-goals
- No custom parser per file type.
- No special rendering differences between these extensions.
- No new theme or UI behavior.

## Files to change
- `packages/vscode/package.json`
- `packages/vscode/src/extension.ts`
- `packages/vscode/src/webview/Viewer.tsx`
- `README.md`
- `packages/vscode/README.md`

## Success criteria
- `.prompt`, `.instructions`, `.chatagent`, and `.skill` files open with Doclume available in the editor title, context menu, and command palette.
- Doclume previews them using the existing markdown pipeline.
- The empty state no longer implies only `.md` is supported.
- README claims match actual behavior.
