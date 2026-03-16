---
name: ai-native-slides
description: Create and edit presentation slide decks (`.pptx`) with PptxGenJS, bundled layout helpers, and render/validation utilities. Use when tasks involve building a new PowerPoint deck, recreating slides from screenshots/PDFs/reference decks, modifying slide content while preserving editable output, adding charts/diagrams/visuals, or diagnosing layout issues such as overflow, overlaps, and font substitution.
---

# AI Native Slides

## Overview

Use PptxGenJS for slide authoring. Do not use `python-pptx` for deck generation unless the task is inspection-only.

Keep editable output in TypeScript and deliver both the `.pptx` and the source `.ts`.

## Workspace Rules

- Keep all deck work under the current workspace's deck root.
- Use one project directory per deck at `projects/<slug>/`.
- Keep project-scoped source, tests, metadata, wrappers, outputs, temporary files, renders, and validation artifacts in that project directory.
- Keep shared runtime and config at the deck root.
- Use this skill folder only for shared helpers, scripts, assets, and references.
- Copy final artifacts elsewhere only after rendering and validation pass, and only if the user explicitly asks.

## Current Workspace Roles

In this workspace, the roles are:

- skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`

When maintaining the skill itself, use the demo project as the development and validation workspace. For the current development loop, keep the concrete project name fixed at `ai-native-product-deck`. After a reusable change works there, sync the reusable parts back into the skill repo templates, scripts, and docs.

## Session Routing

Every end-to-end skill session starts by classifying the user's prompt as one of:

- `new_project`
- `revise_existing_project`

Routing rules:

- Prefer explicit prompt wording first. `Create project <slug>` means `new_project`. `Revise project <slug>` or `Update project <slug>` means `revise_existing_project`.
- When the session is already scoped to one project, use `.ai-native-slides/project.json` and `.ai-native-slides/state.json` to confirm the active project before changing anything.
- In this workspace's maintenance loop, revision prompts default to `ai-native-product-deck` unless the user explicitly names another project or clearly asks for a fresh one.
- If the prompt is ambiguous and the wrong interpretation could modify the wrong deck, stop and ask the user whether they want a new project or a revision run.
- Post-deliverable review feedback is not a separate tracked phase inside the workflow. It becomes a new prompt that re-enters this routing step.

## Primary Entry Points

- `scripts/init_deck_root.sh`: preferred idempotent entry point for creating or refreshing the shared deck root so each new project can rely on a complete shared runtime/config.
- `scripts/init_deck_project.sh`: preferred idempotent project entry point for create-or-refresh of template-managed project files while preserving prompt-generated deck content.
- `scripts/ensure_deck_root.sh` and `scripts/ensure_deck_project.sh`: cheap preflight checks.
- `assets/pptxgenjs_helpers/`: shared helper code copied into the deck root.
- `assets/templates/`: project-scaffold templates and wrappers copied into each project.
- `assets/content_starters/`: optional reference starters for prompt-generated deck content.
- `pnpm spec -- --prompt "<prompt>"`: main happy-path entrypoint. The project wrapper forwards into the shared `deck-spec-module` with explicit canonical-spec, artifact-root, and media-output paths, and the module itself writes canonical `spec/deck-spec.json`, generated media, and a fixed artifact bundle after module-internal validation/eval succeeds.
- `pnpm spec:validate`: validates the canonical `spec/deck-spec.json` by forwarding into the shared package's `pnpm spec:validate` CLI without mutating project files.
- `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"] [--no-media]`: opt-in provider-backed smoke from the deck root. It writes only to the caller-selected temp root and does not mutate the project canonical spec.

For operator workflows, treat those `pnpm` commands as the stable shared-module entrypoints. Do not treat `packages/deck-spec-module/src/*` file paths as supported operator entrypoints.

## Responsibility Boundaries

- Skill agent owns:
  - TypeScript deck authoring and edits
  - command orchestration and validation interpretation
  - the end-to-end session from prompt intake through deliverable generation
- Stateless deck-spec module owns:
  - a stateless black-box boundary behind explicit caller inputs
  - external-model prompt-to-canonical-spec planning
  - internal asset planning and filename derivation
  - module-internal validation/eval and one repair retry prior to publish
  - canonical spec file writes
  - fixed artifact-bundle writes
