const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doclume-smoke-'));
  const file = path.join(dir, 'smoke.prompt');
  fs.writeFileSync(file, '# Smoke\n\nThis is a smoke test.\n');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand('doclume.openPreview');

  const tabLabels = vscode.window.tabGroups.all.flatMap((group) => group.tabs.map((tab) => tab.label));
  assert.ok(tabLabels.some((label) => label.startsWith('Doclume: smoke.prompt')));
}

module.exports = { run };
