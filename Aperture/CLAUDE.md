# 🚦 CLAUDE.md - Project Router

> **🧭 You are here**: Project Router
>
> **Purpose**: Distinguish NUDJ (work) vs Aperture (personal) projects
>
> **Note**: `.claude/startup.md` is auto-read every session and handles session initialization. This file helps you choose the right project documentation.

---

## Which CLAUDE.md Should You Use?

### 🏢 Working on NUDJ (Work Projects)?

**Read this file**: **`CLAUDE-NUDJ.md`**

This includes:
- Nudj monorepo (apps/api, apps/admin, apps/user)
- @nudj-digital packages
- PNPM workspaces with Turbo
- MongoDB with gamification features
- Multi-tenant SaaS platform

### 🏠 Working on Aperture (Personal Projects)?

**Read this file**: **`CLAUDE-APERTURE.md`**

**Personal Projects**:
- **Wizard of Oz** - Baby photo app with face alignment
- **MemoryOS** - Voice-to-memory personal knowledge graph

**Meta Projects** (Infrastructure):
- **Self-Healing Tests** - Automated test repair system
- **Autonomous Docs** - Self-optimizing documentation

Other personal experiments, Vercel deployments, Supabase backends

---

## 📖 Lazy Loading Strategy

**IMPORTANT**: Don't read entire docs upfront. Use task-based navigation.

**Navigation Tools**:
- `NAVIGATION.md` - Task-based index (implementation, review, modification)
- `.process/WHEN_TO_READ.md` - Meta-guide for when to read what

**Examples**:
- Implementing feature → Read CLAUDE-{PROJECT}.md → Tool Design section
- Debugging → Read .process/COMMON_MISTAKES.md
- Modifying autonomous docs → Read scripts/autonomous-docs/FEATURE_GUIDE.md

---

## How to Tell Which Project You're On

### Check the User's Request
- **Work keywords**: Nudj, admin app, user app, API, MongoDB, gamification, challenges, rewards
- **Personal project keywords**:
  - Wizard of Oz, baby photos, face alignment
  - MemoryOS, voice notes, Audiopen, memory graph
- **Meta project keywords**:
  - Self-healing tests, test repair, meta-testing
  - Autonomous docs, documentation optimization, knowledge updates

### Check Current Directory
```bash
# If you see these directories → NUDJ (work)
apps/api/, apps/admin/, apps/user/, packages/database/

# If you see these directories → Aperture
# Personal Projects:
projects/wizard-of-oz/     # Baby photo app
projects/memory-os/        # MemoryOS system

# Meta Projects:
scripts/autonomous-docs/   # Documentation automation
scripts/self-healing-tests/ # Test repair system
```

### Check git remote
```bash
# NUDJ (work)
git remote -v
# → github.com/nudj-digital/monorepo

# Aperture (personal)
git remote -v
# → github.com/jahooli14/aperture
```

---

## Autonomous Documentation System

**Aperture projects include self-optimizing documentation**:
- Updates daily at 09:00 UTC with latest AI/Claude best practices
- **Replaces** outdated content (not additive)
- Optimizes for token efficiency
- Modes: REPLACE (supersede), MERGE (consolidate), REFACTOR (compress), NEW (add)

**When docs update**: Check `knowledge-base/changelogs/` for what changed
**Modifying system**: See `scripts/autonomous-docs/FEATURE_GUIDE.md`

---

## Quick Decision Tree

```
Is the user asking about:
├─ Nudj platform, admin interface, gamification?
│  └─ Use CLAUDE-NUDJ.md
│
├─ Wizard of Oz, baby photos?
│  └─ Use CLAUDE-APERTURE.md (Wizard of Oz project)
│
├─ MemoryOS, voice notes, Audiopen, memory graph?
│  └─ Use CLAUDE-APERTURE.md (MemoryOS project)
│
├─ Self-healing tests, test repair, meta-testing?
│  └─ Use CLAUDE-APERTURE.md (Self-Healing Tests meta project)
│
├─ Autonomous docs, documentation optimization?
│  └─ Use CLAUDE-APERTURE.md (Autonomous Docs meta project)
│
└─ Not sure?
   └─ Ask the user which project they're working on (see Step 2 in startup.md)
```

---

## Important Notes

1. **Never mix documentation** - NUDJ and Aperture have completely different structures
2. **Always confirm** - If unclear, ask the user before proceeding
3. **Read the right file** - Using wrong docs will cause confusion and errors

---

## 🧭 Navigation

**After determining project type**:

**If NUDJ (work)** → Read `CLAUDE-NUDJ.md`
**If Aperture (personal)** → Read `CLAUDE-APERTURE.md`

**Note**: `.claude/startup.md` handles automatic session startup sequence. This router just helps you pick the right project documentation.

---

## Files at a Glance

| File | Purpose | Role |
|------|---------|------|
| `.claude/startup.md` | **Auto-read every session** | Session initialization & checks |
| `CLAUDE.md` | **Project router** (you are here) | Choose NUDJ vs Aperture |
| `CLAUDE-NUDJ.md` | Work projects documentation | NUDJ patterns & conventions |
| `CLAUDE-APERTURE.md` | Personal projects documentation | Aperture patterns & conventions |
| `NEXT_SESSION.md` | Current status & tasks | Continuing work (Aperture) |
| `START_HERE.md` | Onboarding guide | First time setup (Aperture) |

---

**Entry Point Roles**:
- `.claude/startup.md` - **Automatic** session initialization (auto-read)
- `CLAUDE.md` - **Router** to choose project docs (you are here)
- `START_HERE.md` - **Onboarding** for new users/contributors
