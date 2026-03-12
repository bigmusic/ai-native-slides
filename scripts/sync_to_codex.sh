#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CODEX_HOME_DIR="${CODEX_HOME:-${HOME}/.codex}"
DEST_DIR="${CODEX_HOME_DIR}/skills/ai-native-slides"

mkdir -p "$(dirname "${DEST_DIR}")"

rsync -a --delete \
  --exclude ".git/" \
  --exclude ".DS_Store" \
  --exclude "__pycache__/" \
  --exclude "*.pyc" \
  "${REPO_ROOT}/" "${DEST_DIR}/"

echo "Synced skill to ${DEST_DIR}"
echo "Restart Codex to pick up the updated skill."
