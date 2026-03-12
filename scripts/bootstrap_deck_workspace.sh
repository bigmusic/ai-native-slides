#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <deck-workspace> [--force]" >&2
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
HELPERS_SRC="${SKILL_ROOT}/assets/pptxgenjs_helpers"
HELPERS_DEST="${DECK_DIR}/assets/pptxgenjs_helpers"
VALIDATE_DEST="${DECK_DIR}/validate-local.sh"
PACKAGE_TEMPLATE="${SKILL_ROOT}/assets/templates/package.json"
PACKAGE_DEST="${DECK_DIR}/package.json"
STATE_DIR="${DECK_DIR}/.ai-native-slides"

mkdir -p "${DECK_DIR}/assets" "${STATE_DIR}"
rsync -a --delete "${HELPERS_SRC}/" "${HELPERS_DEST}/"

if [[ ! -e "${PACKAGE_DEST}" ]] && [[ -f "${PACKAGE_TEMPLATE}" ]]; then
  cp "${PACKAGE_TEMPLATE}" "${PACKAGE_DEST}"
  echo "Wrote ${PACKAGE_DEST}"
elif [[ -e "${PACKAGE_DEST}" ]]; then
  echo "Kept existing ${PACKAGE_DEST}"
fi

if [[ -e "${VALIDATE_DEST}" && "${FORCE}" -ne 1 ]]; then
  echo "Skipped existing ${VALIDATE_DEST}. Re-run with --force to replace it."
else
  cat > "${VALIDATE_DEST}" <<'EOF'
#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTHON="$ROOT_DIR/.venv/bin/python"
TMP_DIR="$ROOT_DIR/tmp"
RENDERED_DIR="$ROOT_DIR/rendered"
OUTPUT_DIR="$ROOT_DIR/output"
PPTX_PATH="${1:-$OUTPUT_DIR/ai-native-ppt-product.pptx}"
REPORT_PATH="$OUTPUT_DIR/local-validation.md"
FONT_JSON_PATH="$OUTPUT_DIR/font-report.json"
MONTAGE_PATH="$OUTPUT_DIR/montage.png"
SKILL_DIR="${AI_NATIVE_SLIDES_SKILL_DIR:-$HOME/.codex/skills/ai-native-slides}"
SKILL_SCRIPTS_DIR="$SKILL_DIR/scripts"
STATE_FILE="$ROOT_DIR/.ai-native-slides/state.json"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Missing deck venv python: $VENV_PYTHON" >&2
  exit 1
fi

if [[ ! -d "$SKILL_SCRIPTS_DIR" ]]; then
  echo "Missing installed skill scripts: $SKILL_SCRIPTS_DIR" >&2
  echo "Set AI_NATIVE_SLIDES_SKILL_DIR or sync the skill into ~/.codex/skills/ai-native-slides." >&2
  exit 1
fi

if ! bash "$SKILL_SCRIPTS_DIR/ensure_deck_workspace.sh" "$ROOT_DIR" --quiet; then
  echo "Workspace preflight failed. See $STATE_FILE." >&2
  exit 1
fi

export TMPDIR="$TMP_DIR"
export TMP="$TMP_DIR"
export TEMP="$TMP_DIR"
export SAL_USE_VCLPLUGIN="svp"

mkdir -p "$TMP_DIR" "$RENDERED_DIR" "$OUTPUT_DIR"

rm -f "$REPORT_PATH" "$FONT_JSON_PATH"
rm -f "$MONTAGE_PATH"
rm -f "$RENDERED_DIR"/slide-*.png

cat <<REPORT > "$REPORT_PATH"
# Local Validation Report

- Generated at: $(date '+%Y-%m-%d %H:%M:%S %z')
- Workspace: $ROOT_DIR
- TMPDIR: $TMPDIR
- Skill dir: $SKILL_DIR
- Workspace state: $STATE_FILE

REPORT

append_section() {
  local title="$1"
  local command_text="$2"
  local output_file="$3"
  local exit_code="$4"

  {
    echo "## $title"
    echo
    echo '```bash'
    echo "$command_text"
    echo '```'
    echo
    echo "- Exit code: $exit_code"
    echo
    echo '```text'
    cat "$output_file"
    echo '```'
    echo
  } >> "$REPORT_PATH"
}

run_and_capture() {
  local title="$1"
  shift
  local cmd=("$@")
  local output_file
  local exit_code
  output_file="$(mktemp "$TMPDIR/${title// /_}.XXXXXX.log")"

  set +e
  "${cmd[@]}" >"$output_file" 2>&1
  exit_code=$?
  set -e

  append_section "$title" "${cmd[*]}" "$output_file" "$exit_code"
  rm -f "$output_file"
  return 0
}

run_and_capture "Versions" \
  /bin/bash -lc "uv --version && soffice --version && '$VENV_PYTHON' --version && pdfinfo -v && pdftoppm -v"

run_and_capture "Build Deck" \
  /bin/bash -lc "cd '$ROOT_DIR' && pnpm build"

run_and_capture "Render Slides" \
  "$VENV_PYTHON" "$SKILL_SCRIPTS_DIR/render_slides.py" \
  "$PPTX_PATH" \
  --output_dir "$RENDERED_DIR"

run_and_capture "Overflow Check" \
  "$VENV_PYTHON" "$SKILL_SCRIPTS_DIR/slides_test.py" \
  "$PPTX_PATH"

run_and_capture "Build Montage" \
  "$VENV_PYTHON" "$SKILL_SCRIPTS_DIR/create_montage.py" \
  --input_dir "$RENDERED_DIR" \
  --output_file "$MONTAGE_PATH"

run_and_capture "Detect Font" \
  /bin/bash -lc "'$VENV_PYTHON' '$SKILL_SCRIPTS_DIR/detect_font.py' '$PPTX_PATH' --json | tee '$FONT_JSON_PATH'"

{
  echo "## Artifacts"
  echo
  echo "- PPTX: $PPTX_PATH"
  echo "- Report: $REPORT_PATH"
  echo "- Font JSON: $FONT_JSON_PATH"
  echo "- Montage: $MONTAGE_PATH"
  echo "- Rendered slides: $RENDERED_DIR"
  echo
} >> "$REPORT_PATH"

echo "Validation complete."
echo "Markdown report: $REPORT_PATH"
EOF

  chmod +x "${VALIDATE_DEST}"
  echo "Wrote ${VALIDATE_DEST}"
fi

echo "Synced helper assets to ${HELPERS_DEST}"
bash "${SCRIPT_DIR}/ensure_deck_workspace.sh" "${DECK_DIR}"
