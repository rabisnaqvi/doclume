import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { THEMES, type ThemeId, type WebviewMessage } from '@doclume/core';

/** Serialise data for embedding in a <script> tag safely (no </script> injection). */
function safeJson(doc: { markdown: string; name: string }, theme: string): string {
  return JSON.stringify({ ...doc, theme })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

const EXPLICIT_THEMES: ThemeId[] = ['library', 'lamplight', 'manual', 'console', 'contrast'];

/** Same language ids as built-in Markdown preview (incl. Cursor agent / prompt buffers). */
const MARKDOWN_LIKE = /^(markdown|prompt|instructions|chatagent|skill)$/;
const SUPPORTED_MARKDOWN_EXTENSIONS = ['.md', '.prompt', '.instructions', '.chatagent', '.skill'] as const;

function isMarkdownLikeDocument(document: vscode.TextDocument): boolean {
  const fileName = document.fileName.toLowerCase();
  return MARKDOWN_LIKE.test(document.languageId) || SUPPORTED_MARKDOWN_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function findBuiltAsset(files: readonly string[], extension: string): string | undefined {
  return files.filter((file) => file.endsWith(extension)).sort((a, b) => a.localeCompare(b))[0];
}

let cachedWebviewAssets: { jsFile: string; cssFile: string } | null = null;

function getBuiltWebviewAssets(assetsDir: vscode.Uri): { jsFile: string; cssFile: string } {
  if (cachedWebviewAssets) return cachedWebviewAssets;

  let jsFile = '';
  let cssFile = '';

  try {
    const files = fs.readdirSync(assetsDir.fsPath);
    jsFile = findBuiltAsset(files, '.js') || '';
    cssFile = findBuiltAsset(files, '.css') || '';
  } catch (e) {
    console.error('Could not read assets directory:', e);
  }

  if (jsFile) cachedWebviewAssets = { jsFile, cssFile };
  return cachedWebviewAssets ?? { jsFile, cssFile };
}

function themeFromWorkbench(): ThemeId {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast) {
    return 'console';
  }
  return 'manual';
}

function resolvePreviewTheme(config: vscode.WorkspaceConfiguration): ThemeId {
  const raw = config.get<string>('theme');
  if (raw === undefined || raw === null || raw === 'auto') {
    return themeFromWorkbench();
  }
  return EXPLICIT_THEMES.includes(raw as ThemeId) ? (raw as ThemeId) : themeFromWorkbench();
}

function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string,
  theme: ThemeId,
  baseUri?: string,
  initialDoc?: { markdown: string; name: string },
): string {
  const distDir = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

  // Find the built JS and CSS files
  const assetsDir = vscode.Uri.joinPath(distDir, 'assets');
  const { jsFile, cssFile } = getBuiltWebviewAssets(assetsDir);

  if (!jsFile) {
    return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Doclume</title>
  <style>
    body {
      font-family: Inter, system-ui, sans-serif;
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #111827;
      color: #f9fafb;
    }
    .panel {
      max-width: 42rem;
      padding: 2rem;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      background: rgba(17, 24, 39, 0.92);
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.28);
    }
    h1 {
      margin: 0 0 0.75rem;
      font-size: 1.25rem;
    }
    p {
      margin: 0.5rem 0 0;
      line-height: 1.6;
      color: rgba(249, 250, 251, 0.82);
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: rgba(255, 255, 255, 0.08);
      padding: 0.15rem 0.35rem;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="panel">
    <h1>Doclume preview assets not found</h1>
    <p>Rebuild the extension package so <code>dist/webview/assets/*.js</code> exists, then reopen the preview.</p>
  </div>
</body>
</html>`;
  }

  const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, jsFile));
  const cssUri = cssFile ? webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, cssFile)) : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'unsafe-inline';
    script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval';
    font-src ${webview.cspSource};
    img-src ${webview.cspSource} https: data:;
  ">
  ${cssUri ? `<link rel="stylesheet" href="${cssUri}" />` : ''}
  ${baseUri ? `<base href="${baseUri}">` : ''}
  <title>Doclume</title>
</head>
<body>
  <div id="root"></div>
  ${initialDoc ? `<script nonce="${nonce}">window.__DOCLUME_INIT__=${safeJson(initialDoc, theme)};</script>` : ''}
  <script type="module" nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
}

async function resolveMarkdownDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (uri) {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      return isMarkdownLikeDocument(doc) ? doc : undefined;
    } catch {
      return undefined;
    }
  }
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;
  return isMarkdownLikeDocument(editor.document) ? editor.document : undefined;
}

type ThemeSetting = 'auto' | ThemeId;

const THEME_CYCLE_ORDER: ThemeSetting[] = [
  'auto',
  'library',
  'lamplight',
  'manual',
  'console',
  'contrast',
];

function configurationUpdateTarget(): vscode.ConfigurationTarget {
  return vscode.workspace.workspaceFolders?.length
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

async function selectDoclumeTheme(): Promise<void> {
  type Item = vscode.QuickPickItem & { value: ThemeSetting };
  const items: Item[] = [
    {
      label: '$(color-mode) Auto',
      description: 'Manual in light · Console in dark',
      value: 'auto',
    },
    ...THEMES.map(
      (t): Item => ({
        label: t.name,
        description: t.description,
        detail: t.use,
        value: t.id,
      }),
    ),
  ];
  const picked = await vscode.window.showQuickPick<Item>(items, {
    title: 'Doclume theme',
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!picked) return;
  await vscode.workspace
    .getConfiguration('doclume')
    .update('theme', picked.value, configurationUpdateTarget());
}

async function cycleDoclumeTheme(): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('doclume');
  const raw = cfg.get<string>('theme');
  const current: ThemeSetting =
    raw !== undefined && raw !== null && THEME_CYCLE_ORDER.includes(raw as ThemeSetting)
      ? (raw as ThemeSetting)
      : 'auto';
  const i = THEME_CYCLE_ORDER.indexOf(current);
  const next = THEME_CYCLE_ORDER[(i + 1) % THEME_CYCLE_ORDER.length];
  await cfg.update('theme', next, configurationUpdateTarget());
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('doclume.selectTheme', selectDoclumeTheme),
    vscode.commands.registerCommand('doclume.cycleTheme', cycleDoclumeTheme),
    vscode.commands.registerCommand('doclume.openPreview', async (uri?: vscode.Uri) => {
      const document = await resolveMarkdownDocument(uri);
      if (!document) return;

      const config = vscode.workspace.getConfiguration('doclume');
      const panel = vscode.window.createWebviewPanel(
        'doclumePreview',
        `Doclume: ${path.basename(document.fileName)}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist'),
            vscode.Uri.file(path.dirname(document.fileName)),
            ...(vscode.workspace.workspaceFolders?.map(f => f.uri) || [])
          ],
          retainContextWhenHidden: true,
        },
      );

      const nonce = getNonce();
      let theme = resolvePreviewTheme(config);
      const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(path.dirname(document.fileName))).toString() + '/';
      const initialDoc = { markdown: document.getText(), name: path.basename(document.fileName) };
      panel.webview.html = buildWebviewHtml(panel.webview, context.extensionUri, nonce, theme, baseUri, initialDoc);

      const sendUpdateNow = (): void => {
        const msg: WebviewMessage = {
          type: 'update',
          markdown: document.getText(),
          name: path.basename(document.fileName),
        };
        panel.webview.postMessage(msg);
      };

      let updateTimer: ReturnType<typeof setTimeout> | undefined;
      let webviewReady = false;
      let pendingUpdate = false;
      const queueUpdate = (): void => {
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
          updateTimer = undefined;
          if (!webviewReady) {
            pendingUpdate = true;
            return;
          }
          sendUpdateNow();
        }, 120);
      };

      const sendTheme = (id: ThemeId): void => {
        const msg: WebviewMessage = { type: 'theme', id };
        panel.webview.postMessage(msg);
      };

      // Send initial content once webview signals ready
      panel.webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'ready') {
          webviewReady = true;
          sendTheme(theme);
          sendUpdateNow();
          if (pendingUpdate) {
            pendingUpdate = false;
            sendUpdateNow();
          }
        }
      });

      // Watch for document changes
      const docListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === document) queueUpdate();
      });

      // Watch for config changes
      const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('doclume.theme')) {
          theme = resolvePreviewTheme(vscode.workspace.getConfiguration('doclume'));
          sendTheme(theme);
        }
      });

      const colorThemeListener = vscode.window.onDidChangeActiveColorTheme(() => {
        const cfg = vscode.workspace.getConfiguration('doclume');
        const raw = cfg.get<string>('theme');
        if (raw === undefined || raw === null || raw === 'auto') {
          theme = themeFromWorkbench();
          sendTheme(theme);
        }
      });

      panel.onDidDispose(() => {
        if (updateTimer) clearTimeout(updateTimer);
        docListener.dispose();
        configListener.dispose();
        colorThemeListener.dispose();
      });
    }),
  );
}

export function deactivate(): void {}
