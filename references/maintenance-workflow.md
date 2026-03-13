# Maintenance Workflow

This file documents the maintainer loop for the `ai-native-slides` skill.

## Scope

Keep the skill repo and deck workspaces separate.

- Skill source of truth: this repository
- Installed Codex skill: `$CODEX_HOME/skills/ai-native-slides` or `~/.codex/skills/ai-native-slides`
- Example deck root: a separate directory outside this repo, such as `/Volumes/BiGROG/skills-test/ai-education-deck`

Do not use `AGENTS.md` as the primary source of truth for this skill. `AGENTS.md` is workspace-specific. The skill's own maintenance and installation workflow belongs in this repository.

For root/project layout details, template-managed file boundaries, cleanup targets, and common operator commands, load `references/project-workflow.md`. This file focuses on the maintainer loop for the skill itself.

Current local setup note:

- In this workspace, the installed skill path is a symlink to this repository.
- That means edits here are already the installed skill source seen by Codex after restart.
- `scripts/sync_to_codex.sh` is a fallback only for environments where the installed skill is a normal copied directory or where symlink-based loading is unreliable.

## Repository Layout

The skill repo should contain reusable skill resources only:

- `SKILL.md`
- `assets/`
- `scripts/`
- `references/`

Do not commit deck outputs or local runtime artifacts here:

- `node_modules/`
- `.venv/`
- `output/`
- `rendered/`
- `tmp/`
- `.pptx`

## Development Loop

1. Edit the skill in this repository.
2. Create or identify a project directory under `projects/<slug>/`. For a new deck, prefer `scripts/init_deck_project.sh <deck-root> <project-name>`.
3. Run `scripts/bootstrap_deck_root.sh <deck-root>` when the shared runtime root needs fresh helpers or shared config. This now also restores the deck-root `.npmrc` that pins `store-dir=.pnpm-store`.
4. Run `scripts/bootstrap_deck_workspace.sh <project-dir>` when the project needs scaffold files or a fresh `validate-local.sh`.
5. Generate project content (`src/buildDeck.ts`, `src/presentationModel.ts`, tests) from the user's prompt after scaffold init succeeds.
6. Run `scripts/ensure_deck_root.sh <deck-root>` and `scripts/ensure_deck_workspace.sh <project-dir>` for cheap preflight checks and refreshed state.
7. If the shared root is missing runtime dependencies, use `scripts/repair_deck_root.sh <deck-root>`. If the project is missing project-scaffold files, use `scripts/repair_deck_workspace.sh <project-dir>`. In Codex sessions, `repair_deck_root.sh` now stops before `pnpm install` and tells the user to run that install from a local terminal. The same repair flow keeps `uv` cache inside `<deck-root>/.uv-cache`.
8. If project preflight reports legacy generated directories such as `rendered/` or `node_modules/.vite*`, remove them with `scripts/clean_deck_project.sh <project-dir>`.
9. Validate behavior using a separate project directory.
10. If your installed skill path is not already a symlink to this repository, sync this repository into the local Codex skills directory with `scripts/sync_to_codex.sh`.
11. Restart Codex so the updated installed skill is reloaded.
12. Run a real deck task with `$ai-native-slides`.
13. If the workflow is correct, commit and push this repository.

## Example Validation Loop

Use a separate deck project for real validation. For the shared-root layout, script boundaries, template-managed files, and command examples, see `references/project-workflow.md`.

Typical loop:

1. Update this skill repo.
2. Run `scripts/init_deck_project.sh <deck-root> <project-name>` for a fresh or existing project, or pick an existing `projects/<slug>/` directory.
3. Run `scripts/bootstrap_deck_root.sh <deck-root>` so the shared runtime root gets the current helper assets, shared config, and deck-root `.npmrc`.
4. Run `scripts/bootstrap_deck_workspace.sh <project-dir>` so the project gets the current scaffold files and validation wrapper.
5. Generate project content (`src/buildDeck.ts`, `src/presentationModel.ts`, tests) from the user's prompt.
6. Run `scripts/ensure_deck_root.sh <deck-root>` and `scripts/ensure_deck_workspace.sh <project-dir>` to refresh state and spot missing dependencies quickly.
7. If the shared root is missing runtime dependencies, use `scripts/repair_deck_root.sh <deck-root>`. If the project is missing project-scaffold files, use `scripts/repair_deck_workspace.sh <project-dir>`. In Codex sessions, `repair_deck_root.sh` now stops before `pnpm install` and tells the user to run the root-local-store install from a local terminal. Its `uv` steps use `<deck-root>/.uv-cache`.
8. If project preflight reports legacy generated directories such as `rendered/` or `node_modules/.vite*`, remove them with `scripts/clean_deck_project.sh <project-dir>`.
9. Use the current project directory to run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
10. Run render-dependent validation (`render_slides.py`, `slides_test.py`, `create_montage.py`, `detect_font.py`).
11. In Codex sessions, LibreOffice-backed validation is intentionally blocked before `soffice` launches. Treat that part as human-in-the-loop and have the user run it in their own terminal.
12. Fix any gaps in skill instructions or bundled resources.
13. If your installed skill path is not already a symlink to this repository, run `scripts/sync_to_codex.sh`.
14. Restart Codex.
15. Trigger `$ai-native-slides` on the next deck task and confirm the new behavior.

## Local Install / Update

Primary local-development path:

- If `~/.codex/skills/ai-native-slides` is a symlink to this repository, edit this repository directly and restart Codex. No sync step is required.

Fallback path:

Run:

```bash
./scripts/sync_to_codex.sh
```

This syncs the repository contents into the local Codex skills directory:

```text
$CODEX_HOME/skills/ai-native-slides
```

or, if `CODEX_HOME` is unset:

```text
~/.codex/skills/ai-native-slides
```

After syncing, restart Codex to ensure the updated skill is picked up.

## Workspace State

Each project directory keeps a machine-readable state file at:

```text
<project-dir>/.ai-native-slides/state.json
```

Use this file as the cached status of the last bootstrap or ensure run. It is a hint, not the source of truth. The scripts always re-run cheap probes and then update the state file.

Use the `missing`, `warnings`, and `suggestions` fields in the root or project `state.json` file to decide whether repair or cleanup is needed.

## Notes

- Git push is for version control and backup. It does not install or refresh the local skill.
- The local install step is a filesystem sync, not a Git operation.
- This repository has already verified a local symlink workflow for development. Prefer the symlinked install when available, and use `sync_to_codex.sh` only as fallback when your local Codex build does not follow symlinks correctly.
