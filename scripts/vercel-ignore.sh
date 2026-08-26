#!/bin/bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 runs it.

# Skip builds on non-main branches
if [[ "$VERCEL_GIT_COMMIT_REF" != "main" ]]; then exit 0; fi

PROJECT_DIR="$1"
ROOT=$(git rev-parse --show-toplevel)

# No previous deployment on this branch means this is the project's first
# build. There is nothing to diff against, so it has to run. Without this a
# newly created Vercel project can never build: it would fall back to
# comparing the single latest commit, which in a monorepo usually belongs to
# a different project entirely.
if [[ -z "$VERCEL_GIT_PREVIOUS_SHA" ]]; then exit 1; fi

# If the previous SHA isn't in this clone, proceed with build
git rev-parse "$VERCEL_GIT_PREVIOUS_SHA" >/dev/null 2>&1 || exit 1

# Redeploying the commit that is already live. Nothing in git has changed, so
# the diff below would always skip it — but a redeploy of the same commit is
# only ever asked for deliberately, and it is how an environment variable
# change is picked up. Always build.
CURRENT=$(git rev-parse HEAD)
PREVIOUS=$(git rev-parse "$VERCEL_GIT_PREVIOUS_SHA")
if [[ "$CURRENT" == "$PREVIOUS" ]]; then exit 1; fi

# Build only if this project's files changed
git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- "$ROOT/$PROJECT_DIR" || exit 1
