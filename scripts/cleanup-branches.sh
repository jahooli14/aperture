#!/bin/bash
# Deletes all merged/stale claude/* and dependabot/* branches, keeping only main.
# Run from the repo root with appropriate GitHub credentials.

set -e

KEEP_BRANCHES=("main")

echo "Fetching remote branches..."
git fetch --prune

BRANCHES_TO_DELETE=$(git branch -r \
  | grep -v "origin/main" \
  | grep -v "HEAD" \
  | sed 's|  origin/||')

COUNT=$(echo "$BRANCHES_TO_DELETE" | wc -l)
echo "Found $COUNT branches to delete."

for branch in $BRANCHES_TO_DELETE; do
  echo "Deleting: $branch"
  git push origin --delete "$branch" || echo "  FAILED: $branch"
done

echo "Done. Remaining remote branches:"
git branch -r
