#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

LAST_SHA_FILE="$PROJECT_ROOT/.claude/last_git_sha"
CURRENT_SHA="$(git rev-parse HEAD)"

mkdir -p "$PROJECT_ROOT/.claude"

if [[ ! -f "$LAST_SHA_FILE" ]]; then
  echo "=== Autonomous Improvement Harness ==="
  echo "No last validated snapshot found. Recording current HEAD ($CURRENT_SHA) as the baseline."
  echo "$CURRENT_SHA" > "$LAST_SHA_FILE"
  echo
  echo "Mission reminder:"
  echo "- Core mission: grow the Minecraft colony with human-like Claude-led bots (see AGENTS.md section 'Autonomous Improvement Harness')."
  echo "- Honor the operating rules: reusable general tools, layered skills, and structured logging." 
  echo "- Deliver a clear Phase 1 improvement before pausing again."
  echo
  echo "Keep going—produce meaningful changes before asking for human input."
  exit 0
fi

LAST_SHA="$(cat "$LAST_SHA_FILE")"

if ! git cat-file -e "${LAST_SHA}^{commit}" >/dev/null 2>&1; then
  echo "Stored last_git_sha '$LAST_SHA' does not refer to a valid commit. Update $LAST_SHA_FILE with a real baseline." >&2
  exit 1
fi

echo "=== Autonomous Improvement Harness ==="
echo "Last validated snapshot: $LAST_SHA"
echo "Current HEAD: $CURRENT_SHA"

if [[ "$LAST_SHA" == "$CURRENT_SHA" ]]; then
  echo
  echo "No new commits since the last validated snapshot. Inspect working tree changes below."
fi

COMMITS=$(git --no-pager log --oneline "${LAST_SHA}..${CURRENT_SHA}" || true)
if [[ -n "$COMMITS" ]]; then
  echo
  echo "Recent commits since last validation:"
  echo "$COMMITS"
fi

DIFFSTAT=$(git --no-pager diff --stat "${LAST_SHA}..${CURRENT_SHA}" || true)
if [[ -n "$DIFFSTAT" ]]; then
  echo
  echo "Change footprint:"
  echo "$DIFFSTAT"
fi

CHANGED_FILES=()
while IFS= read -r FILE; do
  [[ -z "$FILE" ]] && continue
  CHANGED_FILES+=("$FILE")
done < <(git --no-pager diff --name-only "${LAST_SHA}..${CURRENT_SHA}" || true)

WORKING_FILES=()
while IFS= read -r ENTRY; do
  [[ -z "$ENTRY" ]] && continue
  WORKING_FILES+=("$ENTRY")
done < <(git status --short)

TS_CHANGES=false
SKILL_CHANGES=false
DOC_CHANGED=false
TESTS_CHANGED=false
TOOL_CHANGES=false

for FILE in "${CHANGED_FILES[@]:-}"; do
  [[ -z "$FILE" ]] && continue
  case "$FILE" in
    *.ts|*.tsx)
      TS_CHANGES=true
      ;;
  esac
  case "$FILE" in
    skills/*|.claude/skills/*)
      SKILL_CHANGES=true
      ;;
  esac
  case "$FILE" in
    *CHANGELOG.md|*README.md|*AGENTS.md|*TODO.md)
      DOC_CHANGED=true
      ;;
  esac
  case "$FILE" in
    *test*.ts|tests/*)
      TESTS_CHANGED=true
      ;;
  esac
  case "$FILE" in
    src/tools/*|tools/*)
      TOOL_CHANGES=true
      ;;
  esac
done

echo
echo "Constructive critique:"
if [[ ${#CHANGED_FILES[@]} -eq 0 && ${#WORKING_FILES[@]} -eq 0 ]]; then
  echo "- Nothing new compared to the baseline. Deliver a tangible improvement before pausing."
else
  if [[ ${#CHANGED_FILES[@]} -gt 0 ]]; then
    echo "- ${#CHANGED_FILES[@]} tracked file(s) changed since validation:"
    for FILE in "${CHANGED_FILES[@]}"; do
      [[ -z "$FILE" ]] && continue
      echo "  - $FILE"
    done
  fi
  if [[ ${#WORKING_FILES[@]} -gt 0 ]]; then
    echo "- Working tree still has pending edits:"
    for ENTRY in "${WORKING_FILES[@]}"; do
      echo "  - $ENTRY"
    done
  fi
  if [[ "$TS_CHANGES" == true && "$TESTS_CHANGED" == false ]]; then
    echo "- TypeScript logic changed but no tests were detected—add smoke/integration coverage or stronger logging assertions."
  fi
  if [[ "$TOOL_CHANGES" == true ]]; then
    echo "- Tool definitions moved—synchronize Zod schemas, documentation, and skill references."
  fi
  if [[ "$DOC_CHANGED" == false ]]; then
    echo "- Update docs (CHANGELOG.md / AGENTS.md / TODO.md) so humans can track the improvement." 
  fi
  if [[ "$SKILL_CHANGES" == true ]]; then
    echo "- Skills changed—rerun in-game validation to ensure Claude follows the revised instructions." 
  fi
fi

echo
echo "Mission reminder:"
echo "- Core mission: grow the Claude-managed Minecraft colony with human-like, well-coordinated bots."
echo "- Build mastery with reusable tools and layered skills before expanding beyond Phase 1."
echo "- Validate progress via logs, diary entries, and server evidence before declaring success."

echo
echo "Keep going—address the feedback, iterate on improvements, and only escalate once a new validated snapshot is ready."
