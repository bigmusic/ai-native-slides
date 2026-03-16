#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <legacy-workspace-root> <project-name>" >&2
}

if [[ "$#" -ne 2 ]]; then
  usage
  exit 1
fi

DECK_ROOT="$1"
PROJECT_NAME="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPTS_DIR}/project_lib.sh"

DECK_ROOT="$(cd "$DECK_ROOT" && pwd)"

if is_project_root "$DECK_ROOT" && [[ ! -f "$DECK_ROOT/src/main.ts" ]]; then
  echo "Deck root is already projectized: $DECK_ROOT" >&2
  exit 1
fi

if ! is_legacy_deck_workspace "$DECK_ROOT"; then
  echo "Path does not look like a legacy single-workspace deck: $DECK_ROOT" >&2
  exit 1
fi

PROJECT_SLUG="$(slugify_project_name "$PROJECT_NAME")"
PROJECTS_DIR="${DECK_ROOT}/projects"
PROJECT_DIR="${PROJECTS_DIR}/${PROJECT_SLUG}"

if [[ -e "$PROJECT_DIR" ]]; then
  echo "Target project directory already exists: $PROJECT_DIR" >&2
  exit 1
fi

mkdir -p "$PROJECT_DIR"

if [[ -d "${DECK_ROOT}/assets" ]]; then
  mkdir -p "${PROJECT_DIR}/media"
  while IFS= read -r asset_path; do
    asset_name="$(basename "$asset_path")"
    if [[ "$asset_name" == "pptxgenjs_helpers" ]]; then
      continue
    fi
    mv "$asset_path" "${PROJECT_DIR}/media/${asset_name}"
  done < <(find "${DECK_ROOT}/assets" -mindepth 1 -maxdepth 1 | sort)
  rmdir "${DECK_ROOT}/assets" 2>/dev/null || true
fi

MOVE_ITEMS=(
  "output"
  "rendered"
  "src"
  "tests"
  "tmp"
)

for item in "${MOVE_ITEMS[@]}"; do
  if [[ -e "${DECK_ROOT}/${item}" ]]; then
    mv "${DECK_ROOT}/${item}" "${PROJECT_DIR}/${item}"
  fi
done

rm -f "${DECK_ROOT}/validate-local.sh" "${DECK_ROOT}/run-project.sh" "${DECK_ROOT}/tsconfig.json"

set +e
bash "${SCRIPTS_DIR}/init_deck_root.sh" "$DECK_ROOT" --force
root_bootstrap_exit=$?
set -e

set +e
bash "${SCRIPTS_DIR}/bootstrap_deck_project.sh" "$PROJECT_DIR" --force
project_bootstrap_exit=$?
set -e

write_project_metadata "$DECK_ROOT" "$PROJECT_DIR" "$PROJECT_NAME" "$PROJECT_SLUG"

find "${PROJECT_DIR}/src" -type f -name '*.ts' -print0 2>/dev/null | while IFS= read -r -d '' file; do
  perl -0pi -e 's#\.\./asset-pipeline/pptxgenjs_helpers/#../../../assets/pptxgenjs_helpers/#g' "$file"
done

if [[ "$root_bootstrap_exit" -ne 0 ]]; then
  echo "Shared root initialization completed with follow-up suggestions." >&2
fi

if [[ "$project_bootstrap_exit" -ne 0 ]]; then
  echo "Project migration completed, but the project is not fully ready yet." >&2
  echo "See ${PROJECT_DIR}/.ai-native-slides/state.json for the next follow-up steps." >&2
fi

echo "Migration complete."
echo "Project root: $DECK_ROOT"
echo "Project dir: $PROJECT_DIR"
