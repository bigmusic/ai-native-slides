# Project Workflow

## When To Read This

Read this file when you need root/project layout details, script boundaries, template-managed file rules, or concrete commands for initializing, checking, repairing, cleaning, building, and validating a deck project.

## Shared-Root Model

Use one shared deck root and one project directory per deck:

```text
<deck-root>/
  .npmrc
  package.json
  pnpm-lock.yaml
  .pnpm-store/
  .uv-cache/
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
The deck root `.npmrc` pins `store-dir=.pnpm-store`, so shared `pnpm install` traffic stays inside that deck root instead of writing to a host-global store. Shared `uv` commands should likewise use `UV_CACHE_DIR=.uv-cache`, and `repair_deck_root.sh` now does that automatically.

## Script Roles

- `scripts/init_deck_project.sh <deck-root> <project-name>`: preferred idempotent entrypoint for creating or refreshing one project.
- `scripts/create_deck_project.sh <deck-root> <project-name>`: compatibility create-oriented entrypoint; prefer `init_deck_project.sh` for initialize-or-refresh behavior.
- `scripts/bootstrap_deck_root.sh <deck-root>`: sync shared helpers and shared root config.
- `scripts/bootstrap_deck_workspace.sh <project-dir>`: copy project-scoped templates and wrappers into an existing project path; it does not bootstrap the shared root.
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

Prompt-generated project content is created after scaffold initialization, based on the user's deck request:

- `src/buildDeck.ts`
- `src/presentationModel.ts`
- `tests/buildDeck.test.ts`

Optional content starter references live under `assets/content_starters/`. They are not copied automatically during scaffold initialization.

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

Inside Codex, `pnpm validate` still writes an `INCOMPLETE (human-in-the-loop required)` report, but it exits successfully when the only blocked steps are the expected LibreOffice-backed ones. Terminal output should also print the local rerun command and the raw `soffice` command blocks so the user can finish the human-in-the-loop step without opening the markdown report first. The markdown report now always ends with a `Summary` section, including the fully passed case. Real lint/typecheck/test/build failures still exit non-zero.

## Human-In-The-Loop Steps

Shared runtime installation uses `pnpm install` at the deck root. The bootstrap now writes `.npmrc` with `store-dir=.pnpm-store`, so that install stays inside the deck root. In sandboxed Codex sessions, `repair_deck_root.sh` still treats that install as human-in-the-loop and tells the user to run it from a local terminal.
Shared Python environment setup uses `uv`, with cache pinned to `.uv-cache/` under the deck root so the venv bootstrap does not rely on a host-global uv cache.

Render-dependent validation uses LibreOffice. In Codex sessions, the validation scripts intentionally block LibreOffice-backed steps before launching `soffice` and report them as human-in-the-loop instead of trying to run them inside Codex.

Expected behavior in sandbox:

- when root preflight reports missing shared Node dependencies, the next action is to run `pnpm install` from a local terminal
- that install uses the deck-root `.pnpm-store/` configured in `.npmrc`
- shared `uv` commands use the deck-root `.uv-cache/`
- LibreOffice-backed sections are marked human-in-the-loop before `soffice` is launched
- the validation summary says `INCOMPLETE (human-in-the-loop required)`
- render-dependent downstream steps are marked `SKIPPED`
- the next action is to rerun `pnpm validate` from a local terminal
