#!/usr/bin/env bash
# PreToolUse hook: reject PR titles that are multi-line or > 70 chars.
# Fires on mcp__github__create_pull_request and mcp__github__update_pull_request.
# For update calls without a `title` field, allow (treated as unrelated edit).

set -euo pipefail

input="$(cat)"
title="$(printf '%s' "$input" | jq -r '.tool_input.title // empty')"

if [[ -z "$title" ]]; then
  exit 0
fi

if [[ "$title" == *$'\n'* ]]; then
  jq -n --arg t "$title" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("PR title must be a single line. You pasted the commit body into the title. Use only the commit subject (first line, <=70 chars). Received:\n" + $t)
    }
  }'
  exit 0
fi

len=${#title}
if (( len > 70 )); then
  jq -n --arg t "$title" --arg len "$len" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: ("PR title must be <=70 chars, got " + $len + ". Rewrite as a short conventional-commit subject. Received: " + $t)
    }
  }'
  exit 0
fi

exit 0
