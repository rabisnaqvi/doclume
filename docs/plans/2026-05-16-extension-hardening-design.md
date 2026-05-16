# Extension hardening design

## Goal
Fix the TypeScript errors in `packages/vscode` and make the extension more robust when loading built webview assets.

## Chosen approach
1. Add Node typings to the extension package so `path` and `fs` resolve under TypeScript.
2. Keep the current webview bootstrap, but harden asset discovery in `buildWebviewHtml()`:
   - select JS/CSS assets deterministically from the built `dist/webview/assets` folder
   - if the JS bundle is missing, render a clear fallback message instead of an empty webview
   - keep the change scoped to the extension entrypoint

## Files
- `packages/vscode/package.json`
- `packages/vscode/tsconfig.json`
- `packages/vscode/src/extension.ts`

## Verification
- `pnpm --dir packages/vscode exec tsc -p tsconfig.json --noEmit`
- `pnpm --filter doclume build`
