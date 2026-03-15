#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <project-dir> [--force]" >&2
}

FORCE=0
DECK_DIR=""

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
      if [[ -n "$DECK_DIR" ]]; then
        usage
        exit 1
      fi
      DECK_DIR="$arg"
      ;;
  esac
done

if [[ -z "$DECK_DIR" ]]; then
  usage
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"
TEMPLATE_ROOT="${SKILL_ROOT}/assets/templates"
PROJECT_GITIGNORE_TEMPLATE="${TEMPLATE_ROOT}/.gitignore"
DECK_SPEC_SCHEMA_TEMPLATE="${TEMPLATE_ROOT}/spec/deck-spec.schema.json"
PACKAGE_TEMPLATE="${TEMPLATE_ROOT}/package.json"
PROJECT_TSCONFIG_TEMPLATE="${TEMPLATE_ROOT}/tsconfig.json"
PROJECT_VITEST_CONFIG_TEMPLATE="${TEMPLATE_ROOT}/vitest.config.ts"
RUN_PROJECT_TEMPLATE="${TEMPLATE_ROOT}/run-project.sh"
VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/validate-local.sh"
MAIN_TEMPLATE="${TEMPLATE_ROOT}/src/main.ts"
MEDIA_GENERATE_TEMPLATE="${TEMPLATE_ROOT}/src/asset-pipeline/generateMedia.ts"
MEDIA_POLICY_TEMPLATE="${TEMPLATE_ROOT}/src/asset-pipeline/imagePolicy.ts"
MEDIA_PATHS_TEMPLATE="${TEMPLATE_ROOT}/src/asset-pipeline/paths.ts"
MEDIA_PROVIDER_TEMPLATE="${TEMPLATE_ROOT}/src/deck-spec-module/media/geminiImageProvider.ts"
MEDIA_PROVIDER_ENV_TEMPLATE="${TEMPLATE_ROOT}/src/deck-spec-module/media/providerEnv.ts"
MEDIA_PROVIDER_PROMPT_TEMPLATE="${TEMPLATE_ROOT}/src/deck-spec-module/media/providerPrompt.ts"
SPEC_CONTRACT_TEMPLATE="${TEMPLATE_ROOT}/src/spec/contract.ts"
SPEC_DERIVE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/deriveOutputFileName.ts"
SPEC_NORMALIZE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/normalizeSystemManagedFields.ts"
SPEC_PROMOTE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/promoteDeckSpecCandidate.ts"
SPEC_READ_TEMPLATE="${TEMPLATE_ROOT}/src/spec/readDeckSpec.ts"
SPEC_RENDERER_CONTRACT_TEMPLATE="${TEMPLATE_ROOT}/src/spec/rendererContract.ts"
SPEC_REVIEW_RENDER_TEMPLATE="${TEMPLATE_ROOT}/src/spec/renderSpecReview.ts"
SPEC_REVIEW_CONTRACT_TEMPLATE="${TEMPLATE_ROOT}/src/spec/reviewContract.ts"
SPEC_VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/validateDeckSpec.ts"
SPEC_REVIEW_VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/validateSpecReview.ts"
SPEC_WRITE_TEMPLATE="${TEMPLATE_ROOT}/src/spec/writeFileAtomic.ts"
PROJECT_GITIGNORE_DEST="${DECK_DIR}/.gitignore"
DECK_SPEC_SCHEMA_DEST="${DECK_DIR}/spec/deck-spec.schema.json"
PACKAGE_DEST="${DECK_DIR}/package.json"
PROJECT_TSCONFIG_DEST="${DECK_DIR}/tsconfig.json"
PROJECT_VITEST_CONFIG_DEST="${DECK_DIR}/vitest.config.ts"
RUN_PROJECT_DEST="${DECK_DIR}/run-project.sh"
VALIDATE_DEST="${DECK_DIR}/validate-local.sh"
MAIN_DEST="${DECK_DIR}/src/main.ts"
MEDIA_GENERATE_DEST="${DECK_DIR}/src/asset-pipeline/generateMedia.ts"
MEDIA_POLICY_DEST="${DECK_DIR}/src/asset-pipeline/imagePolicy.ts"
MEDIA_PATHS_DEST="${DECK_DIR}/src/asset-pipeline/paths.ts"
MEDIA_PROVIDER_DEST="${DECK_DIR}/src/deck-spec-module/media/geminiImageProvider.ts"
MEDIA_PROVIDER_ENV_DEST="${DECK_DIR}/src/deck-spec-module/media/providerEnv.ts"
MEDIA_PROVIDER_PROMPT_DEST="${DECK_DIR}/src/deck-spec-module/media/providerPrompt.ts"
SPEC_CONTRACT_DEST="${DECK_DIR}/src/spec/contract.ts"
SPEC_DERIVE_DEST="${DECK_DIR}/src/spec/deriveOutputFileName.ts"
SPEC_NORMALIZE_DEST="${DECK_DIR}/src/spec/normalizeSystemManagedFields.ts"
SPEC_PROMOTE_DEST="${DECK_DIR}/src/spec/promoteDeckSpecCandidate.ts"
SPEC_READ_DEST="${DECK_DIR}/src/spec/readDeckSpec.ts"
SPEC_RENDERER_CONTRACT_DEST="${DECK_DIR}/src/spec/rendererContract.ts"
SPEC_REVIEW_RENDER_DEST="${DECK_DIR}/src/spec/renderSpecReview.ts"
SPEC_REVIEW_CONTRACT_DEST="${DECK_DIR}/src/spec/reviewContract.ts"
SPEC_VALIDATE_DEST="${DECK_DIR}/src/spec/validateDeckSpec.ts"
SPEC_REVIEW_VALIDATE_DEST="${DECK_DIR}/src/spec/validateSpecReview.ts"
SPEC_WRITE_DEST="${DECK_DIR}/src/spec/writeFileAtomic.ts"
STATE_DIR="${DECK_DIR}/.ai-native-slides"

