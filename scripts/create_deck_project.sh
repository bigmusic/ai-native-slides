#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <project-root> <project-name> [--force]" >&2
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
  echo "Use migrate_single_workspace_to_project.sh instead of creating a nested project in place." >&2
  exit 1
fi

PROJECT_SLUG="$(slugify_project_name "$PROJECT_NAME")"
PROJECTS_DIR="${PROJECT_ROOT}/projects"
PROJECT_DIR="${PROJECTS_DIR}/${PROJECT_SLUG}"

mkdir -p "$PROJECTS_DIR"

if [[ -e "$PROJECT_DIR" && "$FORCE" -ne 1 ]]; then
  echo "Project already exists: $PROJECT_DIR" >&2
  echo "Use init_deck_project.sh if you want an idempotent initialize-or-refresh entrypoint." >&2
  echo "Re-run with --force if you intend to refresh project-scoped bootstrap files." >&2
  exit 1
fi

if [[ "$FORCE" -eq 1 ]]; then
  exec bash "${SCRIPT_DIR}/init_deck_project.sh" "$PROJECT_ROOT" "$PROJECT_NAME" --force
fi

exec bash "${SCRIPT_DIR}/init_deck_project.sh" "$PROJECT_ROOT" "$PROJECT_NAME"
