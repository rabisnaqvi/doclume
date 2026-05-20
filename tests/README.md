# Testing maintenance notes

- Run the full suite: `pnpm test`
- Refresh screenshots: `pnpm test:update-snapshots`
- Refresh web screenshots only: `pnpm test:web -- --update-snapshots`
- Refresh VS Code screenshots only: `pnpm test:vscode:visual -- --update-snapshots`
- Run the VS Code smoke path: `pnpm test:vscode:smoke`
- If Playwright browsers are missing locally, install Chromium once: `pnpm exec playwright install chromium`
- Clean up local artifacts after ad hoc runs if needed: `.vscode-test/` and `test-results/`

Notes:

- CI installs Chromium before the browser jobs run.
- Screenshot baselines are committed with platform-neutral names.
- `pnpm test:vscode:smoke` prebuilds the VS Code extension bundle before launching the smoke runner.
