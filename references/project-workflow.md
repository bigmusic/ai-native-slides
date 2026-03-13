# Project Workflow

## When To Read This

Read this file when you need root/project layout details, script boundaries, template-managed file rules, or concrete commands for initializing, checking, repairing, cleaning, building, and validating a deck project.

## Shared-Root Model

Use one shared deck root and one project directory per deck:

```text
<deck-root>/
  package.json
  pnpm-lock.yaml
  node_modules/
  .venv/
  biome.jsonc
  tsconfig.base.json
  assets/pptxgenjs_helpers/
  .ai-native-slides/
  projects/
    <slug>/
      src/
      tests/
      output/
      tmp/
      assets/
      .ai-native-slides/project.json
      package.json
      tsconfig.json
      vitest.config.ts
      run-project.sh
      validate-local.sh
```

The root owns the runtime. Each project owns only its content, thin wrappers, metadata, and outputs.

## Script Roles

- `scripts/init_deck_project.sh <deck-root> <project-name>`: preferred idempotent entrypoint for creating or refreshing one project.
- `scripts/create_deck_project.sh <deck-root> <project-name>`: compatibility create-oriented entrypoint; prefer `init_deck_project.sh` for initialize-or-refresh behavior.
- `scripts/bootstrap_deck_root.sh <deck-root>`: sync shared helpers and shared root config.
- `scripts/bootstrap_deck_workspace.sh <project-dir>`: copy project-scoped templates and wrappers into an existing project path.
- `scripts/ensure_deck_root.sh <deck-root>`: cheap shared-runtime preflight.
- `scripts/ensure_deck_workspace.sh <project-dir>`: cheap project preflight.
- `scripts/repair_deck_root.sh <deck-root>`: repair shared runtime dependencies.
- `scripts/repair_deck_workspace.sh <project-dir>`: refresh project-scoped templates, then hand off runtime repair to the root path.
- `scripts/clean_deck_project.sh <project-dir>`: remove safe-to-delete legacy generated directories and caches.
- `scripts/migrate_single_workspace_to_project.sh <legacy-deck> <project-name>`: move a legacy single-workspace deck into the shared-root model.

## Template Boundaries

Template-managed files are copied from `assets/templates/` and can be refreshed safely:

- `.gitignore`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `run-project.sh`
- `validate-local.sh`
- `src/main.ts`

Starter templates are copied only when missing and become project content after that:

- `src/buildDeck.ts`
- `src/presentationModel.ts`
- `tests/buildDeck.test.ts`

Project metadata records these boundaries in `.ai-native-slides/project.json`.

## Cleanup Targets

`clean_deck_project.sh` removes these legacy/generated paths when present:

- `rendered/`
- `output/rendered/`
- `node_modules/.vite`
- `node_modules/.vite-temp`
- empty project-local `node_modules/`

Vitest cache is intentionally redirected to `tmp/.vite`, which stays inside the project and is not considered a legacy target.

## Common Commands

```bash
# Initialize or refresh one project
bash ~/.codex/skills/ai-native-slides/scripts/init_deck_project.sh /path/to/deck-root my-new-deck
```

```bash
# Refresh root or project preflight state
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_root.sh /path/to/deck-root
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_workspace.sh /path/to/deck-root/projects/my-new-deck
```

```bash
# Install shared Node dependencies at the deck root
# In sandboxed Codex sessions, run this in your local terminal (human-in-the-loop).
cd /path/to/deck-root
pnpm install
```

```bash
# Clean legacy generated directories
bash ~/.codex/skills/ai-native-slides/scripts/clean_deck_project.sh /path/to/deck-root/projects/my-new-deck
```

```bash
# Fast TypeScript loop
cd /path/to/deck-root/projects/my-new-deck
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

```bash
# Full validation wrapper
cd /path/to/deck-root/projects/my-new-deck
pnpm validate
```

## Human-In-The-Loop Steps

Shared runtime installation uses `pnpm install` at the deck root. In sandboxed Codex sessions, treat that install step as human-in-the-loop and run it from a local terminal, even if the rest of the bootstrap or ensure flow ran inside Codex.

Render-dependent validation uses LibreOffice. If `soffice` aborts inside a sandboxed Codex session, treat that as human-in-the-loop rather than as a deck-content failure.

Expected behavior in sandbox:

- when root preflight reports missing shared Node dependencies, the next action is to run `pnpm install` from a local terminal
- the report surfaces the failing `soffice` command and exit code
- the validation summary says `INCOMPLETE (human-in-the-loop required)`
- render-dependent downstream steps are marked `SKIPPED`
- the next action is to rerun `pnpm validate` from a local terminal
