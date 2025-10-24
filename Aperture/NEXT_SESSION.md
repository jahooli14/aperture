# Next Session - Project Router

> **Purpose**: Quick session startup - choose your project and get context
>
> **Last Updated**: 2025-10-22
>
> **How it works**:
> 1. Check token budget
> 2. Choose which project you're working on
> 3. Load that project's NEXT_SESSION.md for details

---

## 🚦 Quick Start

**Which project are you working on today?**

| Project | Status | Evidence | Next Session File |
|---------|--------|----------|-------------------|
| 👁️ **Pupils** | 🟢 Production | [Live on Vercel](https://aperture-wizard-of-oz.vercel.app), renamed Oct 24, folder: `wizard-of-oz` | [`NEXT_SESSION.md`](projects/wizard-of-oz/NEXT_SESSION.md) |
| 🎨 **Polymath** | 🟢 Production | [Live on Vercel](https://polymath-gfvgwb3qx-daniels-projects-ca7c7923.vercel.app), 23 capabilities, 10 AI suggestions, Gemini-powered | [`NEXT_SESSION.md`](projects/polymath/NEXT_SESSION.md) |
| 🌱 **Baby Milestone Tracker** | 🆕 New (2025-10-22) | Extracted from Polymath, standalone project, 60+ milestones, AI-powered | [`NEXT_SESSION.md`](projects/baby-milestone-tracker/NEXT_SESSION.md) |
| 🎬 **Visual Test Generator** | 📋 Scoped, Not Built | [Use Playwright built-in](projects/visual-test-generator/), see RECOMMENDATION.md | [`NEXT_SESSION.md`](projects/visual-test-generator/NEXT_SESSION.md) |
| 📚 **Autonomous Docs** | 🟢 Active | [Daily cron](https://github.com/jahooli14/aperture/blob/main/.github/workflows/autodoc.yml), runs 09:00 UTC | [`NEXT_SESSION.md`](scripts/autonomous-docs/NEXT_SESSION.md) |

---

## 📊 Last Active

> **Note**: This is just recent history. Next session can work on ANY project - not necessarily the last one!

**Session 24** (2025-10-22): Baby Milestone Tracker - EXTRACTED FROM POLYMATH ✅
- Created standalone project with 60+ milestones
- Full documentation and project template system
- Updated all Aperture documentation

**Session 23** (2025-10-21): Polymath - DEPLOYED TO PRODUCTION ✅ (Gemini-powered, 23 capabilities, 10 AI suggestions)

**Previous Sessions**:
- Session 22: Polymath - Fixed voice processing pipeline + added end-to-end flow verification to process
- Session 21: Polymath - Consolidation complete (MemoryOS → Polymath)
- Session 20: Process improvements (documentation automation)
- Session 19: MemoryOS Build Complete
- Session 18: Session Management Restructure
- Session 17: Wizard of Oz - Editable photo notes

---

## 🔑 Global Resources

### Session Checkpoints

> **Purpose**: Snapshot stable states before major changes for safe experimentation
>
> **When to create**: Before significant features, refactors, or risky changes
>
> **How to use**: Document current working state, then proceed knowing you can rollback

#### How to Create a Checkpoint

**Before starting risky work**:
1. Ensure current state is stable (tests pass, builds work, deployed)
2. Create checkpoint entry in project's NEXT_SESSION.md:
   ```markdown
   ### Checkpoint [N] - [YYYY-MM-DD HH:MM] - [Brief Description]
   **What's working**: [List stable features]
   **About to change**: [What you'll modify]
   **Risk level**: [Low/Medium/High]
   **Rollback**: git log --oneline -10 # Find commit: [commit-hash]
   ```
3. Proceed with changes
4. If successful, mark ✅
5. If failed, use rollback command

---

### Quick Commands

```bash
# Navigate to repo root
cd /Users/dancroome-horgan/Documents/GitHub/Aperture

# Check git status
git status

# Token health check
/token-health

# Infrastructure verification
/verify-infra [project-name]

# Fetch Vercel logs
/vercel-logs [function-name] [limit]
```

---

### Important Documentation

**Entry Points**:
- `CLAUDE.md` - Project type router (NUDJ vs Aperture)
- `.claude/startup.md` - Auto-read session initialization
- `DOCUMENTATION_INDEX.md` - Complete documentation map
- `START_HERE.md` - Onboarding guide
- `PROJECT_IDEAS.md` - New project ideas tracking
- `PROJECT_TEMPLATE.md` - Template for creating new projects

**Process Guides**:
- `.process/META_DEBUGGING_PROTOCOL.md` - Universal debugging
- `.process/CAPABILITIES.md` - Development patterns
- `.process/OBSERVABILITY.md` - Logging & monitoring
- `.process/COMMON_MISTAKES.md` - Anti-patterns to avoid

---

## ⚠️ Before Starting Work

**Mandatory Checks** (from `.claude/startup.md`):
- [ ] Query type classified (debugging, implementation, continuation)
- [ ] Project auto-detected (which NEXT_SESSION.md to read)
- [ ] Project-specific NEXT_SESSION.md reviewed
- [ ] If debugging: Read META_DEBUGGING_PROTOCOL.md first

---

## 🎯 Navigation

**After choosing your project above:**
1. Read that project's `NEXT_SESSION.md` for current status
2. Check project-specific documentation in that folder
3. Use `DOCUMENTATION_INDEX.md` for deeper references

**Common paths**:
- Implementing feature → `.process/CAPABILITIES.md` (Task Signature Pattern)
- Debugging issue → `.process/META_DEBUGGING_PROTOCOL.md`
- Understanding codebase → Launch `Explore` subagent

---

**Token Budget**: This router is ~1.5KB vs previous 18KB monolith (92% reduction)
**Structure**: Each project manages its own session state independently