- Stateless deck-spec module does not own:
  - deck-root / project-root discovery
  - default runtime path selection
  - project-local mutable state
  - hidden package-local output directories
- Current caveat:
  - the operator CLI boundary now routes through the package `pnpm` scripts, but the package is not yet fully integration-isolated overall because other wrapper surfaces still import `packages/deck-spec-module/src/*`
- Project wrapper owns:
  - deck-root / project-root discovery
  - default path selection for `canonicalSpecPath`, `artifactRootDir`, and `mediaOutputDir`
  - forwarding CLI invocations into the shared package
  - deterministic build output outside planning
- Gemini owns:
  - spec generation inside the stateless deck-spec module
  - image synthesis during the default `pnpm spec` media phase
- Gemini does not own:
  - deck composition
  - validation logic
- Human responsibilities begin after deliverables exist:
  - review the final `.pptx`, source, generated media, and reports
  - rerun local-terminal LibreOffice-backed validation when needed
  - provide revision feedback for a later skill rerun
- Humans do not own:
  - manual canonical spec patching as a substitute for rerunning the module
  - module-internal repair retry
  - mid-session approval checkpoints

## Workflow

1. Use the current workspace as the deck root. For this maintenance loop, treat `ai-native-product-deck` as the default active project for revision prompts unless the user explicitly asks for another project or for a new project.
2. At the start of every session, classify the prompt as `new_project` or `revise_existing_project`.
3. Resolve the target project from explicit prompt wording first. If the session is already scoped to one project, use `.ai-native-slides/project.json` and `.ai-native-slides/state.json` to confirm the active project before proceeding.
4. Use the root scripts as deterministic entry points for the deck root: run `scripts/ensure_deck_root.sh` for preflight, then rerun `scripts/init_deck_root.sh` whenever a new project needs a complete shared runtime/config. This layer handles only root `package.json`, `.npmrc`, shared helpers, root metadata, `node_modules`, and `.venv`, and it is safe to rerun as a converge step.
5. If the target is a new project, use `scripts/init_deck_project.sh <deck-root> <project-slug>` to create or refresh that project's scaffold. For the current demo project, the concrete command is `scripts/init_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck ai-native-product-deck`. Use `scripts/ensure_deck_project.sh` only for cheap preflight or state refresh; if project preflight is incomplete or template-managed files have drifted during edit work, rerun `scripts/init_deck_project.sh` so the project scaffold converges without overwriting prompt-generated deck content.
6. Treat `.ai-native-slides/state.json` as the machine-readable record of scaffold state, not as project content.
7. Let `scripts/init_deck_root.sh` restore the deck-root `.npmrc` and run `pnpm install` in Codex so the shared store stays inside `<deck-root>/.pnpm-store`. LibreOffice-backed validation is still human-in-the-loop in Codex and requires a local-terminal rerun.
8. Set the slide size up front. Default to 16:9 (`LAYOUT_WIDE`) unless the source material clearly uses another aspect ratio.
9. Generate or revise project content only after both root and project scaffolds are ready. Write `src/buildDeck.ts`, `src/presentationModel.ts`, and project tests from the routed prompt and the target project's current state.
10. Treat `spec/deck-spec.schema.json`, `src/spec/*`, and `src/media/generatedImagePaths.ts` as template-managed contract files. Treat `spec/deck-spec.json` as canonical project input when it exists.
11. Use `pnpm spec -- --prompt "<prompt>"` as the main happy-path command. The project wrapper must pass explicit canonical-spec, artifact-root, and media-output paths into the shared CLI. That CLI fails fast if the required output paths are omitted, and then invokes the stateless deck-spec module. Treat that module as a black box: it consumes explicit inputs, does not discover project context on its own, does not infer output paths, and writes canonical `spec/deck-spec.json` plus media only on success or recoverable post-publish media failure.
12. Every `pnpm spec` run writes the module artifact bundle under the selected artifact root. For the default project wrapper, that path is `<deck-root>/tmp/deck-spec-module/<project-slug>/`.
13. If `pnpm spec` exits with failure, inspect the emitted module artifact bundle, then revise the prompt or rerun the command. Do not manually patch canonical `spec/deck-spec.json` as a substitute for rerunning the prompt-driven flow.
14. Put `GEMINI_API_KEY` in the current shell or in `<deck-root>/.env`. `pnpm spec` and `pnpm spec:live` may require that key in v1, and they do not read project-level `.env` files.
15. When maintaining this skill, develop and validate the behavior in the demo project first, then sync reusable template, script, and doc changes back into the skill repo before considering the work complete.
16. Use `pnpm spec -- --prompt "<prompt>"`, `pnpm spec:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` as the fast local loop. `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--no-media]` is the opt-in provider-backed smoke. The intended operator path is prompt in -> route to a project -> one skill-owned session runs `pnpm spec -- --prompt "<prompt>"` -> canonical publish plus artifact bundle plus generated media -> deliverables out. `pnpm spec:validate` remains structural validation through the shared package CLI, `pnpm spec` runs the Gemini-backed media phase by default, `--no-media` is the only supported skip switch, and `pnpm build` remains deterministic and offline. Prefer `pnpm validate` only when you need full render, font, and overflow checks; it now validates only the `.pptx` produced by the current build run and never falls back to older output artifacts. Inside Codex, a blocked validation run should print the local rerun command plus the raw `soffice` command blocks in terminal output, not only in the markdown report.
17. Build the deck in TypeScript with explicit fonts, stable spacing, and editable PowerPoint-native elements when practical. `build` remains deterministic and does not call Gemini.
18. Deliver the `.pptx`, the authoring `.ts`, and any generated media required to rebuild the deck.
19. Post-deliverable review feedback is handled as a new prompt. Resolve the target project again and rerun the end-to-end workflow there instead of manually editing intermediate candidate files.

