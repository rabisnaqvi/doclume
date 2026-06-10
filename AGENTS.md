## Priority
- User instructions win.
- Repo policy comes next.
- This file applies to all AI agents in this repo.

## Required workflow
For non-trivial work:
1. use `using-superpowers`
2. use `brainstorming`
3. use `writing-plans`
4. implement only after design approval

## Default agent posture
Keep `caveman` and `using-superpowers` active by default.

## Repo truths
- `packages/core` is source of truth for markdown rendering and shared document logic.
- `packages/web` and `packages/vscode` are apps/wrappers around core.
- Do not fork rendering logic into app layers.
- If shared rendering changes, update core first.

## Change hygiene
- Add user-visible or shipped changes to `CHANGELOG.md` under `## [Unreleased]`.
- Development-only / internal tooling changes do not need a changelog entry unless the user explicitly asks for one.
- Do not commit `docs/superpowers/specs/*` or `docs/superpowers/plans/*` unless the user explicitly approves committing them; keep design/spec/plan docs out of git history by default.
- Keep changes small and focused.
- Do not reshuffle packages unless the task requires it.
- Avoid unrelated refactors.

## Verification
- Verify before claiming done.
- Use the smallest relevant check.
- Fix failing checks before completion.
- Do not mark partial work complete.

## Anti-patterns
- Reimplementing shared rendering in web or vscode.
- Skipping changelog updates.
- Jumping into code before brainstorming and planning.
- Treating app layers as source of truth.
