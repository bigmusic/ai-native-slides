---
name: ai-native-slides
description: Create and edit presentation slide decks (`.pptx`) with PptxGenJS, bundled layout helpers, and render/validation utilities. Use when tasks involve building a new PowerPoint deck, recreating slides from screenshots/PDFs/reference decks, modifying slide content while preserving editable output, adding charts/diagrams/visuals, or diagnosing layout issues such as overflow, overlaps, and font substitution.
---

# AI Native Slides

## Overview

Use PptxGenJS for slide authoring. Do not use `python-pptx` for deck generation unless the task is inspection-only; keep editable output in TypeScript and deliver both the `.pptx` and the source `.ts`.

Keep work in a task-local directory. Only copy final artifacts to the requested destination after rendering and validation pass.
Keep this skill folder reusable: put helpers, scripts, assets, and references here, but keep generated decks and validation outputs in separate task workspaces.
For ongoing work, prefer a parent deck root that contains one project directory per PPT under `projects/<slug>/`. The shared runtime and shared config live at the deck root; each project directory keeps only project-scoped source, tests, metadata, wrappers, and outputs.
The deck root bootstrap now also writes a root-local `.npmrc` with `store-dir=.pnpm-store` so shared `pnpm` installs stay inside the deck root instead of reusing a host-global store. The repair flow also pins `uv` cache to `.uv-cache/` under the same deck root.

## Primary Entry Points

- `scripts/init_deck_project.sh`: preferred project initializer for create-or-refresh.
- `scripts/ensure_deck_root.sh` and `scripts/ensure_deck_workspace.sh`: cheap preflight checks.
- `scripts/repair_deck_root.sh` and `scripts/repair_deck_workspace.sh`: repair shared runtime or project-scoped bootstrap files.
- `scripts/clean_deck_project.sh`: remove legacy generated directories such as old `rendered/` folders or project-local `node_modules/.vite*`.
- `assets/pptxgenjs_helpers/`: shared helper code copied into the deck root.
- `assets/templates/`: project-scaffold templates and wrappers copied into each project.
- `assets/content_starters/`: optional reference starters for prompt-generated deck content.

## Workflow

1. Inspect the request and determine whether you are creating a new deck, recreating an existing deck, or editing one.
2. Set the slide size up front. Default to 16:9 (`LAYOUT_WIDE`) unless the source material clearly uses another aspect ratio.
3. For long-lived work, initialize a project directory under a parent deck root with `scripts/init_deck_project.sh <deck-root> <project-name>`.
4. Re-run `scripts/ensure_deck_workspace.sh <project-dir>` when reusing an existing project. Read `.ai-native-slides/state.json` to tell apart scaffold readiness from missing project content.
5. Repair missing runtime or project bootstrap files with the corresponding `repair_*` script. In Codex sessions, `repair_deck_root.sh` and the root-repair portion of `repair_deck_workspace.sh` must stop before `pnpm install`; have the user run that install from a local terminal. LibreOffice-backed validation is also human-in-the-loop in Codex: the validation scripts intentionally block `soffice` there and require a local-terminal rerun.
6. After the scaffold is ready, generate `src/buildDeck.ts`, `src/presentationModel.ts`, and project tests from the user's prompt.
7. Build the deck in TypeScript with explicit fonts, stable spacing, and editable PowerPoint-native elements when practical.
8. Use `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` as the fast local loop. Prefer `pnpm validate` only when you need full render, font, and overflow checks; inside Codex, a blocked validation run should print the local rerun command plus the raw `soffice` command blocks in terminal output, not only in the markdown report.
9. Deliver the `.pptx`, the authoring `.ts`, and any generated assets required to rebuild the deck.

## Load Next

- `references/project-workflow.md`: root/project layout, script boundaries, template-managed files, cleanup rules, and command examples.
- `references/pptxgenjs-helpers.md`: helper API summary, dependency notes, and validation script descriptions.
- `references/maintenance-workflow.md`: maintainer-only workflow for editing this skill, syncing it into Codex, and validating skill changes.

## Authoring Rules

- Set theme fonts explicitly. Do not rely on PowerPoint defaults if typography matters.
- Use `autoFontSize`, `calcTextBox`, and related helpers to size text boxes; do not use PptxGenJS `fit` or `autoFit`.
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