assert_not_project_root "$DECK_DIR" "$SCRIPT_DIR"

DECK_DIR="$(mkdir -p "$DECK_DIR" && cd "$DECK_DIR" && pwd)"
DECK_ROOT="$(find_deck_root_for_project "$DECK_DIR" || true)"

if [[ -z "$DECK_ROOT" ]]; then
  DECK_ROOT="$(infer_deck_root_from_project_dir "$DECK_DIR" || true)"
fi

if [[ -z "$DECK_ROOT" ]]; then
  echo "Could not infer a deck root for project directory: $DECK_DIR" >&2
  echo "Projects must live under <deck-root>/projects/<slug>." >&2
  echo "Initialize them with: bash \"$SCRIPT_DIR/init_deck_project.sh\" <deck-root> <project-name>" >&2
  exit 1
fi

copy_if_missing() {
  local src="$1"
  local dest="$2"

  if [[ -e "${dest}" ]]; then
    echo "Kept existing ${dest}"
    return
  fi

  mkdir -p "$(dirname "${dest}")"
  cp "${src}" "${dest}"
  echo "Wrote ${dest}"
}

sync_managed_file() {
  local src="$1"
  local dest="$2"
  local existed_before=false

  if [[ -e "${dest}" ]]; then
    existed_before=true
  fi

  if [[ -f "${dest}" ]] && cmp -s "${src}" "${dest}"; then
    echo "Up-to-date ${dest}"
    return
  fi

  mkdir -p "$(dirname "${dest}")"
  cp "${src}" "${dest}"
  if [[ "${existed_before}" == true ]]; then
    echo "Refreshed ${dest}"
  else
    echo "Wrote ${dest}"
  fi
}

mkdir -p \
  "${DECK_DIR}/media" \
  "${DECK_DIR}/spec" \
  "${DECK_DIR}/src" \
  "${DECK_DIR}/tests" \
  "${DECK_DIR}/output" \
  "${DECK_DIR}/tmp" \
  "${STATE_DIR}"

while IFS= read -r template_file; do
  relative_path="${template_file#"${TEMPLATE_ROOT}/"}"
  if [[ "${relative_path}" == "validate-local.sh" || "${relative_path}" == "run-project.sh" || "${relative_path}" == "package.json" || "${relative_path}" == "tsconfig.json" || "${relative_path}" == "vitest.config.ts" || "${relative_path}" == ".gitignore" || "${relative_path}" == "spec/deck-spec.schema.json" || "${relative_path}" == "src/main.ts" || "${relative_path}" == "src/asset-pipeline/generateMedia.ts" || "${relative_path}" == "src/asset-pipeline/imagePolicy.ts" || "${relative_path}" == "src/asset-pipeline/paths.ts" || "${relative_path}" == "src/deck-spec-module/media/geminiImageProvider.ts" || "${relative_path}" == "src/deck-spec-module/media/providerEnv.ts" || "${relative_path}" == "src/deck-spec-module/media/providerPrompt.ts" || "${relative_path}" == "src/spec/contract.ts" || "${relative_path}" == "src/spec/deriveOutputFileName.ts" || "${relative_path}" == "src/spec/normalizeSystemManagedFields.ts" || "${relative_path}" == "src/spec/promoteDeckSpecCandidate.ts" || "${relative_path}" == "src/spec/readDeckSpec.ts" || "${relative_path}" == "src/spec/rendererContract.ts" || "${relative_path}" == "src/spec/renderSpecReview.ts" || "${relative_path}" == "src/spec/reviewContract.ts" || "${relative_path}" == "src/spec/validateDeckSpec.ts" || "${relative_path}" == "src/spec/validateSpecReview.ts" || "${relative_path}" == "src/spec/writeFileAtomic.ts" ]]; then
    continue
  fi
  copy_if_missing "${template_file}" "${DECK_DIR}/${relative_path}"
