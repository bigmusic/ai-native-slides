# Project Workflow

## When To Read This

Read this file when you need root/project layout details, script boundaries, template-managed file rules, or concrete commands for initializing, checking, building, and validating a deck project.

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
The deck root `.npmrc` pins `store-dir=.pnpm-store`, so shared `pnpm install` traffic stays inside that deck root instead of writing to a host-global store. Shared `uv` commands should likewise use `UV_CACHE_DIR=.uv-cache`, and `init_deck_root.sh` now does that automatically.

## Script Roles

- `scripts/init_deck_root.sh <deck-root>`: preferred idempotent entrypoint for creating or refreshing the shared deck root before each new project depends on it.
- `scripts/init_deck_project.sh <deck-root> <project-name>`: preferred idempotent entrypoint for creating or refreshing one project's template-managed scaffold without overwriting prompt-generated deck content.
- `scripts/create_deck_project.sh <deck-root> <project-name>`: compatibility create-oriented alias; prefer `init_deck_project.sh` for initialize-or-refresh behavior.
- `scripts/ensure_deck_root.sh <deck-root>`: cheap shared-runtime preflight.
- `scripts/ensure_deck_project.sh <project-dir>`: cheap project preflight and state refresh; it reports gaps but does not repair them.

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

## Common Commands

```bash
# Initialize or refresh one project
bash ~/.codex/skills/ai-native-slides/scripts/init_deck_project.sh /path/to/deck-root my-new-deck
```

```bash
# Refresh root or project preflight state
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_root.sh /path/to/deck-root
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_project.sh /path/to/deck-root/projects/my-new-deck
```

If project preflight reports missing scaffold files or template drift, stay on the normal operator path and rerun `init_deck_project.sh` for that project name.

Maintainer-only recovery and legacy-cleanup workflows are documented in `scripts/maintenance/maintenance-workflow.md`, not here.
Legacy single-workspace migration is also documented in `scripts/maintenance/maintenance-workflow.md`, not here.

```bash
# Initialize or refresh the shared deck root
bash ~/.codex/skills/ai-native-slides/scripts/init_deck_root.sh /path/to/deck-root
```

```bash
# Install shared Node dependencies at the deck root
# Make sure .npmrc is present so pnpm stays inside <deck-root>/.pnpm-store.
cd /path/to/deck-root
pnpm install
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

## PNPM INSTALL and UV

Shared runtime installation uses `pnpm install` at the deck root. The root init flow writes `.npmrc` with `store-dir=.pnpm-store` before it installs dependencies, so that install stays inside the deck root and can run inside Codex.
Shared Python environment setup uses `uv`, with cache pinned to `.uv-cache/` under the deck root so the venv bootstrap does not rely on a host-global uv cache.

## Human-In-The-Loop Steps

Render-dependent validation uses LibreOffice. In Codex sessions, the validation scripts intentionally block LibreOffice-backed steps before launching `soffice` and report them as human-in-the-loop instead of trying to run them inside Codex.

Expected behavior in sandbox:

- when root preflight reports missing shared Node dependencies, the next action is to rerun `scripts/init_deck_root.sh <deck-root>` or run `pnpm install` in the deck root
- that install uses the deck-root `.pnpm-store/` configured in `.npmrc`
- shared `uv` commands use the deck-root `.uv-cache/`
- LibreOffice-backed sections are marked human-in-the-loop before `soffice` is launched
- the validation summary says `INCOMPLETE (human-in-the-loop required)`
- render-dependent downstream steps are marked `SKIPPED`
- the next action is to rerun `pnpm validate` from a local terminal
