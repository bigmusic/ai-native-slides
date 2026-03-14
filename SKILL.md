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

## Primary Entry Points

- `scripts/init_deck_root.sh`: preferred idempotent entry point for creating or refreshing the shared deck root so each new project can rely on a complete shared runtime/config.
- `scripts/init_deck_project.sh`: preferred idempotent project entry point for create-or-refresh of template-managed project files while preserving prompt-generated deck content.
- `scripts/ensure_deck_root.sh` and `scripts/ensure_deck_project.sh`: cheap preflight checks.
- `assets/pptxgenjs_helpers/`: shared helper code copied into the deck root.
- `assets/templates/`: project-scaffold templates and wrappers copied into each project.
- `assets/content_starters/`: optional reference starters for prompt-generated deck content.

## Workflow

1. Use the current workspace as the deck root and decide the project name from the user's prompt.
2. Use the root scripts as deterministic entry points for the deck root: run `scripts/ensure_deck_root.sh` for preflight, then rerun `scripts/init_deck_root.sh` whenever a new project needs a complete shared runtime/config. This layer handles only root `package.json`, `.npmrc`, shared helpers, root metadata, `node_modules`, and `.venv`, and it is safe to rerun as a converge step.
3. Use `scripts/init_deck_project.sh <deck-root> <project-name>` as the deterministic entry point for `projects/<slug>/`. Use `scripts/ensure_deck_project.sh` only for cheap preflight or state refresh; if project preflight is incomplete or template-managed files have drifted during edit work, rerun `scripts/init_deck_project.sh` so the project scaffold converges without overwriting prompt-generated deck content. This layer handles only template-managed files, project metadata, and empty project folders such as `src/`, `tests/`, `output/`, `tmp/`, and `assets/`.
4. Treat `.ai-native-slides/state.json` as the machine-readable record of scaffold state, not as project content.
5. Let `scripts/init_deck_root.sh` restore the deck-root `.npmrc` and run `pnpm install` in Codex so the shared store stays inside `<deck-root>/.pnpm-store`. LibreOffice-backed validation is still human-in-the-loop in Codex and requires a local-terminal rerun.
6. After the scaffold is ready, classify the task as create, recreate, or edit.
7. Set the slide size up front. Default to 16:9 (`LAYOUT_WIDE`) unless the source material clearly uses another aspect ratio.
8. Generate project content only after both root and project scaffolds are ready. Write `src/buildDeck.ts`, `src/presentationModel.ts`, and project tests from the user's prompt.
9. Build the deck in TypeScript with explicit fonts, stable spacing, and editable PowerPoint-native elements when practical.
10. Use `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` as the fast local loop. Prefer `pnpm validate` only when you need full render, font, and overflow checks; inside Codex, a blocked validation run should print the local rerun command plus the raw `soffice` command blocks in terminal output, not only in the markdown report.
11. Deliver the `.pptx`, the authoring `.ts`, and any generated assets required to rebuild the deck.

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
