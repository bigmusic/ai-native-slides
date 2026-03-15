# Deck-Spec Module Materialization Design

## Purpose

This note records the intended design for moving Gemini text-to-image generation into the shared `deck-spec-module` black box.

This file is not an execution plan and does not replace `PLANS.md`.
`PLANS.md` remains the single execution-tracking document for this workstream.

## Problem Statement

The current split is:

- shared package owns prompt-to-spec planning, canonicalization, validation, semantic review, canonical publish, and run artifacts
- project-local code owns Gemini image generation, image normalization, image writes, and canonical-spec status advancement to `media_ready`

That split is now too weak for the intended model.
The operator experiences one prompt-owned session, but the implementation still splits responsibility across two orchestration layers.
As a result:

- side effects are split across two subsystems
- artifacts from one logical run are reported in different places
- failure semantics are harder to reason about
- provider-backed live smoke proves only the planning half of the black box

## Core Design Position

Gemini media generation should move into the shared black box.

However, canonical spec and generated media are not identical artifacts:

- the canonical spec is the contract
- generated images are derived materializations from the contract

They belong to the same run and should be audited together, but they should not be forced into the same publish semantics.
If one image-generation request fails, that should not erase a valid canonical spec that was already planned, validated, and reviewed successfully.

## Goals

- Make one shared module responsible for:
  - prompt-driven planning
  - canonicalization
  - contract validation
  - semantic review
  - canonical spec publish
  - Gemini media generation
  - image normalization
  - canonical spec status update after media
  - unified run artifacts and reports
- Keep the module stateless.
- Keep caller-owned path selection explicit.
- Keep project wrappers thin.
- Preserve recoverability when media fails after canonical publish.
- Keep `pnpm build` deterministic and offline.

## Non-Goals

- Do not move deck composition into Gemini.
- Do not make the module discover the active project automatically.
- Do not make the module invent output paths.
- Do not introduce hidden package-local output directories.
- Do not widen the migration by relocating all project-facing canonical files unless there is a concrete need.

## Preferred Contract

### Public API

Preferred phase-1 API:

```ts
runDeckSpecModule({
  prompt,
  projectSlug,
  apiKey,
  model?,
  seed?,
  paths: {
    canonicalSpecPath,
    artifactRootDir,
    mediaOutputDir,
  },
  media?: {
    enabled?: boolean,
  },
})
```

Validation API remains:

```ts
runDeckSpecValidateModule({
  canonicalSpecPath,
  reportPath?,
})
```

### Why `mediaOutputDir` Is Explicit

The black box must stay stateless.
That means the caller, not the package, still owns output-path discovery.

In phase 1, use three explicit caller-owned path classes:

- `canonicalSpecPath`
- `artifactRootDir`
- `mediaOutputDir`

This keeps the boundary honest and avoids hiding output location rules inside the package.

### Why Not Collapse Everything Into One New `runRootDir` Immediately

A single `runRootDir` might look conceptually cleaner, but it would widen the migration:

- existing build code already expects `spec/deck-spec.json`
- existing build code already expects `media/generated-images/`
- changing both storage roots at once would force a larger wrapper and build migration before the ownership change is even proven

Phase 1 should therefore unify ownership and auditability first, while keeping stable project-facing publish paths.
A later phase can still introduce a higher-level `runRootDir` abstraction if the benefits remain compelling after the ownership migration is proven.

## Module Responsibilities

After the migration, the shared package should own:

- planner prompt generation
- planner-provider invocation
- candidate normalization
- schema validation
- semantic review
- one repair retry for planning drift
- canonical spec publish
- Gemini image prompt generation
- Gemini image invocation
- image normalization and format conversion
- generated image writes
- canonical spec status advancement after media generation
- unified artifact and report writing

The shared package should not own:

- deck-root discovery
- project-root discovery
- default path selection
- build-time deck composition
- local-terminal LibreOffice reruns

## Project Wrapper Responsibilities

Project wrappers should remain thin and limited to:

- discovering deck-root and project-root context
- selecting default `canonicalSpecPath`
- selecting default `artifactRootDir`
- selecting default `mediaOutputDir`
- forwarding CLI invocations into the shared package

The project wrapper should not own media business logic after the migration.

## Phase Model

One `runDeckSpecModule()` call should be treated as a multi-phase state machine with explicit outputs:

### Phase 0: Input Guarding

- verify required inputs are present
- reject output paths inside the package directory
- resolve provider credentials through explicit caller context only

### Phase 1: Planning

- build planner prompt
- invoke Gemini planner
- capture raw candidate

### Phase 2: Canonicalization and Validation

- normalize system-managed fields
- validate candidate against the deck-spec schema
- if validation fails, record diagnostics and optionally run one repair attempt

### Phase 3: Semantic Review

- run deterministic semantic review
- reject semantically invalid output before publish

### Phase 4: Canonical Spec Publish

- publish canonical `deck-spec.json`
- write planning/review artifacts
- from this point on, a valid canonical contract exists

### Phase 5: Media Materialization

- load required image and shared-visual assets from the canonical spec
- compile provider prompts
- invoke Gemini image generation
- normalize outputs to deck-ready files
- write generated files into `mediaOutputDir`

