# Next Session - Project Router

> **Purpose**: Quick session startup - choose your project and get context
>
> **Last Updated**: 2025-10-20
>
> **How it works**:
> 1. Check token budget
> 2. Choose which project you're working on
> 3. Load that project's NEXT_SESSION.md for details

---

## 🚦 Quick Start

**Which project are you working on today?**

| Project | Status | Next Session File |
|---------|--------|-------------------|
| 🎬 **Visual Test Generator** | 🚀 Week 1 Starting | [`projects/visual-test-generator/NEXT_SESSION.md`](projects/visual-test-generator/NEXT_SESSION.md) |
| 🧙 **Wizard of Oz** | 🟢 Production | [`projects/wizard-of-oz/NEXT_SESSION.md`](projects/wizard-of-oz/NEXT_SESSION.md) |
| 🧠 **MemoryOS** | 🔵 Design Phase | [`projects/memory-os/NEXT_SESSION.md`](projects/memory-os/NEXT_SESSION.md) |
| 📚 **Autonomous Docs** | 🟢 Active | [`scripts/autonomous-docs/NEXT_SESSION.md`](scripts/autonomous-docs/NEXT_SESSION.md) |

---

## 📊 Last Active

**Most Recent**: Wizard of Oz (Session 17 - 2025-10-20)
- Editable photo notes feature shipped
- Memory notes can now be added/edited any time
- See `projects/wizard-of-oz/NEXT_SESSION.md` for details

**Previous**: Visual Test Generator (Session 16 - 2025-10-20)
- Fully documented and ready to build
- See `projects/visual-test-generator/NEXT_SESSION.md` for details

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

**Process Guides**:
- `.process/META_DEBUGGING_PROTOCOL.md` - Universal debugging
- `.process/CAPABILITIES.md` - Development patterns
- `.process/OBSERVABILITY.md` - Logging & monitoring
- `.process/COMMON_MISTAKES.md` - Anti-patterns to avoid

---

## ⚠️ Before Starting Work

**Mandatory Checks** (from `.claude/startup.md`):
- [ ] Token budget < 100K (or note if higher)
- [ ] Project selected (which NEXT_SESSION.md to read)
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
