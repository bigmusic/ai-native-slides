#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-root> [--force]" >&2
}

FORCE=0
DECK_ROOT=""

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
      if [[ -n "$DECK_ROOT" ]]; then
        usage
        exit 1
      fi
      DECK_ROOT="$arg"
      ;;
  esac
done

if [[ -z "$DECK_ROOT" ]]; then
  usage
  exit 1
fi

DECK_ROOT="$(mkdir -p "$DECK_ROOT" && cd "$DECK_ROOT" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/project_lib.sh"

assert_not_project_dir "$DECK_ROOT" "$SCRIPT_DIR"

STATE_FILE="${DECK_ROOT}/.ai-native-slides/state.json"
NODE_MODULES_DIR="${DECK_ROOT}/node_modules"
VENV_PYTHON="${DECK_ROOT}/.venv/bin/python"
UV_CACHE_DIR="${DECK_ROOT}/.uv-cache"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 1
  fi
}

node_dependencies_installed() {
  [[ -d "$NODE_MODULES_DIR/@google" ]] && \
  [[ -d "$NODE_MODULES_DIR/@google/genai" ]] && \
  [[ -d "$NODE_MODULES_DIR/ajv" ]] && \
  [[ -d "$NODE_MODULES_DIR/pptxgenjs" ]] && \
  [[ -d "$NODE_MODULES_DIR/skia-canvas" ]] && \
  [[ -d "$NODE_MODULES_DIR/sharp" ]] && \
  [[ -d "$NODE_MODULES_DIR/fontkit" ]] && \
  [[ -d "$NODE_MODULES_DIR/linebreak" ]] && \
  [[ -d "$NODE_MODULES_DIR/prismjs" ]] && \
  [[ -d "$NODE_MODULES_DIR/mathjax-full" ]] && \
  [[ -d "$NODE_MODULES_DIR/typescript" ]] && \
  [[ -d "$NODE_MODULES_DIR/tsx" ]] && \
  [[ -d "$NODE_MODULES_DIR/vitest" ]] && \
  [[ -d "$NODE_MODULES_DIR/@biomejs/biome" ]] && \
  [[ -d "$NODE_MODULES_DIR/@types/node" ]]
}

python_packages_installed() {
  [[ -x "$VENV_PYTHON" ]] && \
  "$VENV_PYTHON" -c "import PIL, pdf2image, pptx, numpy" >/dev/null 2>&1
}

run_uv() {
  (
    cd "$DECK_ROOT"
    UV_CACHE_DIR="$UV_CACHE_DIR" uv "$@"
  )
}

bootstrap_args=("$DECK_ROOT")
if [[ "$FORCE" -eq 1 ]]; then
  bootstrap_args+=("--force")
fi

echo "Initializing shared deck root files..."
set +e
bash "${SCRIPT_DIR}/bootstrap_deck_root.sh" "${bootstrap_args[@]}"
bootstrap_exit=$?
set -e

if [[ "$bootstrap_exit" -ne 0 ]]; then
  echo "Root bootstrap reported an incomplete deck root. Continuing with shared runtime setup..."
fi

require_command node
require_command pnpm
require_command uv
mkdir -p "$UV_CACHE_DIR"

if ! node_dependencies_installed; then
  echo "Installing shared Node dependencies with pnpm..."
  (
    cd "$DECK_ROOT"
    pnpm install
  )
else
  echo "Shared Node dependencies already installed."
fi

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Creating shared Python environment..."
  run_uv venv --python 3.12 .venv
else
  echo "Shared Python environment already exists."
fi

if ! python_packages_installed; then
  echo "Installing shared Python packages..."
  run_uv pip install --python .venv/bin/python Pillow pdf2image python-pptx numpy
else
  echo "Shared Python packages already installed."
fi

echo "Refreshing shared root state..."
if bash "${SCRIPT_DIR}/ensure_deck_root.sh" "$DECK_ROOT"; then
  echo "Shared deck root is ready."
  exit 0
fi

echo "Shared deck root initialization finished, but manual follow-up is still required." >&2
echo "See ${STATE_FILE}" >&2
exit 1
