import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import type { ThemeId, WebviewMessage } from '@doclume/core';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

const EXPLICIT_THEMES: ThemeId[] = ['library', 'lamplight', 'manual', 'console', 'contrast'];

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
): string {
  const distDir = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

  // Find the built JS and CSS files
  const assetsDir = vscode.Uri.joinPath(distDir, 'assets');
  let jsFile = '';
  let cssFile = '';
  
  try {
    const files = fs.readdirSync(assetsDir.fsPath);
    jsFile = files.find((f) => f.endsWith('.js')) || '';
    cssFile = files.find((f) => f.endsWith('.css')) || '';
  } catch (e) {
    console.error('Could not read assets directory:', e);
  }

  const jsUri = jsFile ? webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, jsFile)) : '';
  const cssUri = cssFile ? webview.asWebviewUri(vscode.Uri.joinPath(assetsDir, cssFile)) : '';

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'none';
    style-src ${webview.cspSource} 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com;
    script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval';
    font-src ${webview.cspSource} https://fonts.gstatic.com;
    img-src ${webview.cspSource} https: data:;
  ">
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link nonce="${nonce}" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  ${cssUri ? `<link rel="stylesheet" nonce="${nonce}" href="${cssUri}" />` : ''}
  <title>Doclume</title>
</head>
<body>
  <div id="root"></div>
  ${jsUri ? `<script type="module" nonce="${nonce}" src="${jsUri}"></script>` : ''}
</body>
</html>`;
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('doclume.openPreview', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = editor.document;
      const config = vscode.workspace.getConfiguration('doclume');
      const panel = vscode.window.createWebviewPanel(
        'doclumePreview',
        `Doclume: ${path.basename(document.fileName)}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
          retainContextWhenHidden: true,
        },
      );

      const nonce = getNonce();
      let theme = resolvePreviewTheme(config);
      panel.webview.html = buildWebviewHtml(panel.webview, context.extensionUri, nonce, theme);

      const sendUpdate = (): void => {
        const msg: WebviewMessage = {
          type: 'update',
          markdown: document.getText(),
          name: path.basename(document.fileName),
        };
        panel.webview.postMessage(msg);
      };

      const sendTheme = (id: ThemeId): void => {
        const msg: WebviewMessage = { type: 'theme', id };
        panel.webview.postMessage(msg);
      };

      // Send initial content once webview signals ready
      panel.webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'ready') {
          sendTheme(theme);
          sendUpdate();
        }
      });

      // Watch for document changes
      const docListener = vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.document === document) sendUpdate();
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
        docListener.dispose();
        configListener.dispose();
        colorThemeListener.dispose();
      });
    }),
  );
}

export function deactivate(): void {}
