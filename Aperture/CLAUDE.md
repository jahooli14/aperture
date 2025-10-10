# 🚦 CLAUDE.md - Project Router

> **⚠️ CRITICAL: READ THIS FIRST**
>
> This directory is used for BOTH work and personal projects.
> You MUST choose the correct documentation file.

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

This includes:
- Wizard of Oz (baby photo app)
- Personal experiments and prototypes
- Individual Vercel deployments
- Supabase backends

---

## How to Tell Which Project You're On

### Check the User's Request
- **Work keywords**: Nudj, admin app, user app, API, MongoDB, gamification, challenges, rewards
- **Personal keywords**: Aperture, wizard-of-oz, baby photos, Supabase

### Check Current Directory
```bash
# If you see these directories → NUDJ (work)
apps/api/, apps/admin/, apps/user/, packages/database/

# If you see these directories → Aperture (personal)
projects/wizard-of-oz/
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

## Quick Decision Tree

```
Is the user asking about:
├─ Nudj platform, admin interface, gamification?
│  └─ Use CLAUDE-NUDJ.md
│
├─ Wizard of Oz, baby photos, Aperture?
│  └─ Use CLAUDE-APERTURE.md
│
└─ Not sure?
   └─ Ask the user which project they're working on
```

---

## Important Notes

1. **Never mix documentation** - NUDJ and Aperture have completely different structures
2. **Always confirm** - If unclear, ask the user before proceeding
3. **Read the right file** - Using wrong docs will cause confusion and errors

---

## Files at a Glance

| File | Purpose | Use When |
|------|---------|----------|
| `CLAUDE-NUDJ.md` | Work projects documentation | Working on Nudj monorepo |
| `CLAUDE-APERTURE.md` | Personal projects documentation | Working on Aperture projects |
| `START_HERE.md` | Session startup (Aperture-specific) | Starting new Aperture session |
| `NEXT_SESSION.md` | Current status (Aperture-specific) | Continuing Aperture work |

---

**🎯 Action Required**: Read the appropriate CLAUDE file based on the project context.
