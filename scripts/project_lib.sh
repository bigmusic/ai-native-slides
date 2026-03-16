#!/usr/bin/env bash

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "$value"
}

json_write_string_array_items() {
  local indent="$1"
  shift
  local items=("$@")
  local last_index

  if [[ "${#items[@]}" -eq 0 ]]; then
    return 0
  fi

  last_index=$((${#items[@]} - 1))

  for i in "${!items[@]}"; do
    local suffix=","
    if [[ "$i" -eq "$last_index" ]]; then
      suffix=""
    fi
    printf '%s"%s"%s\n' "$indent" "$(json_escape "${items[$i]}")" "$suffix"
  done
}

existing_json_string_field() {
  local file_path="$1"
  local field_name="$2"

  if [[ ! -f "$file_path" ]]; then
    return 1
  fi

  sed -nE "s/^[[:space:]]*\"${field_name}\"[[:space:]]*:[[:space:]]*\"([^\"]*)\".*/\\1/p" "$file_path" | head -n 1
}

write_file_if_changed() {
  local dest_path="$1"
  local tmp_path="$2"

  if [[ -f "$dest_path" ]] && cmp -s "$dest_path" "$tmp_path"; then
    rm -f "$tmp_path"
    return 0
  fi

  mv "$tmp_path" "$dest_path"
}

create_workspace_temp_file() {
  local base_dir="$1"
  local prefix="$2"

  mkdir -p "$base_dir"
  mktemp "$base_dir/${prefix}.XXXXXX"
}

slugify_project_name() {
  local name="$1"
  local slug
  slug="$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"

  if [[ -z "$slug" ]]; then
    echo "Project name must produce a non-empty slug." >&2
    return 1
  fi

  printf '%s' "$slug"
}

root_metadata_path() {
  local deck_root="$1"
  printf '%s/.ai-native-slides/root.json' "$deck_root"
}

project_metadata_path() {
  local project_dir="$1"
  printf '%s/.ai-native-slides/project.json' "$project_dir"
}

is_project_root() {
  local path="$1"
  [[ -f "$(root_metadata_path "$path")" ]] || [[ -d "$path/projects" && ! -f "$(project_metadata_path "$path")" ]]
}

is_project_dir() {
  local path="$1"
  [[ -f "$(project_metadata_path "$path")" ]]
}

is_legacy_deck_workspace() {
  local path="$1"
  [[ ! -d "$path/projects" && ! -f "$(root_metadata_path "$path")" && ( -f "$path/src/main.ts" || -x "$path/validate-local.sh" ) ]]
}

find_deck_root_for_project() {
  local start_dir="$1"
  local current_dir
  current_dir="$(cd "$start_dir" && pwd)"

  while [[ "$current_dir" != "/" ]]; do
    if [[ -f "$(root_metadata_path "$current_dir")" ]]; then
      printf '%s' "$current_dir"
      return 0
    fi
    current_dir="$(dirname "$current_dir")"
  done

  return 1
}

infer_deck_root_from_project_dir() {
  local project_dir="$1"
  local abs_project_dir
  local projects_dir
  abs_project_dir="$(cd "$project_dir" && pwd)"
  projects_dir="$(dirname "$abs_project_dir")"

  if [[ "$(basename "$projects_dir")" == "projects" ]]; then
    printf '%s' "$(dirname "$projects_dir")"
    return 0
  fi

  return 1
}

skill_worktree_dirty() {
  local skill_root="$1"

  if ! git -C "$skill_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 1
  fi

  [[ -n "$(git -C "$skill_root" status --short --untracked-files=normal 2>/dev/null)" ]]
}

resolve_skill_revision() {
  local skill_root="$1"

  if git -C "$skill_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local revision
    revision="$(git -C "$skill_root" rev-parse --short HEAD)"
    if skill_worktree_dirty "$skill_root"; then
      printf '%s-dirty' "$revision"
    else
      printf '%s' "$revision"
    fi
    return 0
  fi

  shasum -a 256 "$skill_root/SKILL.md" | awk '{print $1}'
}

project_template_managed_files() {
  cat <<'EOF'
.gitignore
spec/deck-spec.schema.json
package.json
tsconfig.json
vitest.config.ts
run-project.sh
validate-local.sh
tests/projectScaffoldMaintenance.test.ts
src/main.ts
src/media/generatedImagePaths.ts
src/spec/contract.ts
src/spec/deriveOutputFileName.ts
src/spec/normalizeSystemManagedFields.ts
src/spec/runDeckSpec.ts
src/spec/readDeckSpec.ts
src/spec/rendererContract.ts
src/spec/renderSpecReview.ts
src/spec/reviewContract.ts
src/spec/validateDeckSpec.ts
src/spec/validateSpecReview.ts
src/spec/writeFileAtomic.ts
EOF
}

project_prompt_generated_files() {
  cat <<'EOF'
spec/deck-spec.json
src/buildDeck.ts
src/presentationModel.ts
tests/buildDeck.test.ts
EOF
}

project_content_dirs() {
  cat <<'EOF'
media
spec
src
tests
output
tmp
EOF
}

project_ignored_generated_dirs() {
  cat <<'EOF'
node_modules
rendered
EOF
}

write_root_metadata() {
  local deck_root="$1"
  local metadata_path
  metadata_path="$(root_metadata_path "$deck_root")"
  local created_at
  created_at="$(existing_json_string_field "$metadata_path" "created_at" || true)"

  if [[ -z "$created_at" ]]; then
    created_at="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  fi

  local tmp_file
  tmp_file="$(create_workspace_temp_file "$(dirname "$metadata_path")" "root-metadata")"

  mkdir -p "$(dirname "$metadata_path")"

  cat > "$tmp_file" <<EOF
{
  "layout_version": 2,
  "deck_root": "$(json_escape "$deck_root")",
  "managed_by": "ai-native-slides",
  "created_at": "$(json_escape "$created_at")"
}
EOF

  write_file_if_changed "$metadata_path" "$tmp_file"
}

render_project_metadata_file() {
  local deck_root="$1"
  local project_dir="$2"
  local project_name="$3"
  local project_slug="$4"
  local metadata_path="$5"
  local created_at="$6"
  local -a template_managed_files=()
  local -a prompt_generated_files=()
  local -a content_dirs=()
  local -a ignored_generated_dirs=()

  if [[ -z "$created_at" ]]; then
    created_at="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  fi

  while IFS= read -r item; do
    template_managed_files+=("$item")
  done < <(project_template_managed_files)

  while IFS= read -r item; do
    prompt_generated_files+=("$item")
  done < <(project_prompt_generated_files)

  while IFS= read -r item; do
    content_dirs+=("$item")
  done < <(project_content_dirs)

  while IFS= read -r item; do
    ignored_generated_dirs+=("$item")
  done < <(project_ignored_generated_dirs)

  mkdir -p "$(dirname "$metadata_path")"

  {
    echo "{"
    echo "  \"layout_version\": 2,"
    echo "  \"project_name\": \"$(json_escape "$project_name")\","
    echo "  \"project_slug\": \"$(json_escape "$project_slug")\","
    echo "  \"project_root\": \"$(json_escape "$deck_root")\","
    echo "  \"project_dir\": \"$(json_escape "$project_dir")\","
    echo "  \"managed_by\": \"ai-native-slides\","
    echo "  \"template_managed_files\": ["
    json_write_string_array_items "    " "${template_managed_files[@]}"
    echo "  ],"
    echo "  \"prompt_generated_files\": ["
    json_write_string_array_items "    " "${prompt_generated_files[@]}"
    echo "  ],"
    echo "  \"project_content_dirs\": ["
    json_write_string_array_items "    " "${content_dirs[@]}"
    echo "  ],"
    echo "  \"ignored_generated_dirs\": ["
    json_write_string_array_items "    " "${ignored_generated_dirs[@]}"
    echo "  ],"
    echo "  \"created_at\": \"$(json_escape "$created_at")\""
    echo "}"
  } > "$metadata_path"
}

write_project_metadata() {
  local deck_root="$1"
  local project_dir="$2"
  local project_name="$3"
  local project_slug="$4"
  local metadata_path
  metadata_path="$(project_metadata_path "$project_dir")"
  local created_at
  created_at="$(existing_json_string_field "$metadata_path" "created_at" || true)"

  if [[ -z "$created_at" ]]; then
    created_at="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  fi

  local tmp_file
  tmp_file="$(create_workspace_temp_file "$(dirname "$metadata_path")" "project-metadata")"

  render_project_metadata_file \
    "$deck_root" \
    "$project_dir" \
    "$project_name" \
    "$project_slug" \
    "$tmp_file" \
    "$created_at"

  write_file_if_changed "$metadata_path" "$tmp_file"
}

assert_not_project_root() {
  local path="$1"
  local script_dir="$2"

  if is_project_root "$path"; then
    echo "Path looks like a deck project root, not a single deck project: $path" >&2
    echo "Initialize a project with: bash \"$script_dir/init_deck_project.sh\" \"$path\" <project-name>" >&2
    echo "Or pass a concrete project directory under \"$path/projects/<slug>\"." >&2
    return 1
  fi

  return 0
}

assert_not_project_dir() {
  local path="$1"
  local script_dir="$2"

  if is_project_dir "$path"; then
    echo "Path looks like a project directory, not a deck root: $path" >&2
    echo "Pass the parent root above \"$path\", or use project-level scripts such as:" >&2
    echo "bash \"$script_dir/ensure_deck_project.sh\" \"$path\"" >&2
    return 1
  fi

  return 0
}
