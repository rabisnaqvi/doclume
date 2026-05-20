import path from 'node:path';
import { runTests } from '@vscode/test-electron';

await runTests({
  extensionDevelopmentPath: path.resolve('packages/vscode'),
  extensionTestsPath: path.resolve('tests/vscode/smoke/index.js'),
});
