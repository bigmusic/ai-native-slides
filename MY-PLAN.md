# Short-Term Workflow Map

This file exists because the workspace agent protocol points to `MY-PLAN.md` as the short-term product and workflow note for the prompt-to-plan and shared slide workflow.

Use this file as a quick orientation layer only:

- Skill repo: `/Volumes/BiGROG/skills-test/ai-native-slides`
- Demo deck root: `/Volumes/BiGROG/skills-test/ai-education-deck`
- Demo project: `/Volumes/BiGROG/skills-test/ai-education-deck/projects/ai-native-product-deck`
- Current workflow: clean root bootstrap -> project bootstrap -> `pnpm spec` -> `pnpm spec:validate` -> skill-owned deck authoring -> `pnpm lint/typecheck/test/build` -> `pnpm validate`
- Current routing rule in this workspace: if the deck root is initialized but no active project metadata exists yet, natural-language deck-creation prompts default to `new_project ai-native-product-deck`

`PLANS.md` remains the living execution plan and the implementation-status record.
