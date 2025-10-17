# Aperture Skills

A collection of specialized skills for Claude Code to improve development workflows on Aperture projects.

## What are Skills?

Skills are self-contained folders with instructions, scripts, and resources that Claude automatically loads when relevant to your task. They enable:

- **Composable**: Multiple skills work together automatically
- **Portable**: Same format across Claude apps, Claude Code, and API
- **Efficient**: Only relevant information loads when needed
- **Powerful**: Include executable scripts for reliable automation

## Available Skills

### 📍 aperture-router
**Purpose:** Project detection and documentation routing

**When it activates:**
- Session start when project unclear
- User mentions project keywords (NUDJ, Aperture, wizard-of-oz)
- Switching between repositories

**What it does:**
- Detects NUDJ (work) vs Aperture (personal) projects
- Routes to correct documentation
- Analyzes directory structure and git remote

**Files:**
- `SKILL.md` - Main instructions
- `detect-project.sh` - Executable project detection script

---

### 📸 wizard-of-oz
**Purpose:** Development patterns for baby photo alignment app

**When it activates:**
- Working in `projects/wizard-of-oz/`
- Photo upload, eye detection, or alignment tasks
- Supabase or Gemini AI integration

**What it does:**
- Provides React/TypeScript/Vite patterns
- Supabase integration guidance
- Deployment workflows
- Common issue solutions

**Files:**
- `SKILL.md` - Development guide
- `architecture.md` - System architecture deep dive
- `common-tasks.sh` - Quick command access

---

### 🔄 session-management
**Purpose:** Session continuity and task handoffs

**When it activates:**
- New session starts
- User asks "what's next?"
- Switching between tasks

**What it does:**
- Structured startup procedures
- Status checking workflows
- Task prioritization
- Documentation updates

**Files:**
- `SKILL.md` - Session management guide
- `session-checklist.md` - Detailed checklists

---

### 🛠️ development-workflow
**Purpose:** Common development commands and workflows

**When it activates:**
- Running dev server, builds, or tests
- Setting up local environment
- User asks "how do I run/build/test?"

**What it does:**
- Standard npm commands
- Build and test procedures
- Environment variable setup
- Debugging techniques

**Files:**
- `SKILL.md` - Workflow documentation
- `dev-commands.sh` - Common command shortcuts

---

### 🚀 vercel-deployment
**Purpose:** Vercel deployment procedures

**When it activates:**
- Deploying to production
- Managing environment variables
- Debugging deployment issues
- User mentions Vercel

**What it does:**
- Deployment workflows
- Environment variable management
- Vercel configuration patterns
- Rollback procedures

**Files:**
- `SKILL.md` - Deployment guide
- `deploy.sh` - Automated deployment helper

---

## How Claude Uses Skills

### Automatic Activation

Claude automatically identifies which skills are relevant based on:
- User's question or request
- Current working directory
- Files being edited
- Project context

### Progressive Loading

Claude loads only what's needed:
1. **SKILL.md** loads when skill triggers
2. **Additional files** load on-demand
3. **Scripts** execute when needed

### Composability

Multiple skills can activate together:
- `aperture-router` + `wizard-of-oz` when working on photo app
- `session-management` + `development-workflow` when starting work
- `wizard-of-oz` + `vercel-deployment` when deploying

## Using Skills Manually

### View Available Skills

```bash
ls -la .claude/skills/
```

### Run Helper Scripts

```bash
# Project detection
./.claude/skills/aperture-router/detect-project.sh

# Wizard of Oz tasks
./.claude/skills/wizard-of-oz/common-tasks.sh [command]

# Development workflow
./.claude/skills/development-workflow/dev-commands.sh [command]

# Deploy to Vercel
./.claude/skills/vercel-deployment/deploy.sh
```

### Read Skill Documentation

Each skill's `SKILL.md` contains:
- Trigger conditions
- Instructions
- Examples
- Guidelines

## Skill Structure

Standard format for each skill:

```
skill-name/
├── SKILL.md              # Required: Main instructions with YAML frontmatter
├── additional-docs.md    # Optional: Supplementary documentation
└── scripts/
    └── helper.sh         # Optional: Executable scripts
```

### SKILL.md Format

```markdown
---
name: skill-name
description: Brief description of what this skill does and when to use it
---

# Skill Name

## Purpose
[What this skill provides]

## When to Activate
[Trigger conditions]

## Instructions
[Detailed guidance]

## Examples
[Usage examples]

## Guidelines
[Best practices]
```

## Creating New Skills

### 1. Create Skill Directory

```bash
mkdir .claude/skills/new-skill
```

### 2. Create SKILL.md

```markdown
---
name: new-skill
description: What it does and when to use it (max 1024 chars)
---

# New Skill

[Instructions for Claude]
```

### 3. Add Resources (Optional)

```bash
# Additional documentation
touch .claude/skills/new-skill/reference.md

# Helper scripts
touch .claude/skills/new-skill/helper.sh
chmod +x .claude/skills/new-skill/helper.sh
```

### 4. Update This README

Add your skill to the "Available Skills" section.

## Best Practices

### Skill Design

**DO:**
- ✅ Clear, specific trigger conditions
- ✅ Concise SKILL.md (focus on essentials)
- ✅ Additional files for deep dives
- ✅ Executable scripts for repetitive tasks
- ✅ Examples and guidelines

**DON'T:**
- ❌ Duplicate content across skills
- ❌ Make SKILL.md too long (use additional files)
- ❌ Overlap skill purposes
- ❌ Include secrets or credentials

### Documentation

- Keep SKILL.md focused and scannable
- Use additional .md files for detailed info
- Include practical examples
- Reference related skills

### Scripts

- Make scripts executable (`chmod +x`)
- Include error handling
- Use clear output messages
- Test before committing

## Integration with Existing Docs

Skills complement existing documentation:

**Skills (`.claude/skills/`):**
- Auto-loaded when relevant
- Focused, specific workflows
- Executable helpers
- Context-aware

**CLAUDE.md files:**
- Always-available reference
- Comprehensive patterns
- Architecture details
- Project overview

**Use both together** for optimal Claude Code experience.

## Troubleshooting

### Skill Not Activating

1. Check trigger conditions in SKILL.md
2. Verify file structure is correct
3. Ensure SKILL.md has valid YAML frontmatter
4. Check description is clear and specific

### Script Not Working

1. Verify script is executable (`chmod +x`)
2. Check file paths are correct
3. Review error messages
4. Test script manually

### Need More Help

- Review [Anthropic Skills documentation](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- Check existing skills for examples
- Ask Claude to help debug

## Related Documentation

- **CLAUDE-APERTURE.md** - Aperture project documentation
- **START_HERE.md** - Session onboarding
- **NEXT_SESSION.md** - Current status and tasks
- **SESSION_CHECKLIST.md** - Workflow guide

## Skill Changelog

**2025-10-17:**
- ✅ Created aperture-router skill
- ✅ Created wizard-of-oz skill
- ✅ Created session-management skill
- ✅ Created development-workflow skill
- ✅ Created vercel-deployment skill
- ✅ Migrated from skill.json to proper SKILL.md format
- ✅ Added executable helper scripts
- ✅ Added comprehensive documentation

## Contributing

When adding or modifying skills:

1. Follow the SKILL.md format
2. Keep descriptions under 1024 characters
3. Test helper scripts
4. Update this README
5. Document in changelog
6. Commit with clear message

---

**Built with:** Anthropic Skills framework
**Maintained by:** Aperture Development Team
**Last Updated:** 2025-10-17
