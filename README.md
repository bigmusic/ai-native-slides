# AI Native Slides

`ai-native-slides` is a Codex skill for creating and editing PowerPoint decks with PptxGenJS.

This repository started from a Codex slide-skill template and was then adjusted through regular use in Codex. The current structure and scripts were shaped by real deck work rather than by a standalone design exercise. The goal is simple:

- keep reusable slide tooling in this repository
- keep actual deck source, assets, and outputs in separate deck workspaces

## What This Repository Contains

This repository is the reusable part of the workflow:

- `SKILL.md`: the skill entry point and operating instructions
- `scripts/`: user-facing setup and validation helpers
- `scripts/maintenance/`: internal maintainer tooling, cleanup/migration/sync helpers, and maintainer-only workflow notes
- `assets/`: shared helpers, templates, and content starters
- `references/`: user-facing workflow notes and helper references

This repository is not intended to hold finished decks, rendered outputs, or local runtime caches.

Normal skill use should start from `SKILL.md` and the user-facing scripts only. Files under `scripts/maintenance/` are not part of the normal deck-authoring workflow; they exist for maintaining the skill itself, validating template recovery paths, migrating older layouts, and syncing or repairing the reusable scaffold layer.

## Development Environment In This Workspace

The current workspace is split into two roles:

- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`

Use the demo project as the implementation and validation workspace. That is where commands such as `pnpm spec:generate`, `pnpm spec`, `pnpm test`, `pnpm build`, and `pnpm validate` are exercised.
For the current development loop, keep the concrete project name fixed at `ai-native-product-deck`.

After a reusable workflow or scaffold change is proven in the demo project, sync the reusable parts back into the skill repo:

- docs and workflow rules stay in `ai-native-slides/`
- reusable scaffold logic belongs in `ai-native-slides/assets/templates/`
- reusable scripts belong in `ai-native-slides/scripts/`

The skill repo remains the reusable source of truth, but the demo project is the practical proving ground for development.

## How It Is Used With Codex

The expected workflow is:

1. Use Codex with the `ai-native-slides` skill.
2. Create or refresh a separate deck workspace.
3. Let the same skill-owned session classify the prompt as either `new_project` or `revise_existing_project`.
4. If the prompt targets an existing deck, rerun that project's end-to-end workflow in place. If it asks for a new deck, create or refresh the requested project scaffold first.
5. Let that same skill-owned session take the prompt from planning through deck generation and validation-oriented checks in the routed project workspace.
6. Review the produced deliverables and submit revision feedback only after the skill finishes the session.

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
- `scripts/maintenance/` is for skill maintainers, not normal skill users
- local validation may require post-deliverable human-in-the-loop steps when LibreOffice is involved

## Prompt Routing

Each end-to-end session starts with prompt routing:

- `new_project`: the prompt clearly asks for a fresh deck or says `Create project <slug>`
- `revise_existing_project`: the prompt clearly asks to revise an existing deck or says `Revise project <slug>`

Routing rules:

- Prefer explicit project naming in the prompt.
- If the session is already scoped to one project, use `.ai-native-slides/project.json` and `.ai-native-slides/state.json` to confirm the active project before editing.
- If the prompt is ambiguous and could hit the wrong deck, clarify whether the user wants a new project or a revision run.
- Post-deliverable review feedback is not a special internal phase. It is just another prompt that re-enters this routing step.

## Prompt Guide

Use prompts like these:

- New project: `Create project retail-q2-kickoff. Build a 10-slide deck explaining the Q2 retail strategy for executives.`
- Revision to a named project: `Revise project ai-native-product-deck. Keep the narrative, but replace the metrics slide with a margin story and simplify the closing slide.`
- Revision to the active project: `Update the current project ai-native-product-deck with this review feedback: tighten slide 2 copy, replace the hero image, and make the final CTA more direct.`

Avoid prompts like `make another version` unless the target project is already explicit. If you want a revision, name the project. If you want a new deck, say `Create project <slug>`.

## Responsibility Boundaries

The skill exists to let Codex do most of the workflow work directly instead of delegating everything to external APIs.

- Skill agent responsibilities:
  - interpret the user request
  - run the prompt-to-spec planner phase
  - write `tmp/spec-candidate.json` and `tmp/spec-review-candidate.json`
  - handle the single candidate retry when `pnpm spec` reports a retryable failure kind
  - author and edit TypeScript deck code
  - run validation commands and interpret the results
  - own the end-to-end session until deliverables exist
- Local CLI/workflow responsibilities:
  - write deterministic planner phase artifacts
  - normalize workflow-managed fields
  - validate and promote canonical spec files
  - build the PPT deterministically from local inputs
  - write generated media and review artifacts to their canonical paths
- Gemini responsibilities:
  - image generation only during `pnpm media`
  - no spec candidate generation
  - no semantic review
  - no deck composition
- Human responsibilities:
  - review the final deliverables after the skill-owned session finishes
  - rerun LibreOffice-backed validation in a local terminal when needed
  - provide revision feedback for a later skill rerun

## Current Skill-Phase Contract

The current workflow keeps planning and semantic review inside one Codex skill session while leaving canonical writes to the local CLI:

- `pnpm spec:generate` writes `tmp/planner-context.json` and `tmp/planner-brief.md`, then that same skill session writes `tmp/spec-candidate.json`.
- `pnpm spec` promotes that candidate into canonical `spec/deck-spec.json` and, on success, also writes `tmp/review-context.json` plus `tmp/review-brief.md`.
- The same skill session then reads those review artifacts, writes `tmp/spec-review-candidate.json`, and `pnpm spec:review` promotes it into the formal review outputs.
- The stateless planner/reviewer core now lives under `src/planner-agent/`, including the Gemini image-generation provider helpers under `src/planner-agent/image-generation/`, while `src/spec/*` and `src/asset-pipeline/generateMedia.ts` act as filesystem and CLI adapters around that core.
- Semantic review artifacts now include dimension scorecards for deck materials and image prompts, but `pass` / `warn` / `fail` remains the only workflow gate.
- Deterministic regression now covers fixture-backed prompt/material drift scenarios plus one full `spec:generate -> spec -> spec:review` integration path, so planner-agent closure is exercised without adding a new runtime workflow surface.
- The JSON key name `skill_handoff` remains for backward compatibility, but it describes an internal skill-phase contract rather than a human or external-service handoff.

Human review is intentionally late in the loop: inspect the final `.pptx`, the source, the generated media, and the validation outputs after the skill finishes, then send revision feedback as a new `Revise project <slug>` prompt if another run is needed.

## Notes On The Current Setup

In this workspace, the installed Codex skill path is linked to this repository. That means edits made here are the skill changes seen by Codex after restart.

The skill has been used to build decks in a separate shared-root layout, where:

- the deck root owns shared runtime files and helper assets
- each deck project owns its own `src/`, `tests/`, `spec/`, `media/`, and `output/`

This keeps the skill repo reusable and keeps deck-specific artifacts out of the skill source tree.

## Future Option

### Nano Banana Provider

The current image workflow already exists through `pnpm media` with Gemini as the v1 provider.

If another provider such as Nano Banana is added later, it should remain an optional secondary provider behind the same project-level `media/generated-images/` contract:

- keep it optional rather than required
- store generated images in the deck workspace, not in this repository
- document provider selection, prompt inputs, output locations, and review steps clearly
- avoid hiding generated raster media behind opaque automation

## License

This repository is released under the MIT License. See [LICENSE](./LICENSE).
