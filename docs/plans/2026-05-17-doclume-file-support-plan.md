# Doclume File Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `.prompt`, `.instructions`, `.chatagent`, and `.skill` files open and preview like markdown in Doclume, even in plain VS Code.

**Architecture:** Use VS Code default file associations to resolve those extensions to `markdown`, keep the existing markdown-like language-id regex for Cursor-like environments, and add a filename fallback so Doclume still recognizes the files when editor metadata is incomplete. Do not add custom parsers or new grammars; the rendering pipeline stays the same.

**Tech Stack:** TypeScript, VS Code extension manifest, React webview, `@doclume/core` markdown renderer, pnpm.

---

### Task 1: Associate prompt-like files with markdown

**Files:**
- Modify: `packages/vscode/package.json`

**Step 1: Verify the manifest has no default associations yet**

Run:
```bash
node -e "const p=require('./packages/vscode/package.json'); console.log(JSON.stringify(p.contributes?.configurationDefaults?.['files.associations'] || null, null, 2))"
```
Expected: `null`

**Step 2: Add default file associations**

Add `contributes.configurationDefaults.files.associations` so these extensions resolve to `markdown`:
- `*.prompt`
- `*.instructions`
- `*.chatagent`
- `*.skill`

**Step 3: Verify the manifest shape**

Run:
```bash
node -e "const p=require('./packages/vscode/package.json'); console.log(Object.keys(p.contributes.configurationDefaults['files.associations']).sort().join(','))"
```
Expected: `*.chatagent,*.instructions,*.prompt,*.skill`

**Step 4: Build the extension package**

Run:
```bash
pnpm --filter doclume build
```
Expected: passes.

**Step 5: Commit**

Run:
```bash
git add packages/vscode/package.json
git commit -m "feat(vscode): associate prompt-like files with markdown"
```

---

### Task 2: Add filename fallback recognition

**Files:**
- Modify: `packages/vscode/src/extension.ts`

**Step 1: Confirm the current helper only special-cases `.md`**

Run:
```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('packages/vscode/src/extension.ts','utf8'); console.log(/endsWith\('\.md'\)/.test(s))"
```
Expected: `true`

**Step 2: Add a shared supported-extension list**

Add a small constant for:
- `.md`
- `.prompt`
- `.instructions`
- `.chatagent`
- `.skill`

Use it inside `isMarkdownLikeDocument(...)` as a filename fallback.

**Step 3: Keep the existing language-id regex intact**

Do not remove `MARKDOWN_LIKE`; it still protects Cursor-like editors that already assign `prompt|instructions|chatagent|skill` language IDs.

**Step 4: Type-check the workspace**

Run:
```bash
pnpm typecheck
```
Expected: passes.

**Step 5: Commit**

Run:
```bash
git add packages/vscode/src/extension.ts
git commit -m "fix(vscode): recognize prompt-like files by extension"
```

---

### Task 3: Update preview copy and docs

**Files:**
- Modify: `packages/vscode/src/webview/Viewer.tsx`
- Modify: `README.md`
- Modify: `packages/vscode/README.md`

**Step 1: Find the current `.md`-only copy**

Confirm the empty state and docs still say only `.md`.

**Step 2: Update user-facing text**

Change the empty state and supported-file wording so it clearly mentions `.md`, `.prompt`, `.instructions`, `.chatagent`, and `.skill`.

**Step 3: Rebuild the extension package**

Run:
```bash
pnpm --filter doclume build
```
Expected: passes.

**Step 4: Commit**

Run:
```bash
git add packages/vscode/src/webview/Viewer.tsx README.md packages/vscode/README.md
git commit -m "docs: describe supported prompt-like files"
```

---

### Task 4: Smoke-test the full flow

**Files:**
- Verify: `docs/samples/markdown-coverage.prompt`
- Verify: `docs/samples/markdown-coverage.instructions`
- Verify: `docs/samples/markdown-coverage.chatagent`
- Verify: `docs/samples/markdown-coverage.skill`

**Step 1: Open each sample file in VS Code**

Use the editor title / explorer context menu / command palette for each file.

**Step 2: Confirm Doclume is available automatically**

Expected:
- the command appears for each file type
- the preview opens without manual language switching
- the rendered output matches the markdown preview

**Step 3: Confirm the editor copy is correct**

Expected: the empty state no longer tells users to open only `.md`.

**Step 4: Stop if any file still opens as plain text**

If that happens, revisit Task 1 before changing anything else.
