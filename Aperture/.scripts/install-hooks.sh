#!/bin/bash
# Install git hooks for Aperture repository
# Run this once after cloning: ./.scripts/install-hooks.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "🔧 Installing git hooks..."
echo ""

# Install commit-msg hook
if [ -f "$SCRIPT_DIR/commit-msg" ]; then
  ln -sf "../../.scripts/commit-msg" "$GIT_HOOKS_DIR/commit-msg"
  chmod +x "$GIT_HOOKS_DIR/commit-msg"
  echo "✅ Installed commit-msg hook (enforces Conventional Commits)"
else
  echo "❌ commit-msg hook not found in $SCRIPT_DIR"
  exit 1
fi

# Install pre-commit hook
if [ -f "$SCRIPT_DIR/pre-commit" ]; then
  ln -sf "../../.scripts/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
  chmod +x "$GIT_HOOKS_DIR/pre-commit"
  echo "✅ Installed pre-commit hook (enforces documentation updates)"
else
  echo "❌ pre-commit hook not found in $SCRIPT_DIR"
  exit 1
fi

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "Hooks installed:"
echo "  • commit-msg: Enforces Conventional Commits format"
echo "  • pre-commit: Validates documentation updates when code changes"
echo ""
echo "To bypass (use sparingly):"
echo "  git commit --no-verify"
echo ""
echo "Recommended workflow:"
echo "  1. Make code changes"
echo "  2. Use /update-docs command in Claude Code"
echo "  3. Update NEXT_SESSION.md"
echo "  4. Commit (hooks will validate)"
echo ""
