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
  echo "Use migrate_single_workspace_to_project.sh instead of initializing a nested project in place." >&2
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
bash "${SCRIPT_DIR}/bootstrap_deck_workspace.sh" "${bootstrap_args[@]}"
bootstrap_exit=$?
set -e

if [[ "$bootstrap_exit" -ne 0 && ! -f "${PROJECT_DIR}/.ai-native-slides/state.json" ]]; then
  exit "$bootstrap_exit"
fi

write_project_metadata "$PROJECT_ROOT" "$PROJECT_DIR" "$PROJECT_NAME" "$PROJECT_SLUG"

if [[ "$bootstrap_exit" -ne 0 ]]; then
  echo "Project initialized, but the shared root or project bootstrap still needs follow-up." >&2
  echo "See ${PROJECT_DIR}/.ai-native-slides/state.json for the next repair steps." >&2
fi

cat <<EOF
Project initialized: $PROJECT_DIR
Template-managed files:
- .gitignore
- package.json
- tsconfig.json
- vitest.config.ts
- run-project.sh
- validate-local.sh
- src/main.ts

Starter template files:
- src/buildDeck.ts
- src/presentationModel.ts
- tests/buildDeck.test.ts
EOF
