# Maintenance Workflow

This file documents the maintainer loop for the `ai-native-slides` skill.

It lives under `scripts/maintenance/` because it describes maintainer-only tooling and recovery paths, not the normal operator workflow for deck projects.

## Scope

Keep the skill repo and deck workspaces separate.

- Skill source of truth: this repository
- Installed Codex skill: `$CODEX_HOME/skills/ai-native-slides` or `~/.codex/skills/ai-native-slides`
- Example deck root: a separate directory outside this repo, such as `/Volumes/BiGROG/skills-test/ai-education-deck`

Do not use `AGENTS.md` as the primary source of truth for this skill. `AGENTS.md` is workspace-specific. The skill's own maintenance and installation workflow belongs in this repository.

For root/project layout details, template-managed file boundaries, and common operator commands, load `references/project-workflow.md`. This file focuses on the maintainer loop for the skill itself and owns maintainer-only recovery, cleanup, migration, and local-skill-sync details.

## What "Repair" Means

`repair_deck_project.sh` is a maintainer recovery tool for an existing project directory.

Use it only when you are deliberately repairing or re-validating the scaffold layer, for example:

- template-managed files such as `run-project.sh`, `validate-local.sh`, `package.json`, or `tsconfig.json` have drifted or need forced refresh
- a change to the skill templates needs to be propagated into an existing project while exercising the explicit recovery path
- you are validating that the maintainer recovery path itself still works

Do not use it as the normal way to regenerate deck content. It does not rebuild prompt-generated business files such as `src/buildDeck.ts` or `src/presentationModel.ts`; normal operator flow should still use `init_deck_project.sh`.

## What "Clean" Means

`clean_deck_project.sh` is a maintainer cleanup tool for legacy generated directories inside an existing project directory.

Use it only when you are deliberately cleaning migration leftovers or old cache locations, for example:

- an older project still has `rendered/` or `output/rendered/` from a previous layout
- an older workflow left project-local `node_modules/.vite*` caches behind
- preflight reports legacy cleanup targets and you want to normalize the project directory before further validation

Do not use it as part of normal create, edit, or rebuild flows. A current project should not need this command during ordinary deck work.

`clean_deck_project.sh` removes these legacy/generated paths when present:

- `rendered/`
- `output/rendered/`
- `node_modules/.vite`
- `node_modules/.vite-temp`
- empty project-local `node_modules/`

Vitest cache is intentionally redirected to `tmp/.vite`, which stays inside the project and is not considered a legacy target.

## What "Migrate" Means

`migrate_single_workspace_to_project.sh` is a maintainer migration tool for converting an older single-workspace deck into the shared-root `projects/<slug>/` layout.

Use it only when you are deliberately moving a legacy deck into the current shared-root model. It is not part of the normal create/edit flow for new projects.

## What "Sync" Means

`sync_to_codex.sh` is a maintainer install helper for copying this repository into the local Codex skills directory when the local install is not already a symlink to this repository.

Use it only for maintaining the skill installation itself. It is not part of any deck project workflow.

Current local setup note:

- In this workspace, the installed skill path is a symlink to this repository.
- That means edits here are already the installed skill source seen by Codex after restart.
- `scripts/maintenance/sync_to_codex.sh` is a fallback only for environments where the installed skill is a normal copied directory or where symlink-based loading is unreliable.

## Repository Layout

The skill repo should contain reusable skill resources only:

