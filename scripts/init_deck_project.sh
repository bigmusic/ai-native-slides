#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-root> <project-name> [--force]" >&2
}

FORCE=0
PROJECT_ROOT=""
PROJECT_NAME=""

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=1
      ;;
    -*)
      usage
      exit 1
      ;;
    *)
      if [[ -z "$PROJECT_ROOT" ]]; then
        PROJECT_ROOT="$arg"
      elif [[ -z "$PROJECT_NAME" ]]; then
        PROJECT_NAME="$arg"
      else
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$PROJECT_ROOT" || -z "$PROJECT_NAME" ]]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

mkdir -p "$PROJECT_ROOT"
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"

if is_legacy_deck_workspace "$PROJECT_ROOT"; then
  echo "Path looks like a legacy single-workspace deck: $PROJECT_ROOT" >&2
  echo "Legacy single-workspace migration is a maintainer operation." >&2
  echo "See ${SCRIPT_DIR}/maintenance/maintenance-workflow.md for the migration path." >&2
  exit 1
fi

PROJECT_SLUG="$(slugify_project_name "$PROJECT_NAME")"
PROJECTS_DIR="${PROJECT_ROOT}/projects"
PROJECT_DIR="${PROJECTS_DIR}/${PROJECT_SLUG}"

mkdir -p "$PROJECT_DIR"

bootstrap_args=("$PROJECT_DIR")
if [[ "$FORCE" -eq 1 ]]; then
  bootstrap_args+=("--force")
fi

set +e
bash "${SCRIPT_DIR}/bootstrap_deck_project.sh" "${bootstrap_args[@]}"
bootstrap_exit=$?
set -e

if [[ "$bootstrap_exit" -ne 0 && ! -f "${PROJECT_DIR}/.ai-native-slides/state.json" ]]; then
  exit "$bootstrap_exit"
fi

write_project_metadata "$PROJECT_ROOT" "$PROJECT_DIR" "$PROJECT_NAME" "$PROJECT_SLUG"

if [[ "$bootstrap_exit" -ne 0 ]]; then
  echo "Project initialized, but the shared root or project bootstrap still needs follow-up." >&2
  echo "See ${PROJECT_DIR}/.ai-native-slides/state.json for the next follow-up steps." >&2
fi

declare -a missing_project_content=()
if [[ ! -f "${PROJECT_DIR}/spec/deck-spec.json" ]]; then
  missing_project_content+=("spec/deck-spec.json")
fi

if [[ ! -f "${PROJECT_DIR}/src/buildDeck.ts" ]]; then
  missing_project_content+=("src/buildDeck.ts")
fi

if [[ ! -f "${PROJECT_DIR}/src/presentationModel.ts" ]]; then
  missing_project_content+=("src/presentationModel.ts")
fi

if ! find "${PROJECT_DIR}/tests" -type f \( -name '*.test.ts' -o -name '*.spec.ts' \) | grep -q .; then
  missing_project_content+=("tests/buildDeck.test.ts")
fi

cat <<EOF
Project scaffold initialized: $PROJECT_DIR
Template-managed files:
- .gitignore
- spec/deck-spec.schema.json
- package.json
- tsconfig.json
- vitest.config.ts
- run-project.sh
- validate-local.sh
- src/main.ts
- src/asset-pipeline/generateMedia.ts
- src/asset-pipeline/imagePolicy.ts
- src/asset-pipeline/paths.ts
- src/deck-spec-module/asset-planning/assetBlueprints.ts
- src/deck-spec-module/canonicalization/finalizeDeckSpec.ts
- src/deck-spec-module/errors.ts
- src/deck-spec-module/media/geminiImageProvider.ts
- src/deck-spec-module/media/providerEnv.ts
- src/deck-spec-module/media/providerPrompt.ts
- src/deck-spec-module/planning/geminiPlannerModel.ts
- src/deck-spec-module/planning/plannerPrompt.ts
- src/deck-spec-module/prompt-interpreter/promptModel.ts
- src/deck-spec-module/public-api.ts
- src/deck-spec-module/review-bridge/createSemanticReview.ts
- src/deck-spec-module/reviewing/materialQuality.ts
- src/deck-spec-module/reviewing/promptQuality.ts
- src/deck-spec-module/reviewing/reviewTypes.ts
- src/deck-spec-module/reviewing/scorecard.ts
- src/spec/contract.ts
- src/spec/deriveOutputFileName.ts
- src/spec/normalizeSystemManagedFields.ts
- src/spec/promoteDeckSpecCandidate.ts
- src/spec/readDeckSpec.ts
- src/spec/rendererContract.ts
- src/spec/renderSpecReview.ts
- src/spec/reviewContract.ts
- src/spec/validateDeckSpec.ts
- src/spec/validateSpecReview.ts
- src/spec/writeFileAtomic.ts
EOF

if [[ "${#missing_project_content[@]}" -eq 0 ]]; then
  cat <<EOF

Project content already exists. Existing prompt-generated files were left untouched:
- spec/deck-spec.json
- src/buildDeck.ts
- src/presentationModel.ts
- tests/buildDeck.test.ts
EOF
else
  echo
  echo "Generate these remaining project-content files next from the user's prompt:"
  for path in "${missing_project_content[@]}"; do
    echo "- ${path}"
  done
fi
