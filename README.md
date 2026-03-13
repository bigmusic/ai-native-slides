# AI Native Slides

`ai-native-slides` is a Codex skill for creating and editing PowerPoint decks with PptxGenJS.

This repository started from a Codex slide-skill template and was then adjusted through regular use in Codex. The current structure and scripts were shaped by real deck work rather than by a standalone design exercise. The goal is simple:

- keep reusable slide tooling in this repository
- keep actual deck source, assets, and outputs in separate deck workspaces

## What This Repository Contains

This repository is the reusable part of the workflow:

- `SKILL.md`: the skill entry point and operating instructions
- `scripts/`: project setup, repair, cleanup, and validation helpers
- `assets/`: shared helpers, templates, and content starters
- `references/`: workflow notes for project use and skill maintenance

This repository is not intended to hold finished decks, rendered outputs, or local runtime caches.

## How It Is Used With Codex

The expected workflow is:

1. Use Codex with the `ai-native-slides` skill.
2. Create or refresh a separate deck workspace.
3. Generate project content in that workspace, usually under `src/` and `tests/`.
4. Build and validate the deck there.

In practice, Codex is used for both the implementation work and the iteration loop. The skill provides the reusable instructions, helpers, templates, and validation scripts that keep the work consistent.

## What The Skill Covers

The skill is meant to support a practical slide-authoring loop:

- initialize a deck root and project directory
- keep shared runtime files and project scaffold files in the right places
- generate editable PowerPoint output from TypeScript
- run lint, typecheck, test, build, and validation steps
- keep overlap and out-of-bounds checks in the generated deck code

The skill instructions also separate concerns clearly:

- this repository is the source of truth for the skill
- deck work should happen in a separate workspace
- local validation may require human-in-the-loop steps when LibreOffice is involved

## Notes On The Current Setup

In this workspace, the installed Codex skill path is linked to this repository. That means edits made here are the skill changes seen by Codex after restart.

The skill has been used to build decks in a separate shared-root layout, where:

- the deck root owns shared runtime files and helper assets
- each deck project owns its own `src/`, `tests/`, `assets/`, and `output/`

This keeps the skill repo reusable and keeps deck-specific artifacts out of the skill source tree.

## TODO

### Nano Banana Text-to-Image

Add an optional text-to-image step based on Nano Banana.

The current expectation is modest:

- keep it optional rather than required
- store generated images in the deck workspace, not in this repository
- document prompt inputs, output locations, and review steps clearly
- avoid hiding generated raster assets behind opaque automation

This should be added only when the image workflow is stable enough to support normal deck work without making the skill harder to maintain.

## License

This repository is released under the MIT License. See [LICENSE](./LICENSE).
