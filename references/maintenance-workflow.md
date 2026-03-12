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
2. Validate behavior using a separate deck workspace.
3. Sync this repository into the local Codex skills directory.
4. Restart Codex so the updated installed skill is reloaded.
5. Run a real deck task with `$ai-native-slides`.
6. If the workflow is correct, commit and push this repository.

## Example Validation Loop

Use a separate deck workspace for real validation. The workspace should contain the deck source, dependencies, and generated validation artifacts.

Typical loop:

1. Update this skill repo.
2. Use the current deck workspace to build and validate a deck.
3. Fix any gaps in skill instructions or bundled resources.
4. Run `scripts/sync_to_codex.sh`.
5. Restart Codex.
6. Trigger `$ai-native-slides` on the next deck task and confirm the new behavior.

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

## Notes

- Git push is for version control and backup. It does not install or refresh the local skill.
- The local install step is a filesystem sync, not a Git operation.
- Prefer sync/copy over symbolic links unless you have already verified symlink behavior in your local Codex build.
