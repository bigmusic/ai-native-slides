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
PACKAGE_TEMPLATE="${TEMPLATE_ROOT}/package.json"
PROJECT_TSCONFIG_TEMPLATE="${TEMPLATE_ROOT}/tsconfig.json"
PROJECT_VITEST_CONFIG_TEMPLATE="${TEMPLATE_ROOT}/vitest.config.ts"
RUN_PROJECT_TEMPLATE="${TEMPLATE_ROOT}/run-project.sh"
VALIDATE_TEMPLATE="${TEMPLATE_ROOT}/validate-local.sh"
MAIN_TEMPLATE="${TEMPLATE_ROOT}/src/main.ts"
PROJECT_GITIGNORE_DEST="${DECK_DIR}/.gitignore"
PACKAGE_DEST="${DECK_DIR}/package.json"
PROJECT_TSCONFIG_DEST="${DECK_DIR}/tsconfig.json"
PROJECT_VITEST_CONFIG_DEST="${DECK_DIR}/vitest.config.ts"
RUN_PROJECT_DEST="${DECK_DIR}/run-project.sh"
VALIDATE_DEST="${DECK_DIR}/validate-local.sh"
MAIN_DEST="${DECK_DIR}/src/main.ts"
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

copy_rule_file() {
  local src="$1"
  local dest="$2"

  if [[ -e "${dest}" && "${FORCE}" -ne 1 ]]; then
    echo "Kept existing ${dest}"
    return
  fi

  mkdir -p "$(dirname "${dest}")"
  cp "${src}" "${dest}"
  echo "Wrote ${dest}"
}

mkdir -p "${DECK_DIR}/assets" "${STATE_DIR}"

set +e
bash "${SCRIPT_DIR}/bootstrap_deck_root.sh" "${DECK_ROOT}"
root_bootstrap_exit=$?
set -e

while IFS= read -r template_file; do
  relative_path="${template_file#"${TEMPLATE_ROOT}/"}"
  if [[ "${relative_path}" == "validate-local.sh" || "${relative_path}" == "run-project.sh" || "${relative_path}" == "package.json" || "${relative_path}" == "tsconfig.json" || "${relative_path}" == "vitest.config.ts" || "${relative_path}" == ".gitignore" || "${relative_path}" == "src/main.ts" ]]; then
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

copy_rule_file "${PROJECT_GITIGNORE_TEMPLATE}" "${PROJECT_GITIGNORE_DEST}"
copy_rule_file "${PACKAGE_TEMPLATE}" "${PACKAGE_DEST}"
copy_rule_file "${PROJECT_TSCONFIG_TEMPLATE}" "${PROJECT_TSCONFIG_DEST}"
copy_rule_file "${PROJECT_VITEST_CONFIG_TEMPLATE}" "${PROJECT_VITEST_CONFIG_DEST}"
copy_rule_file "${RUN_PROJECT_TEMPLATE}" "${RUN_PROJECT_DEST}"
copy_rule_file "${MAIN_TEMPLATE}" "${MAIN_DEST}"
chmod +x "${RUN_PROJECT_DEST}"

if [[ -e "${VALIDATE_DEST}" && "${FORCE}" -ne 1 ]]; then
  echo "Skipped existing ${VALIDATE_DEST}. Re-run with --force to replace it."
else
  copy_rule_file "${VALIDATE_TEMPLATE}" "${VALIDATE_DEST}"
  chmod +x "${VALIDATE_DEST}"
fi

write_project_metadata "$DECK_ROOT" "$DECK_DIR" "$(basename "$DECK_DIR")" "$(basename "$DECK_DIR")"

if [[ "$root_bootstrap_exit" -ne 0 ]]; then
  echo "Shared deck root is scaffolded but not fully ready yet: $DECK_ROOT" >&2
fi

bash "${SCRIPT_DIR}/ensure_deck_workspace.sh" "${DECK_DIR}"
