---
name: aperture-router
description: Detects whether you're working on NUDJ (work) or Aperture (personal) projects and routes to the appropriate documentation based on directory structure, git remote, and user keywords
---

# Aperture Router

## Purpose

This skill automatically identifies which project you're working on (NUDJ work vs Aperture personal) and loads the correct documentation context.

## When to Activate

**Auto-trigger on:**
- Session start when project context is unclear
- User mentions project-specific keywords (nudj, aperture, wizard-of-oz, etc.)
- Switching between repositories
- Before reading detailed documentation

## Detection Strategy

### 1. Check User Keywords

**NUDJ (Work) Indicators:**
- "nudj", "admin app", "user app", "API"
- "MongoDB", "gamification", "challenges", "rewards"
- "monorepo", "pnpm workspace", "turbo"
- "@nudj-digital" packages

**Aperture (Personal) Indicators:**
- "aperture", "wizard-of-oz", "baby photos"
- "Supabase", "Vercel", "personal project"
- "timelapse", "photo alignment", "eye detection"

### 2. Check Directory Structure

Run the detection script:

```bash
./.claude/skills/aperture-router/detect-project.sh
```

**NUDJ indicators:**
- `apps/api/`, `apps/admin/`, `apps/user/` directories exist
- `packages/database/` exists
- `pnpm-workspace.yaml` with @nudj-digital packages

**Aperture indicators:**
- `projects/wizard-of-oz/` directory exists
- `CLAUDE-APERTURE.md` file exists
- No monorepo structure

### 3. Check Git Remote

```bash
git remote -v | grep -q "nudj-digital" && echo "NUDJ" || echo "Aperture"
```

## Routing Logic

```
IF NUDJ detected:
  → Read CLAUDE-NUDJ.md
  → Reference apps/*/CLAUDE.md for app-specific details
  → Load NUDJ-specific skills (if exists)

ELSE IF Aperture detected:
  → Read CLAUDE-APERTURE.md
  → Read START_HERE.md for onboarding
  → Read NEXT_SESSION.md for current status
  → Load Aperture skills

ELSE:
  → Ask user which project they're working on
  → List detected characteristics
  → Suggest running detect-project.sh
```

## Documentation Hierarchy

### For NUDJ (Work)
1. `CLAUDE-NUDJ.md` - Monorepo documentation
2. `apps/api/CLAUDE.md` - API service docs
3. `apps/admin/CLAUDE.md` - Admin app docs
4. `apps/user/CLAUDE.md` - User app docs
5. `packages/database/CLAUDE.md` - Database schemas

### For Aperture (Personal)
1. `CLAUDE-APERTURE.md` - Main project documentation
2. `START_HERE.md` - Session startup guide
3. `NEXT_SESSION.md` - Current status and tasks
4. `SESSION_CHECKLIST.md` - Workflow guide
5. `.claude/skills/` - Aperture-specific skills

## Output Format

After successful detection, respond:

```
✅ Project Detected: [NUDJ | Aperture]
📁 Repository: [git remote or path]
📚 Loading: [documentation file]
🎯 Context: [brief description]
```

## Edge Cases

**Mixed Repository:**
If repository contains both NUDJ and Aperture:
- Check current working directory
- Prioritize user's explicit keywords
- Default to asking for clarification

**Unknown Project:**
If unable to determine:
1. List detected characteristics
2. Show directory structure summary
3. Ask user to confirm project type
4. Suggest running `detect-project.sh` for details

## Examples

**Example 1: Clear NUDJ Context**
```
User: "I need to add a new challenge to the admin app"

Detection:
- Keyword: "challenge", "admin app" → NUDJ
- Directory check: apps/admin/ exists → NUDJ
- Git remote: nudj-digital/monorepo → NUDJ

Result: ✅ NUDJ detected, loading CLAUDE-NUDJ.md
```

**Example 2: Clear Aperture Context**
```
User: "The wizard of oz photo upload is broken"

Detection:
- Keyword: "wizard of oz", "photo upload" → Aperture
- Directory check: projects/wizard-of-oz/ exists → Aperture
- Git remote: contains "aperture" → Aperture

Result: ✅ Aperture detected, loading CLAUDE-APERTURE.md
```

**Example 3: Ambiguous Context**
```
User: "Can you help me fix this bug?"

Detection:
- No project-specific keywords
- Need to check directory structure
- Run detection script

Result: Running detection, then ask user if unclear
```

## Guidelines

- **Always verify** before making assumptions
- **Run detection script** when in doubt
- **Communicate** what you detected and why
- **Ask user** if context remains unclear
- **Don't mix documentation** - NUDJ and Aperture have completely different patterns
