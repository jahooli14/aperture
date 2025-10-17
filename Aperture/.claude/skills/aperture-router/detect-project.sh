#!/bin/bash
# Aperture Router - Project Detection Script
# Detects whether current directory is NUDJ (work) or Aperture (personal)

set -e

echo "🔍 Detecting project type..."
echo ""

PROJECT_TYPE="unknown"
CONFIDENCE="low"

# Check 1: Directory structure
echo "📁 Checking directory structure..."
if [ -d "apps/api" ] && [ -d "apps/admin" ] && [ -d "apps/user" ]; then
    echo "  ✅ Found NUDJ monorepo structure (apps/api, apps/admin, apps/user)"
    PROJECT_TYPE="nudj"
    CONFIDENCE="high"
elif [ -d "projects/wizard-of-oz" ]; then
    echo "  ✅ Found Aperture project structure (projects/wizard-of-oz)"
    PROJECT_TYPE="aperture"
    CONFIDENCE="high"
else
    echo "  ⚠️  No distinctive directory structure found"
fi

echo ""

# Check 2: Documentation files
echo "📚 Checking documentation files..."
if [ -f "CLAUDE-NUDJ.md" ]; then
    echo "  ✅ Found CLAUDE-NUDJ.md"
    if [ "$PROJECT_TYPE" = "unknown" ]; then
        PROJECT_TYPE="nudj"
        CONFIDENCE="medium"
    fi
elif [ -f "CLAUDE-APERTURE.md" ]; then
    echo "  ✅ Found CLAUDE-APERTURE.md"
    if [ "$PROJECT_TYPE" = "unknown" ]; then
        PROJECT_TYPE="aperture"
        CONFIDENCE="medium"
    fi
else
    echo "  ⚠️  No project-specific CLAUDE.md found"
fi

echo ""

# Check 3: Git remote
echo "🌐 Checking git remote..."
if git remote -v 2>/dev/null | grep -q "nudj-digital"; then
    echo "  ✅ Git remote points to nudj-digital organization"
    if [ "$PROJECT_TYPE" = "unknown" ]; then
        PROJECT_TYPE="nudj"
        CONFIDENCE="medium"
    fi
elif git remote -v 2>/dev/null | grep -q "aperture"; then
    echo "  ✅ Git remote contains 'aperture'"
    if [ "$PROJECT_TYPE" = "unknown" ]; then
        PROJECT_TYPE="aperture"
        CONFIDENCE="medium"
    fi
else
    echo "  ℹ️  Git remote doesn't indicate project type"
fi

echo ""

# Check 4: Package files
echo "📦 Checking package configuration..."
if [ -f "pnpm-workspace.yaml" ]; then
    if grep -q "@nudj-digital" pnpm-workspace.yaml 2>/dev/null; then
        echo "  ✅ Found @nudj-digital packages in workspace"
        if [ "$PROJECT_TYPE" = "unknown" ]; then
            PROJECT_TYPE="nudj"
            CONFIDENCE="high"
        fi
    fi
elif [ -f "projects/wizard-of-oz/package.json" ]; then
    echo "  ✅ Found wizard-of-oz package.json"
    if [ "$PROJECT_TYPE" = "unknown" ]; then
        PROJECT_TYPE="aperture"
        CONFIDENCE="medium"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Final output
if [ "$PROJECT_TYPE" = "nudj" ]; then
    echo "✅ Project Detected: NUDJ (Work)"
    echo "📚 Documentation: CLAUDE-NUDJ.md"
    echo "🎯 Type: Monorepo with apps/api, apps/admin, apps/user"
    echo "🔒 Confidence: $CONFIDENCE"
elif [ "$PROJECT_TYPE" = "aperture" ]; then
    echo "✅ Project Detected: Aperture (Personal)"
    echo "📚 Documentation: CLAUDE-APERTURE.md"
    echo "🎯 Type: Multi-project framework with wizard-of-oz"
    echo "🔒 Confidence: $CONFIDENCE"
else
    echo "❌ Project Type: Unknown"
    echo "⚠️  Could not determine project type"
    echo "💡 Suggestion: Check if you're in the correct directory"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
