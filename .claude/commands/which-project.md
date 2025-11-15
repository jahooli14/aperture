# Which Project Command

**Purpose**: Automatically detect which project you're working on (NUDJ or Aperture) to load correct documentation.

**Usage**: `/which-project`

---

## What This Command Does

Analyzes the current repository to determine the project context and provides the appropriate documentation path.

---

## Detection Logic

### Check 1: Git Remote
```bash
git remote -v | head -n1
```

- If contains `nudj-digital` → **NUDJ (work)**
- If contains `aperture` or `jahooli14` → **APERTURE (personal)**

### Check 2: Directory Structure
```bash
ls -la
```

**NUDJ indicators**:
- `apps/api/` directory exists
- `apps/admin/` directory exists
- `apps/user/` directory exists
- `packages/` directory with `@nudj-digital` packages
- `pnpm-workspace.yaml` exists

**APERTURE indicators**:
- `projects/wizard-of-oz/` directory exists
- `.process/` directory exists
- `CLAUDE-APERTURE.md` exists

### Check 3: package.json
```bash
cat package.json | grep -E "name|workspaces"
```

**NUDJ indicators**:
- `"name": "@nudj-digital/*"`
- `"workspaces"` with PNPM configuration

**APERTURE indicators**:
- Individual project packages
- No monorepo configuration

---

## Output Format

```
🔍 Project Detection
-------------------

📂 Git Remote:
   Origin: git@github.com:jahooli14/aperture.git
   → APERTURE detected

📂 Directory Structure:
   ✅ projects/wizard-of-oz/ (found)
   ✅ .process/ (found)
   ✅ CLAUDE-APERTURE.md (found)
   ❌ apps/api/ (not found)
   → Structure confirms APERTURE

📦 Package Configuration:
   Type: Individual project
   → APERTURE confirmed

---
✅ Project: APERTURE (personal)
📖 Read: CLAUDE-APERTURE.md
📍 Current focus: projects/wizard-of-oz

Next steps:
1. Read CLAUDE-APERTURE.md for project patterns
2. Read NEXT_SESSION.md for current status
3. Check projects/wizard-of-oz/plan.md for implementation state
```

---

## When to Run

**Run this command when**:
- Starting a new session (if unsure which project)
- Context switch between work/personal
- Claude seems confused about project structure
- Before reading documentation (to know which CLAUDE.md to read)

**Integrated into**:
- START_HERE.md automated startup sequence
- Can replace manual CLAUDE.md router reading

---

## Implementation

### Bash Script Version (for automation)
```bash
#!/bin/bash

echo "🔍 Project Detection"
echo "-------------------"
echo ""

# Check git remote
echo "📂 Git Remote:"
REMOTE=$(git remote -v 2>/dev/null | head -n1 || echo "No git remote found")
echo "   $REMOTE"

if echo "$REMOTE" | grep -q "nudj-digital"; then
  PROJECT="NUDJ"
  DOC="CLAUDE-NUDJ.md"
elif echo "$REMOTE" | grep -qE "aperture|jahooli14"; then
  PROJECT="APERTURE"
  DOC="CLAUDE-APERTURE.md"
else
  PROJECT="UNKNOWN"
  DOC="CLAUDE.md"
fi

echo "   → $PROJECT detected"
echo ""

# Check directory structure
echo "📂 Directory Structure:"
if [ -d "apps/api" ]; then
  echo "   ✅ apps/api/ (found)"
  STRUCTURE="NUDJ"
else
  echo "   ❌ apps/api/ (not found)"
fi

if [ -d "projects/wizard-of-oz" ]; then
  echo "   ✅ projects/wizard-of-oz/ (found)"
  STRUCTURE="APERTURE"
else
  echo "   ❌ projects/wizard-of-oz/ (not found)"
fi

if [ -d ".process" ]; then
  echo "   ✅ .process/ (found)"
fi

echo "   → Structure confirms $STRUCTURE"
echo ""

# Check package configuration
echo "📦 Package Configuration:"
if [ -f "pnpm-workspace.yaml" ]; then
  echo "   Type: PNPM monorepo"
  echo "   → NUDJ"
elif [ -f "package.json" ]; then
  echo "   Type: Individual project"
  echo "   → APERTURE"
fi
echo ""

# Final determination
echo "---"
if [ "$PROJECT" = "NUDJ" ]; then
  echo "✅ Project: NUDJ (work)"
  echo "📖 Read: CLAUDE-NUDJ.md"
  echo "📍 Monorepo with apps/api, apps/admin, apps/user"
elif [ "$PROJECT" = "APERTURE" ]; then
  echo "✅ Project: APERTURE (personal)"
  echo "📖 Read: CLAUDE-APERTURE.md"

  if [ -d "projects/wizard-of-oz" ]; then
    echo "📍 Current focus: projects/wizard-of-oz"
  fi
else
  echo "❓ Project: UNKNOWN"
  echo "📖 Check CLAUDE.md for routing"
fi

echo ""
echo "Next steps:"
if [ "$PROJECT" = "APERTURE" ]; then
  echo "1. Read CLAUDE-APERTURE.md for project patterns"
  echo "2. Read NEXT_SESSION.md for current status"
  echo "3. Check projects/wizard-of-oz/plan.md for implementation state"
elif [ "$PROJECT" = "NUDJ" ]; then
  echo "1. Read CLAUDE-NUDJ.md for project patterns"
  echo "2. Read NEXT_SESSION.md for current status"
  echo "3. Check relevant app directory for context"
else
  echo "1. Read CLAUDE.md to determine project"
  echo "2. Check git remote and directory structure manually"
fi
```

Save this as `.scripts/which-project.sh` and make executable:
```bash
chmod +x .scripts/which-project.sh
```

---

## Future Enhancement

Could be integrated with Claude Code's startup sequence to automatically load the correct CLAUDE.md file without manual intervention.
