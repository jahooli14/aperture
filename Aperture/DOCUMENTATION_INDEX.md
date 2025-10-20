# Documentation Index - "Choose Your Own Adventure"

> **🧭 You are here**: Complete map of all Aperture documentation
>
> **Purpose**: Find the right doc for your current situation
>
> **Last Updated**: 2025-10-20 (Post-restructuring)

---

## 🚀 Quick Start (By Intent)

### "I'm starting a new session"
→ `.claude/startup.md` (auto-read) handles initialization
→ Then read `NEXT_SESSION.md` for current status

### "I'm continuing work"
→ `NEXT_SESSION.md` - Current tasks and next steps

### "Something's broken (debugging)"
→ `.process/META_DEBUGGING_PROTOCOL.md` - Read BEFORE debugging (mandatory)
→ Then `projects/[name]/DEBUGGING.md` - Project-specific tips

### "I'm starting a new feature"
→ `.process/DEVELOPMENT.md` - Plan Mode workflow
→ `.process/ARCHITECTURE.md` - Start Minimal philosophy

### "I need to understand the process"
→ `START_HERE.md` - Onboarding guide (reference)
→ `.process/SESSION_CHECKLIST.md` - Session workflow

### "I made a mistake"
→ `.process/COMMON_MISTAKES.md` - Add entry immediately
→ `.process/CONTINUOUS_IMPROVEMENT.md` - Fix root cause

### "I'm deploying"
→ `.process/DEPLOYMENT.md` - Deployment strategies
→ `.process/OBSERVABILITY.md` - Logging for monitoring
→ `.process/PROACTIVE_LOG_MONITORING.md` - Check logs after deploy

### "I want to check production health"
→ `.process/PROACTIVE_LOG_MONITORING.md` - Log review process
→ `.claude/startup.md` Step 4.5 - Quick health check commands

### "I want to work more efficiently"
→ `.claude/startup.md` Steps 5.5-5.7 - Parallel execution, subagents, checkpoints
→ `.process/BACKGROUND_PROCESSES.md` - Background process patterns
→ `CLAUDE-APERTURE.md` Communication Patterns - Transparent execution

---

## 📚 Complete File Inventory

### Entry Points (Start Here)

| File | Purpose | When to Use |
|------|---------|-------------|
| `README.md` | **PROJECT OVERVIEW** | First-time visitors, GitHub landing |
| `.claude/startup.md` | **AUTOMATIC** session init (thin orchestrator) | Auto-read every session |
| `CLAUDE.md` | **ROUTER** for project type | Choose NUDJ vs Aperture |
| `START_HERE.md` | **ONBOARDING** guide | Learning the process |
| `NEXT_SESSION.md` | **CURRENT STATUS** | Continuing work |
| `NAVIGATION.md` | **TASK INDEX** | Find docs by task type |
| `DOCUMENTATION_INDEX.md` | **COMPLETE MAP** | You are here |

**Navigation tip**: These have distinct roles - no confusion about authority

---

### Core Workflow Docs

| File | Purpose | Key Sections |
|------|---------|--------------|
| `.process/SESSION_CHECKLIST.md` | Session workflow | Start/During/End checklists |
| `.process/DEVELOPMENT.md` | Development workflow | Plan Mode, TDD, Git workflow |
| `CLAUDE-APERTURE.md` | Project conventions | Code style, patterns, structure |
| `.process/CAPABILITIES.md` | Patterns library | Task Signature, Loop Safeguards, etc. |

---

### Debugging & Quality

| File | Purpose | When to Use |
|------|---------|-------------|
| `.process/META_DEBUGGING_PROTOCOL.md` | Universal debugging principles | BEFORE debugging anything |
| `.process/DEBUGGING_CHECKLIST.md` | Case study (coordinate scaling) | Dimension/scaling bugs |
| `projects/wizard-of-oz/DEBUGGING.md` | Project-specific debugging | Wizard of Oz issues |
| `.process/OBSERVABILITY.md` | Logging & self-sufficient debugging | Adding features, monitoring |
| `.process/PROACTIVE_LOG_MONITORING.md` | Production log review process | Session start, after deployment |
| `.process/TESTING_GUIDE.md` | Testing strategy | Writing tests, test patterns |

---

### Process & Learning

| File | Purpose | When to Use |
|------|---------|-------------|
| `.process/COMMON_MISTAKES.md` | Tactical mistake log | After making mistake (capture immediately) |
| `.process/CONTINUOUS_IMPROVEMENT.md` | Root cause analysis framework | After 2+ occurrences of same mistake |
| `.process/LESSONS_LEARNED.md` | Strategic project retrospectives | After completing project/milestone |
| `.process/BACKGROUND_PROCESSES.md` | Background process management | Running long operations without blocking |

---

### Architecture & Decisions

| File | Purpose | When to Use |
|------|---------|-------------|
| `.process/ARCHITECTURE.md` | Start Minimal philosophy | Making architectural decisions |
| `.process/DECISION_LOG.md` | ADR repository | Documenting major decisions |
| `.process/DEPLOYMENT.md` | Deployment strategies | Deploying to production |

---

### Meta Documentation

| File | Purpose | Status |
|------|---------|--------|
| `.process/DOCUMENTATION_AUDIT.md` | Full audit findings | Reference (completed) |
| `.process/PHASE_1_COMPLETE.md` | Phase 1 results | Reference (completed) |
| `.process/CONTEXT_ENGINEERING_ANALYSIS.md` | Context eng. comparison | Reference (implemented) |
| `.process/CONTEXT_ENGINEERING_SUMMARY.md` | Context eng. summary | Reference (implemented) |

