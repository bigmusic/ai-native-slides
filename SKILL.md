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
- `pnpm spec:generate`: writes `tmp/planner-context.json` and `tmp/planner-brief.md` from `--prompt "<prompt>"` without mutating `spec/deck-spec.json`; in Codex this starts the skill-native planner phase.
- `pnpm spec`: promotes `tmp/spec-candidate.json` into canonical `spec/deck-spec.json` after local normalization and validation, writes `tmp/review-context.json` plus `tmp/review-brief.md` on success, and prints stable `Failure kind:` / `Retryable by skill:` lines on failure.
- `pnpm spec:review`: promotes `tmp/spec-review-candidate.json` into `tmp/spec-review.json` and `output/spec-review.md`, while enforcing local `pass` / `warn` / `fail` coherence rules plus canonical deck-material/image-prompt scorecard validation for the semantic-review artifact.
- `pnpm spec:validate`: validates the canonical `spec/deck-spec.json` against the scaffold-managed contract without mutating project files.
- `pnpm media`: reads required image assets from canonical `spec/deck-spec.json`, uses Gemini image generation, and writes deck-ready outputs into `media/generated-images/`.

## Responsibility Boundaries

- Skill agent owns:
  - prompt interpretation
  - planner/reviewer candidate authoring
  - the single candidate retry after retryable `pnpm spec` failures
  - TypeScript deck authoring and edits
  - command orchestration and validation interpretation
  - the end-to-end session from prompt intake through deliverable generation
- Local workflow owns:
  - planner context and brief generation
  - canonical spec normalization and promotion
  - structural validation
  - deterministic build output
  - canonical artifact paths and file writes
- Gemini owns:
  - image synthesis only during `pnpm media`
- Gemini does not own:
  - prompt-to-spec candidate generation
  - semantic review
  - deck composition
  - validation logic
- Human responsibilities begin after deliverables exist:
  - review the final `.pptx`, source, generated media, and reports
  - rerun local-terminal LibreOffice-backed validation when needed
  - provide revision feedback for a later skill rerun
- Humans do not own:
  - planner or review candidate authoring
  - candidate retry
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
10. Treat `spec/deck-spec.schema.json`, `src/planner-agent/*`, and `src/spec/*` as template-managed contract files. Treat `spec/deck-spec.json` as canonical project input when it exists.
11. In the current planner-to-spec slice, run `pnpm spec:generate -- --prompt "<prompt>"` first. It writes `tmp/planner-context.json` and `tmp/planner-brief.md`, captures workflow-managed `source_prompt`, and defines the internal skill-phase contract for writing `tmp/spec-candidate.json`.
12. After `pnpm spec:generate`, the same skill-owned session must read `tmp/planner-context.json` and `tmp/planner-brief.md`, then write `tmp/spec-candidate.json`. Write JSON only, keep workflow-managed fields out of the candidate source of truth, and do not mutate `spec/deck-spec.json`, `output/`, or `media/` while authoring the candidate.
13. Run `pnpm spec` after writing the candidate. `pnpm spec` prefers `tmp/planner-context.json` as the canonical source for `source_prompt`. If the context file is missing, v1 still accepts `candidate.source_prompt`, but that path is legacy fallback only. On success it also writes `tmp/review-context.json` and `tmp/review-brief.md` for the semantic-review phase.
14. If `pnpm spec` fails with `Failure kind: candidate_invalid_json` or `Failure kind: candidate_validation_failed`, copy the current candidate to `tmp/spec-candidate.last-invalid.json`, write the stderr failure summary to `tmp/spec-candidate.last-errors.txt`, fix the candidate using only those reported errors, and retry `pnpm spec` once. On any other failure kind, or if the second promotion fails, stop instead of continuing to `spec:review` or `media`.
15. Before writing `tmp/spec-review-candidate.json`, the same skill-owned session must read `tmp/review-context.json` and `tmp/review-brief.md`. Review prompt alignment only; score both deck materials and compiled image prompts; do not rerun structural validation, and do not mutate `spec/deck-spec.json`, `output/`, or `media/` while authoring the review candidate.
16. The local workflow promotes those fixed-path candidate artifacts through `pnpm spec` and `pnpm spec:review`; these commands do not call a model by themselves. These artifacts are internal phase boundaries inside one skill-run, not human checkpoints.
17. Put `GEMINI_API_KEY` in the current shell or in `<deck-root>/.env`. `pnpm media` is the only Gemini-dependent command in v1, and it does not read project-level `.env` files.
18. When maintaining this skill, develop and validate the behavior in the demo project first, then sync reusable template, script, and doc changes back into the skill repo before considering the work complete.
19. Use `pnpm spec:generate`, `pnpm spec`, `pnpm spec:validate`, `pnpm spec:review`, `pnpm media`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` as the fast local loop. The intended operator path is prompt in -> route to a project -> one skill-owned session runs these phases -> deliverables out. `pnpm spec:generate` is the deterministic CLI half of the skill-native planner phase; `pnpm spec` stays fail-fast and emits the review phase artifacts; `pnpm spec:validate` is structural validation only; `pnpm spec:review` promotes a skill-authored semantic review artifact and enforces local status-coherence rules; `pnpm media` is the only Gemini step and requires `spec/deck-spec.json.status` to be `reviewed` or `media_ready`; `pnpm build` remains deterministic and offline. Prefer `pnpm validate` only when you need full render, font, and overflow checks; inside Codex, a blocked validation run should print the local rerun command plus the raw `soffice` command blocks in terminal output, not only in the markdown report.
20. Build the deck in TypeScript with explicit fonts, stable spacing, and editable PowerPoint-native elements when practical. `build` remains deterministic and does not call Gemini.
21. Deliver the `.pptx`, the authoring `.ts`, and any generated media required to rebuild the deck.
22. Post-deliverable review feedback is handled as a new prompt. Resolve the target project again and rerun the end-to-end workflow there instead of manually editing intermediate candidate files.

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
