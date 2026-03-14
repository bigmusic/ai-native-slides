#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <project-dir>" >&2
}

if [[ "$#" -ne 1 ]]; then
  usage
  exit 1
fi

PROJECT_DIR="$(cd "$1" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
source "${SCRIPTS_DIR}/project_lib.sh"

assert_not_project_root "$PROJECT_DIR" "$SCRIPT_DIR"

DECK_ROOT="$(find_deck_root_for_project "$PROJECT_DIR" || true)"
if [[ -z "$DECK_ROOT" ]]; then
  DECK_ROOT="$(infer_deck_root_from_project_dir "$PROJECT_DIR" || true)"
fi

if [[ -z "$DECK_ROOT" ]]; then
  echo "Could not infer a deck root for project directory: $PROJECT_DIR" >&2
  echo "Projects must live under <deck-root>/projects/<slug>." >&2
  exit 1
fi

STATE_FILE="${PROJECT_DIR}/.ai-native-slides/state.json"

echo "Initializing shared deck root..."
bash "${SCRIPTS_DIR}/init_deck_root.sh" "$DECK_ROOT"

echo "Bootstrapping project files..."
set +e
bash "${SCRIPTS_DIR}/bootstrap_deck_project.sh" "$PROJECT_DIR" --force
project_bootstrap_exit=$?
set -e

if [[ "$project_bootstrap_exit" -ne 0 ]]; then
  echo "Project bootstrap reported an incomplete project. Continuing with project state refresh..."
fi

echo "Refreshing project state..."
if bash "${SCRIPTS_DIR}/ensure_deck_project.sh" "$PROJECT_DIR"; then
  echo "Project repair complete. Project is ready."
  exit 0
fi

echo "Project repair finished, but manual follow-up is still required." >&2
echo "See ${STATE_FILE}" >&2
exit 1
