# Maintenance Workflow

This file documents the maintainer loop for the `ai-native-slides` skill.

## Scope

Keep the skill repo and deck workspaces separate.

- Skill source of truth: this repository
- Installed Codex skill: `$CODEX_HOME/skills/ai-native-slides` or `~/.codex/skills/ai-native-slides`
- Example deck workspace: a separate directory outside this repo, such as `/Volumes/BiGROG/skills-test/ai-education-deck`

Do not use `AGENTS.md` as the primary source of truth for this skill. `AGENTS.md` is workspace-specific. The skill's own maintenance and installation workflow belongs in this repository.

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
2. Run `scripts/bootstrap_deck_workspace.sh <deck-workspace>` when the deck workspace needs helper updates or a fresh `validate-local.sh`.
3. Run `scripts/ensure_deck_workspace.sh <deck-workspace>` for a cheap preflight check and refresh `.ai-native-slides/state.json`.
4. Validate behavior using a separate deck workspace.
5. Sync this repository into the local Codex skills directory.
6. Restart Codex so the updated installed skill is reloaded.
7. Run a real deck task with `$ai-native-slides`.
8. If the workflow is correct, commit and push this repository.

## Example Validation Loop

Use a separate deck workspace for real validation. The workspace should contain the deck source, dependencies, and generated validation artifacts.

Typical loop:

1. Update this skill repo.
2. Run `scripts/bootstrap_deck_workspace.sh <deck-workspace>` so the deck gets the current helper assets and validation wrapper.
3. Run `scripts/ensure_deck_workspace.sh <deck-workspace>` to refresh the workspace state and spot missing dependencies quickly.
4. Use the current deck workspace to build and validate a deck.
5. Fix any gaps in skill instructions or bundled resources.
6. Run `scripts/sync_to_codex.sh`.
7. Restart Codex.
8. Trigger `$ai-native-slides` on the next deck task and confirm the new behavior.

## Local Install / Update

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

## Deck Bootstrap

Use the bootstrap script to prepare a deck workspace:

```bash
./scripts/bootstrap_deck_workspace.sh /path/to/deck
```

This does two things:

- copies `assets/pptxgenjs_helpers/` into the deck workspace
- writes `validate-local.sh` that uses the deck's own `.venv/bin/python` to execute the installed skill's validation scripts
- writes a minimal `package.json` if the deck workspace does not already have one
- refreshes `.ai-native-slides/state.json`

With this workflow, deck-local `scripts/` and `references/` are optional. They can be removed once the deck workspace has switched to the generated `validate-local.sh`.

## Workspace State

The deck workspace keeps a machine-readable state file at:

```text
<deck-workspace>/.ai-native-slides/state.json
```

Use this file as the cached status of the last bootstrap or ensure run. It is a hint, not the source of truth. The scripts always re-run cheap probes and then update the state file.

The main commands are:

```bash
./scripts/bootstrap_deck_workspace.sh /path/to/deck
./scripts/ensure_deck_workspace.sh /path/to/deck
```

Recommended use:

- run `bootstrap_deck_workspace.sh` the first time or after skill-side helper/template changes
- run `ensure_deck_workspace.sh` on later visits to the same workspace
- use the `missing`, `warnings`, and `suggestions` fields in `state.json` to decide whether the workspace needs repair

## Notes

- Git push is for version control and backup. It does not install or refresh the local skill.
- The local install step is a filesystem sync, not a Git operation.
- Prefer sync/copy over symbolic links unless you have already verified symlink behavior in your local Codex build.