### Phase 6: Canonical Spec Media-State Update

- update per-asset media status based on generated-file existence
- if all required media exists, advance overall spec status to `media_ready`
- if any required media is still missing, keep overall spec status at `reviewed`

### Phase 7: Unified Artifact Finalization

- write generated-asset manifest
- write media result summary
- write media failure detail when applicable
- write final run report

## State Transitions

### Spec-Level State

Expected state transitions:

- `planned` -> `reviewed`
- `reviewed` -> `media_ready`

Rules:

- successful planning/review publishes `reviewed`
- successful media generation promotes `reviewed` to `media_ready`
- failed media generation does not roll the spec back below `reviewed`

### Asset-Level State

Current practical state model should remain conservative:

- generated assets that exist on disk can be marked `generated`
- assets that did not complete should remain in a non-ready state

If the current schema does not support a dedicated `failed` asset status, do not invent one casually.
Use `media.failures.json` and `generated-assets.manifest.json` as the explicit failure ledger until a schema extension is justified.

## Failure Semantics

### Pre-Publish Failures

These failures happen before canonical publish:

- `prompt_invalid`
- `planning_failed`
- `semantic_review_failed`
- `contract_validation_failed`

Behavior:

- canonical spec stays untouched
- no media generation starts
- run artifacts still explain the failure

### Post-Publish Media Failures

These failures happen after canonical publish:

- `media_generation_failed`

Behavior:

- canonical spec remains published
- canonical spec remains at `reviewed`
- successfully generated images may already exist in `mediaOutputDir`
- the overall CLI should still return non-zero so operators see the run as incomplete
- artifacts must make the partial-success state explicit

This distinction is necessary for recovery.
Otherwise the module would throw away useful canonical work whenever one downstream image operation failed.

## Artifact Layout

Preferred artifact files under `artifactRootDir`:

- `result.json`
- `diagnostics.json`
- `candidate.primary.json`
- `candidate.fallback.json`
- `review.final.json`
- `generated-assets.manifest.json`
- `media.result.json`
- `media.failures.json`
- `report.md`

Suggested meanings:

- `result.json`
  - top-level run result
  - includes publish-path summary
  - includes phase outcome summary
- `diagnostics.json`
  - planning and repair-attempt diagnostics
- `candidate.primary.json`
  - first candidate after normalization
- `candidate.fallback.json`
  - fallback candidate after normalization
- `review.final.json`
  - deterministic semantic-review record
- `generated-assets.manifest.json`
  - asset id to output file mapping
  - final observed file existence summary
- `media.result.json`
  - media phase summary
  - generated asset ids
  - unchanged asset ids
- `media.failures.json`
  - per-asset failure detail
- `report.md`
  - one human-readable run summary covering both planning and media phases

## CLI Surface

Phase-1 operator-facing direction:

- `pnpm spec -- --prompt "<prompt>"` becomes the primary end-to-end entrypoint
- `pnpm media` becomes a compatibility wrapper into the shared package or is deprecated after the migration is stable
- `pnpm spec:validate` remains structural validation of the canonical spec
- `pnpm spec:live` should exercise planning plus media generation in temp paths only

## Live-Smoke Contract

`pnpm spec:live` should create a temp run root that contains:

- temp canonical spec
- temp artifact bundle
- temp generated media outputs
- optional validation report

It must not mutate:

- `<project>/spec/deck-spec.json`
- `<project>/media/generated-images/`

## Migration Strategy

### Step 1: Move Shared Logic, Keep Stable Publish Paths

- move orchestration from project `src/asset-pipeline/generateMedia.ts` into the shared package
- keep project-facing publish paths unchanged
- keep wrappers responsible only for path selection

### Step 2: Convert `pnpm media` Into a Thin Compatibility Wrapper

- keep operator workflows working during the transition
- remove project-local business logic

### Step 3: Extend Tests and Reports

- test deterministic success and failure paths for media
- extend artifact manifests and run reports

### Step 4: Reconcile Documentation

- update `README.md`
- update `SKILL.md`
- update `references/project-workflow.md`

## Test Strategy

The revised package should have deterministic coverage for:

- successful planning with no required images
- successful planning with all required images generated
- partial image-generation failure after canonical publish
- provider-env resolution failure
- invalid canonical spec blocks media phase
- rerun after partial media success
- temp live-smoke path isolation
- artifact manifest completeness

Provider-backed acceptance should additionally prove:

- at least one real `pnpm spec:live` success
- temp canonical spec and temp media isolation
- no mutation of project canonical outputs

## Operational Notes

- The module should remain writer-first.
- Artifact writing should stay always-on.
- The module should continue rejecting output paths inside its own package directory.
- Recovery should always prefer rerunning the shared module instead of manual patching.

## Open Questions

- Should `result.json` expose per-phase booleans such as `spec_published` and `media_published`, or a more general phase-status object?
- Does the schema need a dedicated per-asset failure status, or are artifact manifests sufficient for phase 1?
- After the ownership migration is proven, is there enough benefit to justify a later move to a single caller-owned `runRootDir` abstraction?
