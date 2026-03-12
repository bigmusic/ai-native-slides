---
name: ai-native-slides
description: Create and edit presentation slide decks (`.pptx`) with PptxGenJS, bundled layout helpers, and render/validation utilities. Use when tasks involve building a new PowerPoint deck, recreating slides from screenshots/PDFs/reference decks, modifying slide content while preserving editable output, adding charts/diagrams/visuals, or diagnosing layout issues such as overflow, overlaps, and font substitution.
---

# AI Native Slides

## Overview

Use PptxGenJS for slide authoring. Do not use `python-pptx` for deck generation unless the task is inspection-only; keep editable output in JavaScript and deliver both the `.pptx` and the source `.js`.

Keep work in a task-local directory. Only copy final artifacts to the requested destination after rendering and validation pass.
Keep this skill folder reusable: put helpers, scripts, assets, and references here, but keep generated decks and validation outputs in separate task workspaces.

## Bundled Resources

- `assets/pptxgenjs_helpers/`: Copy this folder into the deck workspace and import it locally instead of reimplementing helper logic.
- `assets/templates/package.json`: Minimal deck template written by bootstrap when a new workspace does not already have `package.json`.
- `scripts/bootstrap_deck_workspace.sh`: Copy helper assets into a deck workspace and write a local `validate-local.sh` wrapper that uses the installed skill's validation scripts.
- `scripts/ensure_deck_workspace.sh`: Run a cheap preflight check for deck-local dependencies and write `.ai-native-slides/state.json` with the latest workspace status.
- `scripts/render_slides.py`: Rasterize a `.pptx` or `.pdf` to per-slide PNGs.
- `scripts/slides_test.py`: Detect content that overflows the slide canvas.
- `scripts/create_montage.py`: Build a contact-sheet style montage of rendered slides.
- `scripts/detect_font.py`: Report missing or substituted fonts as LibreOffice resolves them.
- `scripts/ensure_raster_image.py`: Convert SVG/EMF/HEIC/PDF-like assets into PNGs for quick inspection.
- `references/pptxgenjs-helpers.md`: Load only when you need API details or dependency notes.

## Workflow

1. Inspect the request and determine whether you are creating a new deck, recreating an existing deck, or editing one.
2. Set the slide size up front. Default to 16:9 (`LAYOUT_WIDE`) unless the source material clearly uses another aspect ratio.
3. Run `scripts/bootstrap_deck_workspace.sh <deck-workspace>` once per workspace. This syncs helper assets, writes `validate-local.sh`, optionally writes a minimal `package.json`, and records workspace state.
4. Re-run `scripts/ensure_deck_workspace.sh <deck-workspace>` for cheap preflight checks when reusing an existing deck workspace. Read `.ai-native-slides/state.json` if the workspace is incomplete.
5. Build the deck in JavaScript with an explicit theme font, stable spacing, and editable PowerPoint-native elements when practical.
6. Prefer running the bundled validation scripts from the installed skill directory with the deck's own `.venv/bin/python`. Only copy Python validation scripts into the deck workspace if you intentionally want a fully vendored deck.
7. Run `slides_test.py` for overflow checks when slide edges are tight or the deck is dense.
8. Deliver the `.pptx`, the authoring `.js`, and any generated assets that are required to rebuild the deck.

## Authoring Rules

- Set theme fonts explicitly. Do not rely on PowerPoint defaults if typography matters.
- Use `autoFontSize`, `calcTextBox`, and related helpers to size text boxes; do not use PptxGenJS `fit` or `autoFit`.
- Use bullet options, not literal `•` characters.
- Use `imageSizingCrop` or `imageSizingContain` instead of PptxGenJS built-in image sizing.
- Use `latexToSvgDataUri()` for equations and `codeToRuns()` for syntax-highlighted code blocks.
- Prefer native PowerPoint charts for simple bar/line/pie/histogram style visuals so reviewers can edit them later.
- For charts or diagrams that PptxGenJS cannot express well, render SVG externally and place the SVG in the slide.
- Include both `warnIfSlideHasOverlaps(slide, pptx)` and `warnIfSlideElementsOutOfBounds(slide, pptx)` in the submitted JavaScript whenever you generate or substantially edit slides.
- Fix all unintentional overlap and out-of-bounds warnings before delivering. If an overlap is intentional, leave a short code comment near the relevant element.

## Recreate Or Edit Existing Slides

- Render the source deck or reference PDF first so you can compare slide geometry visually.
- Match the original aspect ratio before rebuilding layout.
- Preserve editability where possible: text should stay text, and simple charts should stay native charts.
- If a reference slide uses raster artwork, use `ensure_raster_image.py` to generate debug PNGs from vector or odd image formats before placing them.

## Validation Commands

Examples below assume the deck uses the installed skill's validation scripts and the deck's own Python environment.

```bash
# Initialize a deck workspace once
bash ~/.codex/skills/ai-native-slides/scripts/bootstrap_deck_workspace.sh /path/to/deck
```

```bash
# Run a cheap workspace preflight check and refresh state
bash ~/.codex/skills/ai-native-slides/scripts/ensure_deck_workspace.sh /path/to/deck
```

```bash
# Render slides to PNGs for review
./.venv/bin/python ~/.codex/skills/ai-native-slides/scripts/render_slides.py deck.pptx --output_dir rendered
```

```bash
# Build a montage for quick scanning
./.venv/bin/python ~/.codex/skills/ai-native-slides/scripts/create_montage.py --input_dir rendered --output_file montage.png
```

```bash
# Check for overflow beyond the original slide canvas
./.venv/bin/python ~/.codex/skills/ai-native-slides/scripts/slides_test.py deck.pptx
```

```bash
# Detect missing or substituted fonts
./.venv/bin/python ~/.codex/skills/ai-native-slides/scripts/detect_font.py deck.pptx --json
```

Load `references/pptxgenjs-helpers.md` if you need the helper API summary or dependency details.
Use `.ai-native-slides/state.json` in the deck workspace as the machine-readable record of the last bootstrap / ensure check.
If you are maintaining this skill itself, not just using it to build decks, see `references/maintenance-workflow.md` for the local development, validation, and Codex sync loop.
