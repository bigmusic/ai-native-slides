#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <media|build|lint|format|spec|spec:validate|typecheck|test|test:watch> [args...]" >&2
}

if [[ "$#" -lt 1 ]]; then
  usage
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION="$1"
shift
if [[ "${1:-}" == "--" ]]; then
  shift
fi
BUILD_DECK_TS="$PROJECT_DIR/src/buildDeck.ts"
PRESENTATION_MODEL_TS="$PROJECT_DIR/src/presentationModel.ts"

find_deck_root() {
  local current_dir
  current_dir="$1"

  while [[ "$current_dir" != "/" ]]; do
    if [[ -f "$current_dir/.ai-native-slides/root.json" ]]; then
      printf '%s' "$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done

  return 1
}

DECK_ROOT="$(find_deck_root "$PROJECT_DIR" || true)"
if [[ -z "$DECK_ROOT" ]]; then
  echo "Could not find the shared deck root for project: $PROJECT_DIR" >&2
  exit 1
fi

BIN_DIR="$DECK_ROOT/node_modules/.bin"
if [[ ! -d "$BIN_DIR" ]]; then
  echo "Missing shared node_modules at: $DECK_ROOT/node_modules" >&2
  echo "Run 'pnpm install' in the deck root first." >&2
  exit 1
fi

project_content_present() {
  [[ -f "$BUILD_DECK_TS" ]] && [[ -f "$PRESENTATION_MODEL_TS" ]]
}

project_tests_present() {
  [[ -d "$PROJECT_DIR/tests" ]] && \
    find "$PROJECT_DIR/tests" -type f \( -name '*.test.ts' -o -name '*.spec.ts' \) | grep -q .
}

case "$ACTION" in
  media)
    (
      cd "$PROJECT_DIR"
      DECK_ROOT="$DECK_ROOT" node --import tsx src/asset-pipeline/generateMedia.ts "$@"
    )
    ;;
  build)
    if ! project_content_present; then
      echo "Project scaffold is ready, but deck content has not been generated yet." >&2
      echo "Create src/buildDeck.ts and src/presentationModel.ts from the user's prompt first." >&2
      exit 1
    fi
    (
      cd "$PROJECT_DIR"
      node --import tsx src/main.ts
    )
    ;;
  spec:validate)
    (
      cd "$PROJECT_DIR"
      DECK_ROOT="$DECK_ROOT" node --import tsx "$DECK_ROOT/packages/deck-spec-module/src/cli/runValidateCli.ts" "$PROJECT_DIR" "$@"
    )
    ;;
  spec)
    (
      cd "$PROJECT_DIR"
      DECK_ROOT="$DECK_ROOT" node --import tsx "$DECK_ROOT/packages/deck-spec-module/src/cli/runSpecCli.ts" "$PROJECT_DIR" "$@"
    )
    ;;
  lint)
    "$BIN_DIR/biome" check "$PROJECT_DIR/src" "$PROJECT_DIR/tests"
    ;;
  format)
    "$BIN_DIR/biome" check --write "$PROJECT_DIR/src" "$PROJECT_DIR/tests"
    ;;
  typecheck)
    "$BIN_DIR/tsc" --noEmit -p "$PROJECT_DIR/tsconfig.json"
    ;;
  test)
    if ! project_tests_present; then
      echo "Project scaffold is ready, but no TypeScript tests exist yet." >&2
      echo "Generate tests under $PROJECT_DIR/tests before running 'pnpm test'." >&2
      exit 1
    fi
    (
      cd "$PROJECT_DIR"
      "$BIN_DIR/vitest" run "$@"
    )
    ;;
  test:watch)
    if ! project_tests_present; then
      echo "Project scaffold is ready, but no TypeScript tests exist yet." >&2
      echo "Generate tests under $PROJECT_DIR/tests before running 'pnpm test:watch'." >&2
      exit 1
    fi
    (
      cd "$PROJECT_DIR"
      "$BIN_DIR/vitest" "$@"
    )
    ;;
  *)
    usage
    exit 1
    ;;
esac
