#!/bin/bash
#
# Pre-push hook for build validation
# Ensures all code passes build checks before pushing to remote
#

set -e

echo "🔍 Running build checks before push..."

# Navigate to the polymath project directory
cd "$(git rev-parse --show-toplevel)/Aperture/projects/polymath"

# Run the build
if npm run build; then
  echo "✅ Build passed! Proceeding with push."
  exit 0
else
  echo "❌ Build failed! Fix errors before pushing."
  echo ""
  echo "To bypass this check (not recommended), use:"
  echo "  git push --no-verify"
  exit 1
fi
