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

For the current execution state of the shared-runtime refactor, use `PLANS.md` as the living source of truth.

## Development Environment In This Workspace

The current workspace is split into two roles:

- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`

Use the demo project as the implementation and validation workspace. That is where commands such as `pnpm spec`, `pnpm test`, `pnpm build`, and `pnpm validate` are exercised.
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

The skill exists to keep orchestration and deck authoring outside the planning module.

- Skill agent responsibilities:
  - interpret the user request and route the target project
  - call the shared `deck-spec-module` entrypoints through thin project wrappers
  - author and edit TypeScript deck code
  - run validation commands and interpret the results
  - own the end-to-end session until deliverables exist
- Shared `deck-spec-module` responsibilities:
  - behave as a stateless black box behind explicit inputs
  - run external-model planning
  - canonicalize the candidate into the formal contract
  - run structural validation
  - run semantic review
  - perform one internal repair retry
  - write canonical `spec/deck-spec.json`
  - write the fixed artifact bundle for every run
- Project wrapper responsibilities:
  - discover deck-root and project-root context
  - choose default `canonicalSpecPath`, `artifactRootDir`, and `mediaOutputDir`
  - forward `spec` and `spec:validate` into the shared package through the operator-facing CLIs
  - keep deterministic build separate from planning and media
- Gemini responsibilities:
  - spec generation inside the shared `deck-spec-module`
  - image generation during `pnpm spec`
  - no deck composition
- Human responsibilities:
  - review the final deliverables after the skill-owned session finishes
  - rerun LibreOffice-backed validation in a local terminal when needed
  - provide revision feedback for a later skill rerun

## Current Skill-Phase Contract

The current workflow hard-cuts planning and contract validation into the shared package at `<deck-root>/packages/deck-spec-module/`:

- `pnpm spec -- --prompt "<prompt>"` is the main path. The project wrapper forwards into the shared CLI with explicit `--canonical-spec-path`, `--artifact-root-dir`, and `--media-output-dir` values, and that CLI forwards into `runDeckSpecModule({ prompt, projectSlug, apiKey, model?, seed?, paths: { canonicalSpecPath, artifactRootDir, mediaOutputDir }, media?: { enabled?: boolean } })`.
- The official validate entrypoint is `runDeckSpecValidateModule({ canonicalSpecPath, reportPath? })`.
- The project-facing `pnpm spec:validate` path shells into the shared package's `pnpm spec:validate` CLI instead of calling internal `src/cli/*` file paths directly.
- For operator use, treat the shared package's `pnpm` CLIs as the stable command boundary. Internal `packages/deck-spec-module/src/*` paths are package internals, not supported operator entrypoints.
- The shared module is writer-first and stateless. It owns planning, canonicalization, structural validation, semantic review, one repair retry, canonical spec publish, media materialization, and artifact-bundle writes.
- The shared module does not discover the active project, infer runtime output locations, or depend on project-local mutable state.
- The project wrapper owns deck-root / project-root discovery and default path selection for `canonicalSpecPath`, `artifactRootDir`, and `mediaOutputDir`.
- The deck root links `@ai-native-slides/deck-spec-module` from the workspace package, and project-local `src/spec/*` wrappers consume only the curated package exports (`"."`, `"./spec"`, and `"./review"`).
- The shared module and CLI do not infer runtime output locations anymore. If the caller does not pass explicit output paths, the CLI fails fast.
- The shared module rejects runtime output paths that point back into its own package directory.
- Every prompt-driven run writes the same fixed bundle under the caller-provided artifact root:
  - `result.json`
  - `diagnostics.json`
  - `candidate.primary.json`
  - `candidate.fallback.json`
  - `review.final.json`
  - `generated-assets.manifest.json`
  - `media.result.json`
  - `media.failures.json`
  - `report.md`
- On success, the module publishes the canonical spec plus artifacts. On pre-publish failure, the canonical target stays untouched. On post-publish media failure, the canonical spec remains published at `reviewed` and the failure is reported through typed error codes plus artifact diagnostics.
- The project scaffold keeps only thin wrappers plus project-specific content:
  - `src/spec/*`
  - `src/media/generatedImagePaths.ts`
- There is no supported `--debug` mode and no supported value-only planner API.
- `pnpm spec` runs planning plus media by default. `--no-media` is the explicit escape hatch when you need canonical spec publish without image generation.
- `pnpm spec:validate` remains structural validation only. It validates the canonical `spec/deck-spec.json` through the shared package CLI and does not generate media or revise project content.
- `pnpm validate` always starts from a fresh `pnpm build` and only validates the `.pptx` emitted by that build run. It does not accept or fall back to older `output/*.pptx` artifacts.
- `pnpm spec:live -- <project-dir> --tmp-root-dir "<path>" --prompt "<prompt>" [--label "<name>"] [--no-media]` is the opt-in provider-backed acceptance command from the deck root. It writes only to the caller-selected temp root and does not mutate the project canonical spec.
- Validation/eval, not exact byte-for-byte determinism, is the success bar for model-generated spec content.

Current independence status:

- the operator-facing CLI boundary is now isolated through the package `pnpm spec`, `pnpm spec:validate`, and `pnpm spec:live` scripts.
- the project-wrapper TypeScript boundary is now isolated through the package exports `@ai-native-slides/deck-spec-module`, `@ai-native-slides/deck-spec-module/spec`, and `@ai-native-slides/deck-spec-module/review`.
- package-maintainer deterministic tests now use the curated `@ai-native-slides/deck-spec-module/testing` seam instead of deep-importing planner/media/reviewing implementation files under `packages/deck-spec-module/src/*`.

Human review is intentionally late in the loop: inspect the final `.pptx`, the source, the generated media, and the validation outputs after the skill finishes, then send revision feedback as a new `Revise project <slug>` prompt if another run is needed.

## Notes On The Current Setup

In this workspace, the installed Codex skill path is linked to this repository. That means edits made here are the skill changes seen by Codex after restart.

The skill has been used to build decks in a separate shared-root layout, where:

- the deck root owns shared runtime files and helper assets
- each deck project owns its own `src/`, `tests/`, `spec/`, `media/`, and `output/`

This keeps the skill repo reusable and keeps deck-specific artifacts out of the skill source tree.

## Future Option

### Nano Banana Provider

The current image workflow now runs through `pnpm spec` with Gemini as the v1 provider.

If another provider such as Nano Banana is added later, it should remain an optional secondary provider behind the same project-level `media/generated-images/` contract:

- keep it optional rather than required
- store generated images in the deck workspace, not in this repository
- document provider selection, prompt inputs, output locations, and review steps clearly
- avoid hiding generated raster media behind opaque automation

## License

This repository is released under the MIT License. See [LICENSE](./LICENSE).