- `SKILL.md`
- `assets/`
- `scripts/`
- `references/`
- `scripts/maintenance/`

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
3. Run `scripts/init_deck_root.sh <deck-root>` whenever the shared runtime root needs initialization or refresh, especially before spinning up a new project. This flow converges the shared root config and restores the deck-root `.npmrc` that pins `store-dir=.pnpm-store`.
4. Run `scripts/bootstrap_deck_project.sh <project-dir>` only when you are maintaining template-managed project files directly; normal operator flow should go through `scripts/init_deck_project.sh`.
5. Generate project content (`src/buildDeck.ts`, `src/presentationModel.ts`, tests) from the user's prompt after scaffold init succeeds.
6. Run `scripts/ensure_deck_root.sh <deck-root>` and `scripts/ensure_deck_project.sh <project-dir>` for cheap preflight checks and refreshed state.
7. If the shared root is missing runtime dependencies or shared config, rerun `scripts/init_deck_root.sh <deck-root>`. If the project is missing project-scaffold files or template-managed files have drifted during edit work, rerun `scripts/init_deck_project.sh <deck-root> <project-name>` so the operator path stays idempotent and deterministic. Use `scripts/maintenance/repair_deck_project.sh <project-dir>` only for maintainer-oriented scaffold recovery on an already identified project directory. In Codex sessions, `init_deck_root.sh` restores the deck-root `.npmrc` and runs `pnpm install` directly so the shared store stays inside `<deck-root>/.pnpm-store`. The same init flow keeps `uv` cache inside `<deck-root>/.uv-cache`.
8. If project preflight reports legacy generated directories such as `rendered/` or `node_modules/.vite*`, remove them with `scripts/maintenance/clean_deck_project.sh <project-dir>`.
9. If you are working with an older single-workspace deck, migrate it with `scripts/maintenance/migrate_single_workspace_to_project.sh <legacy-deck> <project-name>`.
10. Validate behavior using a separate project directory.
11. If your installed skill path is not already a symlink to this repository, sync this repository into the local Codex skills directory with `scripts/maintenance/sync_to_codex.sh`.
12. Restart Codex so the updated installed skill is reloaded.
13. Run a real deck task with `$ai-native-slides`.
14. If the workflow is correct, commit and push this repository.

## Example Validation Loop

Use a separate deck project for real validation. For the shared-root layout, script boundaries, template-managed files, and command examples, see `references/project-workflow.md`.

Typical loop:

1. Update this skill repo.
2. Run `scripts/init_deck_project.sh <deck-root> <project-name>` for a fresh or existing project, or pick an existing `projects/<slug>/` directory.
3. Run `scripts/init_deck_root.sh <deck-root>` so the shared runtime root gets the current helper assets, shared config, runtime dependencies when possible, and deck-root `.npmrc`.
4. Run `scripts/bootstrap_deck_project.sh <project-dir>` only when you are explicitly validating template refresh behavior; normal project setup should still go through `scripts/init_deck_project.sh`.
5. Generate project content (`src/buildDeck.ts`, `src/presentationModel.ts`, tests) from the user's prompt.
6. Run `scripts/ensure_deck_root.sh <deck-root>` and `scripts/ensure_deck_project.sh <project-dir>` to refresh state and spot missing dependencies quickly.
7. If the shared root is missing runtime dependencies, rerun `scripts/init_deck_root.sh <deck-root>`. If the project is missing project-scaffold files or template-managed files have drifted during edit work, rerun `scripts/init_deck_project.sh <deck-root> <project-name>`. Use `scripts/maintenance/repair_deck_project.sh <project-dir>` only when you are deliberately exercising the maintainer recovery path. In Codex sessions, `init_deck_root.sh` restores the deck-root `.npmrc` and runs the root-local-store `pnpm install` directly. Its `uv` steps use `<deck-root>/.uv-cache`.
8. If project preflight reports legacy generated directories such as `rendered/` or `node_modules/.vite*`, remove them with `scripts/maintenance/clean_deck_project.sh <project-dir>`.
9. If you are validating an older single-workspace deck, migrate it with `scripts/maintenance/migrate_single_workspace_to_project.sh <legacy-deck> <project-name>`.
10. Use the current project directory to run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
11. Run render-dependent validation (`render_slides.py`, `slides_test.py`, `create_montage.py`, `detect_font.py`).
12. In Codex sessions, LibreOffice-backed validation is intentionally blocked before `soffice` launches. Treat that part as human-in-the-loop and have the user run it in their own terminal.
13. Fix any gaps in skill instructions or bundled resources.
14. If your installed skill path is not already a symlink to this repository, run `scripts/maintenance/sync_to_codex.sh`.
15. Restart Codex.
16. Trigger `$ai-native-slides` on the next deck task and confirm the new behavior.

## Local Install / Update

Primary local-development path:

- If `~/.codex/skills/ai-native-slides` is a symlink to this repository, edit this repository directly and restart Codex. No sync step is required.

Fallback path:

Run:

```bash
./scripts/maintenance/sync_to_codex.sh
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
- This repository has already verified a local symlink workflow for development. Prefer the symlinked install when available, and use `scripts/maintenance/sync_to_codex.sh` only as fallback when your local Codex build does not follow symlinks correctly.