## Load Next

- `references/project-workflow.md`: root/project layout, script boundaries, template-managed files, and command examples.
- `references/pptxgenjs-helpers.md`: helper API summary, dependency notes, and validation script descriptions.

## Authoring Rules

- Set theme fonts explicitly. Do not rely on PowerPoint defaults if typography matters.
- Use `autoFontSize`, `calcTextBox`, and related helpers to size text boxes; do not use PptxGenJS `fit` or `autoFit`.
- Never generate negative geometry. Any derived `x`, `y`, `w`, `h`, or equivalent DrawingML extents must remain positive after padding, inset, and offset math. Clamp computed sizes with `Math.max(...)`, and if a text area becomes too small, shrink text with `autoFontSize()` or enlarge the container instead of emitting a negative text-box height.
- Do not treat LibreOffice render success as sufficient proof that the deck is PowerPoint-safe. Invalid Open XML geometry can still trigger macOS PowerPoint repair even when LibreOffice renders the deck.
- Use bullet options, not literal `•` characters.
- Use `imageSizingCrop` or `imageSizingContain` instead of PptxGenJS built-in image sizing.
- Use `latexToSvgDataUri()` for equations and `codeToRuns()` for syntax-highlighted code blocks.
- Prefer native PowerPoint charts for simple bar/line/pie/histogram style visuals so reviewers can edit them later.
- For charts or diagrams that PptxGenJS cannot express well, render SVG externally and place the SVG in the slide.
- Keep the authoring source under `src/` and the fast regression loop under `tests/`.
- Include both `warnIfSlideHasOverlaps(slide, pptx)` and `warnIfSlideElementsOutOfBounds(slide, pptx)` in the submitted TypeScript whenever you generate or substantially edit slides.
- Fix all unintentional overlap and out-of-bounds warnings before delivering. If an overlap is intentional, leave a short code comment near the relevant element.

## Recreate Or Edit Existing Slides

- Render the source deck or reference PDF first so you can compare slide geometry visually.
- Match the original aspect ratio before rebuilding layout.
- Preserve editability where possible: text should stay text, and simple charts should stay native charts.
- If a reference slide uses raster artwork, use `ensure_raster_image.py` to generate debug PNGs from vector or odd image formats before placing them.

Use `.ai-native-slides/state.json` in the deck root and each project directory as the machine-readable record of the last bootstrap or ensure check.
