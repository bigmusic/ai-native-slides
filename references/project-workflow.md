# Project Workflow

## When To Read This

Read this file when you need root/project layout details, script boundaries, template-managed file rules, or concrete commands for initializing, checking, building, and validating a deck project.

## Current Workspace Development Roles

In this workspace:

- skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`

Use the demo project for implementation, smoke tests, and validation. After a reusable change is confirmed there, sync the reusable parts back into the skill repo:

- `ai-native-slides/assets/templates/` for scaffold-managed project files
- `ai-native-slides/scripts/` for reusable shell helpers
- `ai-native-slides/` and `ai-native-slides/references/` for user-facing docs

For the current development loop, keep the concrete project name fixed at `ai-native-product-deck`.

## Intent Routing At Session Start

Every end-to-end session begins by routing the user's prompt to one of two intents:

- `new_project`
- `revise_existing_project`

Routing rules:

- Prefer explicit prompt wording first. `Create project <slug>` is `new_project`. `Revise project <slug>` or `Update project <slug>` is `revise_existing_project`.
- If the session is already scoped to one project, confirm the active project with `.ai-native-slides/project.json` and `.ai-native-slides/state.json` before editing.
- In this workspace's maintenance loop, the default revision target is `ai-native-product-deck` unless the user explicitly asks for a different project or a fresh one.
- If the prompt is ambiguous and project selection is risky, stop and ask whether the user wants a new project or a revision run.
- Post-deliverable feedback is not a separate workflow phase. It becomes a new prompt that re-enters this routing step.

## Session Ownership

One user prompt should map to one skill-agent-owned end-to-end session.

Within that same session, the skill agent is expected to:

- classify the prompt as `new_project` or `revise_existing_project`
- resolve the target project before changing files
- converge the root and project scaffold
- run `pnpm spec -- --prompt "<prompt>"`
- generate media
- author or revise `src/buildDeck.ts`, `src/presentationModel.ts`, and project tests
- run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and when needed `pnpm validate`
- produce deliverables

Deterministic CLI steps are guardrails inside that same skill session. They are not human approval checkpoints and not external-agent boundaries.

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
      spec/
      media/
      src/
      tests/
      output/
      tmp/
      .ai-native-slides/project.json
      package.json
      tsconfig.json
      vitest.config.ts
      run-project.sh
      validate-local.sh
```

The root owns the runtime. Each project owns only its content, thin wrappers, metadata, and outputs.
The deck root `.npmrc` pins `store-dir=.pnpm-store`, so shared `pnpm install` traffic stays inside that deck root instead of writing to a host-global store. Shared `uv` commands should likewise use `UV_CACHE_DIR=.uv-cache`, and `init_deck_root.sh` now does that automatically.
The deck-root `package.json` also links `@ai-native-slides/deck-spec-module` from the workspace package, so project-local wrappers resolve the shared TypeScript entrypoints through the parent `node_modules` tree without adding `projects/*` to the workspace.

## Script Roles

- `scripts/init_deck_root.sh <deck-root>`: preferred idempotent entrypoint for creating or refreshing the shared deck root before each new project depends on it.
- `scripts/init_deck_project.sh <deck-root> <project-name>`: preferred idempotent entrypoint for creating or refreshing one project's template-managed scaffold without overwriting prompt-generated deck content.
- `scripts/create_deck_project.sh <deck-root> <project-name>`: compatibility create-oriented alias; prefer `init_deck_project.sh` for initialize-or-refresh behavior.
- `scripts/ensure_deck_root.sh <deck-root>`: cheap shared-runtime preflight.
- `scripts/ensure_deck_project.sh <project-dir>`: cheap project preflight and state refresh; it reports gaps but does not repair them.

## Template Boundaries

Template-managed files are copied from `assets/templates/` and can be refreshed safely:

- `.gitignore`
- `spec/deck-spec.schema.json`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `run-project.sh`
- `validate-local.sh`
- `tests/projectScaffoldMaintenance.test.ts`
- `src/main.ts`
- `src/media/generatedImagePaths.ts`
- `src/spec/contract.ts`
- `src/spec/deriveOutputFileName.ts`
- `src/spec/normalizeSystemManagedFields.ts`
- `src/spec/runDeckSpec.ts`
- `src/spec/readDeckSpec.ts`
- `src/spec/rendererContract.ts`
- `src/spec/renderSpecReview.ts`
- `src/spec/reviewContract.ts`
- `src/spec/validateDeckSpec.ts`
- `src/spec/validateSpecReview.ts`
- `src/spec/writeFileAtomic.ts`

Prompt-generated project content is created after scaffold initialization, based on the user's deck request:

- `spec/deck-spec.json`
- `src/buildDeck.ts`
- `src/presentationModel.ts`
- `tests/buildDeck.test.ts`

Optional content starter references live under `assets/content_starters/`. They are not copied automatically during scaffold initialization.

Project metadata records these boundaries in `.ai-native-slides/project.json`.

## Common Commands

```bash
# Initialize or refresh one project
bash ~/.codex/skills/ai-native-slides/scripts/init_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck ai-native-product-deck
```

```bash
# Refresh root or project preflight state
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck
```

If project preflight reports missing scaffold files or template drift, stay on the normal operator path and rerun `init_deck_project.sh` for that project name.

Maintainer-only recovery and legacy-cleanup workflows are documented in `scripts/maintenance/maintenance-workflow.md`, not here.
Legacy single-workspace migration is also documented in `scripts/maintenance/maintenance-workflow.md`, not here.

