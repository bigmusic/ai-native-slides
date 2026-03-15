# skills-test plan

## Goal

Finish the shared-root slide-deck workflow with a writer-first shared deck-spec black box:

- one shared deck root runtime
- one `projects/<slug>/` directory per deck project
- one shared runtime package at `<deck-root>/packages/deck-spec-module/`
- project directories keep only project content, thin wrappers, metadata, media, tests, and outputs

## Current Decisions

- The shared package lives at `/Volumes/BiGROG/skills-test/ai-native-slides/assets/root_templates/packages/deck-spec-module/` and syncs into each deck root as `/Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module/`.
- The official prompt-driven module contract is writer-first:
  - `runDeckSpecModule({ prompt, projectSlug, apiKey, model?, seed?, paths: { canonicalSpecPath, artifactRootDir } })`
  - `runDeckSpecValidateModule({ canonicalSpecPath, reportPath? })`
- The module owns:
  - external-model planning
  - canonicalization
  - structural validation
  - semantic review
  - one internal repair retry
  - canonical spec write
  - artifact bundle write
- The project wrapper owns only:
  - deck-root / project-root discovery
  - default path selection
  - forwarding CLI invocations into the shared package
- Default project wrapper paths are:
  - canonical spec: `<project>/spec/deck-spec.json`
  - artifact root: `<deck-root>/tmp/deck-spec-module/<project-slug>/`
- Every `pnpm spec -- --prompt "<prompt>"` run writes an artifact bundle. There is no supported `--debug` mode anymore.
- The artifact bundle uses fixed names:
  - `result.json`
  - `diagnostics.json`
  - `candidate.primary.json`
  - `candidate.fallback.json`
  - `review.final.json`
  - `report.md`
- Project template-managed files now include only thin wrappers and shared media adapters:
  - `src/spec/runDeckSpec.ts`
  - `src/spec/validateDeckSpec.ts`
  - `src/spec/*` shared-contract re-exports
  - `src/deck-spec-module/media/*`
  - `src/asset-pipeline/*`
- Retired project-local planner/runtime files under `src/deck-spec-module/{planning,reviewing,...}` are no longer part of the scaffold.
- An opt-in live acceptance command now exists at the deck root:
  - `pnpm spec:live -- <project-dir> --prompt "<prompt>" [--label "<name>"]`
  - It writes only to `<deck-root>/tmp/deck-spec-module-live/...` and does not mutate the project canonical spec.

## Current Validation

- Workspace roles:
  - skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
  - demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
  - demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Verified on 2026-03-15:
  - `bash scripts/ensure_deck_root.sh /Volumes/BiGROG/skills-test/ai-education-deck --json`
  - `bash scripts/ensure_deck_project.sh /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck --json`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/packages/deck-spec-module && ../../node_modules/.bin/vitest run tests/deckSpecModule.test.ts tests/deckSpecContract.test.ts tests/deckSpecReviewing.test.ts`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck && node --import tsx -e 'import { runDeckSpecValidateModule } from "./packages/deck-spec-module/src/public-api.ts"; await runDeckSpecValidateModule({ canonicalSpecPath: "./projects/ai-native-product-deck/spec/deck-spec.json", reportPath: "./tmp/review-deck-spec-validate-report.md" }); console.log("validate ok")'`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm lint`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm typecheck`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm test`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm build`
  - `cd /Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck && pnpm spec:validate`
- Live smoke status on 2026-03-15:
  - command: `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --prompt "Create a six-slide deck about shared deck-spec black-box planning, validation, semantic review, and deterministic build delivery." --label "black-box-refactor"`
  - rerun: `cd /Volumes/BiGROG/skills-test/ai-education-deck && pnpm spec:live -- projects/ai-native-product-deck --prompt "Create a six-slide deck about shared deck-spec black-box planning, validation, semantic review, and deterministic build delivery." --label "black-box-refactor-rerun"`
  - result: both attempts reached the provider layer but failed with `planning_failed` / `fetch failed`
  - artifacts:
    - `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/20260315T204018Z-black-box-refactor`
    - `/Volumes/BiGROG/skills-test/ai-education-deck/tmp/deck-spec-module-live/ai-native-product-deck/20260315T205809Z-black-box-refactor-rerun`

## Remaining Follow-Up

- Rerun `pnpm spec:live` when provider/network conditions are stable enough to complete a real Gemini planning round.
- Keep `pnpm validate` as the final human-in-the-loop local-terminal acceptance step when LibreOffice-backed checks are required.
