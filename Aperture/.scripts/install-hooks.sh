#!/bin/bash
# Install git hooks for Aperture repository
# Run this once after cloning: ./scripts/install-hooks.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "🔧 Installing git hooks..."

# Install commit-msg hook
if [ -f "$SCRIPT_DIR/commit-msg" ]; then
  ln -sf "../../.scripts/commit-msg" "$GIT_HOOKS_DIR/commit-msg"
  echo "✅ Installed commit-msg hook (enforces Conventional Commits)"
else
  echo "❌ commit-msg hook not found in $SCRIPT_DIR"
  exit 1
fi

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "Hooks installed:"
echo "  - commit-msg: Enforces Conventional Commits format"
echo ""
echo "To bypass (not recommended):"
echo "  git commit --no-verify -m \"message\""
echo ""
echo "Recommended:"
echo "  Use /commit command in Claude Code for proper messages"