```bash
# Initialize or refresh the shared deck root
bash ~/.codex/skills/ai-native-slides/scripts/init_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck
```

```bash
# Install shared Node dependencies at the deck root
# Make sure .npmrc is present so pnpm stays inside <deck-root>/.pnpm-store.
cd /Volumes/BiGROG/skills-test/ai-education-deck
pnpm install
```

```bash
# Fast TypeScript loop
cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck
pnpm spec -- --prompt "Summarize the requested deck"
pnpm spec:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Before running that loop, resolve whether the prompt is creating a new project or revising an existing one. For operator-facing prompt wording, prefer explicit phrasing such as `Create project <slug>` or `Revise project <slug>`.

`pnpm spec -- --prompt "<prompt>"` is now the single happy-path provider-backed command. The project wrapper forwards into the shared package at `<deck-root>/packages/deck-spec-module/` with explicit canonical-spec, artifact-root, and media-output paths. The shared CLI fails fast if those output paths are omitted. Treat the shared module as a stateless black box: wrappers own project discovery and default path selection, while the module consumes explicit inputs, owns normalization, structural validation, semantic review, one internal repair retry, canonical publish, media generation, and artifact-bundle writes. On pre-publish failure it leaves the canonical target untouched; on post-publish media failure it keeps the canonical spec at `reviewed` and reports a stable failure kind. Use `--no-media` only when you explicitly want to skip the image phase.

`pnpm spec:validate` performs structural validation only. The project wrapper routes it through the shared package's `pnpm spec:validate` CLI, which checks the canonical `spec/deck-spec.json` against `spec/deck-spec.schema.json` plus local rule validation without mutating project files.

For operator usage, the supported shared-module entrypoints are the package `pnpm` CLIs (`spec`, `spec:validate`, and `spec:live`). Do not wire workflows to `packages/deck-spec-module/src/cli/*` paths directly. For TypeScript usage, keep project wrappers on the curated package exports `@ai-native-slides/deck-spec-module`, `@ai-native-slides/deck-spec-module/spec`, and `@ai-native-slides/deck-spec-module/review`. For package-maintainer deterministic tests, use the curated `@ai-native-slides/deck-spec-module/testing` seam instead of deep-importing planner/media/reviewing implementation files from `src/*`.

Every `pnpm spec -- --prompt "<prompt>"` run writes the same fixed artifact bundle under `<deck-root>/tmp/deck-spec-module/<project-slug>/` by default:

- `result.json`
- `diagnostics.json`
- `candidate.primary.json`
- `candidate.fallback.json`
- `review.final.json`
- `generated-assets.manifest.json`
- `media.result.json`
- `media.failures.json`
- `report.md`

`pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"] [--no-media]` is the opt-in provider-backed smoke from the deck root. It writes only to the caller-selected temp root and does not mutate the project canonical spec.

`pnpm spec` is now also the only image-generation step. It reads `GEMINI_API_KEY` from the current shell or from `<deck-root>/.env`, writes canonical deck-ready files into `media/generated-images/`, and supports `--no-media` when you need to skip that phase explicitly.

The expected fast loop from `pnpm spec` through `pnpm build` runs without human intervention. Human review starts after those artifacts exist.

```bash
# Full validation wrapper
cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck
pnpm validate
```

`pnpm validate` now always starts from a fresh `pnpm build` and aborts artifact checks if that build does not produce a new `.pptx` for the current run. It no longer accepts or falls back to older `output/*.pptx` files. Inside Codex, `pnpm validate` still writes an `INCOMPLETE (human-in-the-loop required)` report and exits successfully when the only blocked steps are the expected LibreOffice-backed ones. Terminal output should also print the local rerun command and the raw `soffice` command blocks so the user can finish the human-in-the-loop step without opening the markdown report first. The markdown report now always ends with a `Summary` section, including the fully passed case. Real lint/typecheck/test/build failures still exit non-zero.

## PNPM INSTALL and UV

Shared runtime installation uses `pnpm install` at the deck root. The root init flow writes `.npmrc` with `store-dir=.pnpm-store` before it installs dependencies, so that install stays inside the deck root and can run inside Codex.
Shared Python environment setup uses `uv`, with cache pinned to `.uv-cache/` under the deck root so the venv bootstrap does not rely on a host-global uv cache.

## Human-In-The-Loop Steps

Render-dependent validation uses LibreOffice. In Codex sessions, the validation scripts intentionally block LibreOffice-backed steps before launching `soffice` and report them as human-in-the-loop instead of trying to run them inside Codex.

This human-in-the-loop validation happens after deliverables exist. It is a post-deliverable review aid, not a mid-session planning checkpoint.

Expected behavior in sandbox:

- when root preflight reports missing shared Node dependencies, the next action is to rerun `scripts/init_deck_root.sh <deck-root>` or run `pnpm install` in the deck root
- that install uses the deck-root `.pnpm-store/` configured in `.npmrc`
- shared `uv` commands use the deck-root `.uv-cache/`
- LibreOffice-backed sections are marked human-in-the-loop before `soffice` is launched
- the validation summary says `INCOMPLETE (human-in-the-loop required)`
- render-dependent downstream steps are marked `SKIPPED`
- the next action is to rerun `pnpm validate` from a local terminal

After that review, revision feedback should be phrased as a new prompt that names the target project and starts a new skill-owned session instead of manually patching intermediate planner or review candidate files.