---

## 🗺️ Navigation Patterns

### Every Doc Now Has

```markdown
## 🧭 Navigation

**Where to go next**:
- If [condition] → [FILE] ([why])

**Related documentation**:
- [FILE] - [What it covers]

**Referenced by**:
- [FILE:line] - [Context]
```

This creates a "choose your own adventure" experience where you always know:
1. **Where you are** ("You are here")
2. **Why you're here** (Purpose statement)
3. **Where to go next** (Based on your intent)

---

## 🎯 Decision Trees

### "I'm debugging"
```
START: Something's broken
│
├─ Read META_DEBUGGING_PROTOCOL.md (5 min)
│  └─ Verify inputs FIRST
│
├─ Run /verify-infra [project]
│  └─ Check infrastructure
│
├─ Check .process/OBSERVABILITY.md
│  └─ Read logs with /vercel-logs
│
└─ Check projects/[name]/DEBUGGING.md
   └─ Project-specific tips
```

### "I'm starting work"
```
START: Beginning session
│
├─ .claude/startup.md (auto-read)
│  └─ Token budget check
│  └─ Project detection
│  └─ Read NEXT_SESSION.md
│
└─ NEXT_SESSION.md
   └─ Current tasks
   └─ Implementation notes
   └─ Verification steps
```

### "I made a mistake"
```
START: Mistake happened
│
├─ .process/COMMON_MISTAKES.md
│  └─ Add entry IMMEDIATELY
│
├─ Is this 2nd+ occurrence?
│  ├─ YES → .process/CONTINUOUS_IMPROVEMENT.md
│  │        └─ Fix root cause
│  │        └─ Build automation
│  │
│  └─ NO → Fix code, move on
│
└─ End of session
   └─ Detail the mistake
   └─ Update process docs
```

---

## 📊 File Statistics (Post-Restructuring 2025-10-20)

| Category | Count | Location | Notes |
|----------|-------|----------|-------|
| **Root navigation** | 8 | `/` | Core entry points (56% reduction from 18) |
| **Process docs** | 16 | `.process/` | Methodology & patterns |
| **Research docs** | 4 | `research/` | Frontier research (NEW) |
| **Project docs** | 4 projects | `projects/` | Individual project documentation |
| **Meta infrastructure** | 1 | `scripts/autonomous-docs/` | Self-optimizing docs |
| **Claude Code config** | ~25 | `.claude/` | Commands, skills, startup |

**Key improvements**:
- ✅ Root reduced from 18 to 8 files (56% reduction)
- ✅ startup.md reduced from 995 to 261 lines (74% reduction)
- ✅ Estimated startup token cost: 1000 tokens (down from 5000, 80% reduction)
- ✅ Clear hierarchy: Root → .process/ → research/
- ✅ Removed duplicates (CHEATSHEET merged into QUICK_REFERENCE)
- ✅ Archived historical files (.archive/, .dev/ removed)

---

## 🔬 Research Directory (NEW)

| File | Purpose | Status |
|------|---------|--------|
| `research/FRONTIER_OPPORTUNITIES_2025.md` | 2025 frontier AI features & opportunities | Active research |
| `research/INSTANT_VISUAL_TEST_GENERATOR_RESEARCH.md` | AI visual test generation research | Active - Week 1 project |
| `research/GOOGLE_CLOUD_PATTERNS_ANALYSIS.md` | Google Cloud agentic patterns analysis | Reference |
| `research/GEMINI_MIGRATION_CHANGES.md` | Claude → Gemini migration notes | Reference |

**Purpose**: Frontier research documents separated from active process docs for clarity

---

## ✅ Validation Checklist

### Navigation Test
- [x] Every active file has "You are here" section
- [x] Every active file has "Where to go next" section
- [x] Entry points have clear distinct roles
- [x] No circular references without escape routes

### Redundancy Test
- [x] Token budget: ONE source only (.claude/startup.md)
- [x] Current status: ONE source only (NEXT_SESSION.md)
- [x] Debugging protocol: ONE source only (.process/META_DEBUGGING_PROTOCOL.md)
- [x] Observability: ONE source only (.process/OBSERVABILITY.md)
- [x] Quick reference: ONE source only (.process/QUICK_REFERENCE.md - CHEATSHEET removed)

### Discoverability Test
- [x] All active files reachable from this index
- [x] Intent-based routing exists (by scenario)
- [x] Decision trees provided for common workflows
- [x] Orphaned files identified for archival

---

## 🔄 Maintenance

### When Adding New Documentation
1. Add entry to this index
2. Add "🧭 Navigation" section to new file
3. Update related files' "Related documentation" lists
4. Test that file is reachable from at least 2 paths

### When Updating Documentation
1. Update "Last Updated" date in file
2. Update this index if purpose changes
3. Check if navigation needs updating

### Quarterly Review
- Review orphaned files (can they be archived?)
- Check if navigation is still accurate
- Update decision trees based on common patterns
- Consolidate if redundancy creeps back in

---

## 🎓 Key Principles Applied

1. **"Choose Your Own Adventure"** - Intent-based routing throughout
2. **Start Minimal** - 21 active docs (down from 31)
3. **Single Source of Truth** - No redundancy
4. **Clear Authority** - Distinct roles for entry points
5. **Bidirectional Links** - Files know who references them

---

**Last Updated**: 2025-10-13
**Maintained by**: Update when documentation structure changes
**See Also**: `.process/DOCUMENTATION_AUDIT.md` for full analysis