done < <(find "${TEMPLATE_ROOT}" -type f | sort)

if [[ ! -f "${VALIDATE_TEMPLATE}" ]]; then
  echo "Missing validate template: ${VALIDATE_TEMPLATE}" >&2
  exit 1
fi

if [[ ! -f "${RUN_PROJECT_TEMPLATE}" ]]; then
  echo "Missing project runner template: ${RUN_PROJECT_TEMPLATE}" >&2
  exit 1
fi

sync_managed_file "${PROJECT_GITIGNORE_TEMPLATE}" "${PROJECT_GITIGNORE_DEST}"
sync_managed_file "${DECK_SPEC_SCHEMA_TEMPLATE}" "${DECK_SPEC_SCHEMA_DEST}"
sync_managed_file "${PACKAGE_TEMPLATE}" "${PACKAGE_DEST}"
sync_managed_file "${PROJECT_TSCONFIG_TEMPLATE}" "${PROJECT_TSCONFIG_DEST}"
sync_managed_file "${PROJECT_VITEST_CONFIG_TEMPLATE}" "${PROJECT_VITEST_CONFIG_DEST}"
sync_managed_file "${RUN_PROJECT_TEMPLATE}" "${RUN_PROJECT_DEST}"
sync_managed_file "${MAIN_TEMPLATE}" "${MAIN_DEST}"
sync_managed_file "${MEDIA_GENERATE_TEMPLATE}" "${MEDIA_GENERATE_DEST}"
sync_managed_file "${MEDIA_POLICY_TEMPLATE}" "${MEDIA_POLICY_DEST}"
sync_managed_file "${MEDIA_PATHS_TEMPLATE}" "${MEDIA_PATHS_DEST}"
sync_managed_file "${MEDIA_PROVIDER_TEMPLATE}" "${MEDIA_PROVIDER_DEST}"
sync_managed_file "${MEDIA_PROVIDER_ENV_TEMPLATE}" "${MEDIA_PROVIDER_ENV_DEST}"
sync_managed_file "${MEDIA_PROVIDER_PROMPT_TEMPLATE}" "${MEDIA_PROVIDER_PROMPT_DEST}"
sync_managed_file "${SPEC_CONTRACT_TEMPLATE}" "${SPEC_CONTRACT_DEST}"
sync_managed_file "${SPEC_DERIVE_TEMPLATE}" "${SPEC_DERIVE_DEST}"
sync_managed_file "${SPEC_NORMALIZE_TEMPLATE}" "${SPEC_NORMALIZE_DEST}"
sync_managed_file "${SPEC_PROMOTE_TEMPLATE}" "${SPEC_PROMOTE_DEST}"
sync_managed_file "${SPEC_READ_TEMPLATE}" "${SPEC_READ_DEST}"
sync_managed_file "${SPEC_RENDERER_CONTRACT_TEMPLATE}" "${SPEC_RENDERER_CONTRACT_DEST}"
sync_managed_file "${SPEC_REVIEW_RENDER_TEMPLATE}" "${SPEC_REVIEW_RENDER_DEST}"
sync_managed_file "${SPEC_REVIEW_CONTRACT_TEMPLATE}" "${SPEC_REVIEW_CONTRACT_DEST}"
sync_managed_file "${SPEC_VALIDATE_TEMPLATE}" "${SPEC_VALIDATE_DEST}"
sync_managed_file "${SPEC_REVIEW_VALIDATE_TEMPLATE}" "${SPEC_REVIEW_VALIDATE_DEST}"
sync_managed_file "${SPEC_WRITE_TEMPLATE}" "${SPEC_WRITE_DEST}"
chmod +x "${RUN_PROJECT_DEST}"

sync_managed_file "${VALIDATE_TEMPLATE}" "${VALIDATE_DEST}"
chmod +x "${VALIDATE_DEST}"

remove_retired_path() {
  local target_path="$1"

  if [[ -e "$target_path" ]]; then
    rm -rf "$target_path"
    echo "Removed retired ${target_path}"
  fi
}

remove_retired_path "${DECK_DIR}/src/deck-spec-module/asset-planning"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/canonicalization"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/errors.ts"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/planning"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/prompt-interpreter"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/public-api.ts"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/review-bridge"
remove_retired_path "${DECK_DIR}/src/deck-spec-module/reviewing"

write_project_metadata "$DECK_ROOT" "$DECK_DIR" "$(basename "$DECK_DIR")" "$(basename "$DECK_DIR")"

bash "${SCRIPT_DIR}/ensure_deck_project.sh" "${DECK_DIR}"
