#!/bin/bash
# Skip builds on non-main branches
if [[ "$VERCEL_GIT_COMMIT_REF" != "main" ]]; then exit 0; fi

PROJECT_DIR="$1"
ROOT=$(git rev-parse --show-toplevel)
BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

# If BASE is invalid, proceed with build
git rev-parse "$BASE" >/dev/null 2>&1 || exit 1

# Build only if project files changed
git diff --quiet "$BASE" HEAD -- "$ROOT/$PROJECT_DIR" || exit 1
