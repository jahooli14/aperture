# START HERE - Onboarding Guide

> **🧭 You are here**: Onboarding & Reference Guide
>
> **Purpose**: Help new contributors understand the Aperture development process
>
> **Note**: If you're Claude starting a session, `.claude/startup.md` is auto-read and handles initialization. This file is for learning the process, not executing it.

---

## 🎯 Quick Links

**Starting work?** → `.claude/startup.md` auto-reads and handles session initialization
**Continuing work?** → `NEXT_SESSION.md` has current status and tasks
**Debugging?** → `.process/META_DEBUGGING_PROTOCOL.md` (read BEFORE debugging)

---

## 📋 For Users: Starting a New Session

Copy-paste this to start any new Claude session:

```
Read startup.md
```

That's it! Automatic checks will run.

---

## 🤖 For Claude: Session Initialization

**Automatic file**: `.claude/startup.md` (auto-read FIRST every session)

That file handles:
- ✅ Token budget health check
- ✅ Project detection (NUDJ vs Aperture)
- ✅ Reading NEXT_SESSION.md
- ✅ Debugging protocol enforcement
- ✅ Parallel execution policy (Steps 5.5-5.7)
- ✅ Continuous improvement

**Role of this file (START_HERE.md)**: Onboarding and reference only. Not part of automatic startup sequence.

---

## 📚 Reference: Understanding the Process

**Below is reference material for learning the development process**

> **Choose the right path based on your task**

---

## 🚨 CRITICAL: Before Any Debugging

> **📍 Full protocol → `.process/META_DEBUGGING_PROTOCOL.md` (5 min read)**

**If debugging**: Read protocol FIRST, verify inputs before debugging logic. 80% of bugs are input issues.

---

## 🚀 Quick Decision: Which Startup Path?

| Your Task | Files to Read | Time | When to Use |
|-----------|---------------|------|-------------|
| **Continue current work** | NEXT_SESSION.md only | 1 min | You know the project, picking up where you left off |
| **Debugging issue** | META_DEBUGGING_PROTOCOL.md + NEXT_SESSION.md | 6 min | **ALWAYS read protocol first** |
| **Simple bug fix** | NEXT_SESSION.md | 1 min | Quick fix, familiar codebase |
| **New feature (familiar)** | NEXT_SESSION.md + plan.md | 2 min | Know the project, adding to existing code |
| **Unfamiliar/Complex** | Full sequence below | 5 min | First time on project, major architectural work |

**Rule**: Use the simplest path that gives you enough context. Don't over-prepare.

---

## ⚡ True Minimal Startup (30 seconds - 80% of sessions)

**Don't overthink it. Most sessions need < 500 tokens of context.**

```markdown
1. Read NEXT_SESSION.md (1 min) - What's the current status?
2. If debugging → Read META_DEBUGGING_PROTOCOL.md summary (50 lines)
3. Start work

Skip everything else unless your specific task requires it.
```

**That's it.** You now know:
- Current project status
- What was working/broken last session
- Next steps to take
- (If debugging) Input verification mindset

**Only read additional docs if**:
- Building complex feature (> 30 min) → Task Signature pattern
- Modifying infrastructure → Relevant architecture docs
- Unfamiliar with project → Project README

**The navigation system exists to help you find what you need, not to force you to read everything.**

---

## 🏃 Quick Start (1-2 minutes)

**For continuing work or simple fixes**:

1. **Determine project** (10 seconds):
   ```bash
   # Option A: Use automation
   /which-project

   # Option B: Check manually
   # NUDJ if you see: apps/api, apps/admin, pnpm-workspace.yaml
   # APERTURE if you see: projects/wizard-of-oz, .process/
   ```

2. **Read NEXT_SESSION.md** (1 minute):
   - Current status
   - Next steps
   - Any blockers

3. **Start work**:
   - Confirm understanding with user
   - Begin implementing

---

## 🎯 Full Startup (5 minutes)

**For unfamiliar projects or complex work**:

### STEP 1: Determine Which Project (30 seconds - AUTOMATED)

**Option A (Recommended)**: Run `/which-project` command
- Auto-detects NUDJ vs Aperture
- Shows which files to read

**Option B (Manual)**: Check git remote
```bash
git remote -v
# nudj-digital → NUDJ (work)
# aperture/jahooli14 → APERTURE (personal)
```

**Confirm project type**:
```
I am working on [NUDJ/Aperture] based on [git remote/directory structure].
I will read [CLAUDE-NUDJ.md/CLAUDE-APERTURE.md].
```

---

### STEP 2: Read Project-Specific Documentation (2 minutes)

**IF APERTURE** (personal):
- Read `CLAUDE-APERTURE.md`
- Note: Vercel deployment, individual projects

**IF NUDJ** (work):
- Read `CLAUDE-NUDJ.md`
- Note: PNPM monorepo, Turbo

**Confirm understanding**:
```
I have read [CLAUDE-APERTURE/NUDJ].md.
Key facts: [list 2-3 key things]
I will now read NEXT_SESSION.md.
```

---

### STEP 3: Understand Current Status (1 minute)

**Read**: `NEXT_SESSION.md`

**Confirm understanding**:
```
Current status: [brief summary]
Today's task: [what to work on]
Any blockers: [yes/no]
```

---

### STEP 4: Start Working (validate readiness)

**Quick check before starting**:
- ✅ Know which project (NUDJ/Aperture)
- ✅ Know current status
- ✅ Know today's task

**If any unclear**: Ask user before proceeding

---

## 📚 Complete Reading Order (Summary)

**MANDATORY SEQUENCE**:
1. **CLAUDE.md** → Identify project type
2. **CLAUDE-APERTURE.md** OR **CLAUDE-NUDJ.md** → Learn patterns
3. **NEXT_SESSION.md** → Understand current status
4. **Validation checklist** → Confirm readiness
5. **Begin work** → Only after all above complete

**OPTIONAL (as needed)**:
- `.process/SESSION_CHECKLIST.md` - For major tasks
- `projects/[name]/DEPLOYMENT.md` - For deployment tasks
- `.process/COMMON_MISTAKES.md` - To avoid known errors

---

## 📖 Additional Context (Read as Needed)

### Repository Structure (Aperture)

**Repository Structure**:
```
aperture/
├── START_HERE.md           ← You are here
├── NEXT_SESSION.md         ← Read this FIRST
├── SESSION_CHECKLIST.md    ← Session workflow
├── CONTRIBUTING.md         ← How to start new projects
├── .process/               ← Process documentation
│   ├── ARCHITECTURE.md     ← Tech decisions, "Start Minimal" philosophy
│   ├── DEVELOPMENT.md      ← Workflow, Plan Mode, TDD, context management
│   ├── TESTING_GUIDE.md    ← Testing strategy
│   ├── DEPLOYMENT.md       ← CI/CD patterns
│   ├── COMMON_MISTAKES.md  ← Learn from errors
│   ├── DECISION_LOG.md     ← All major decisions (ADRs)
│   └── LESSONS_LEARNED.md  ← Post-project reflections
├── .claude/commands/       ← Slash commands (commit, test, qa, refactor)
├── knowledge-base/         ← Reference materials for context
└── projects/               ← Individual projects
    └── wizard-of-oz/       ← Current project (baby photo alignment app)
        ├── plan.md         ← Project status
        ├── README.md       ← Setup guide
        └── ...
```

### Quick Reference Table

**Where to look for...**

| Need | File |
|------|------|
| **🚨 Debugging anything** | `.process/META_DEBUGGING_PROTOCOL.md` **(READ FIRST!)** |
| **Which project am I on?** | `CLAUDE.md` (router) |
| **Aperture documentation** | `CLAUDE-APERTURE.md` |
| **NUDJ documentation** | `CLAUDE-NUDJ.md` |
| **What to do today** | `NEXT_SESSION.md` |
| **Work more efficiently** | `.claude/startup.md` Steps 5.5-5.7, `.process/BACKGROUND_PROCESSES.md` |
| **Deployment requirements** | `projects/wizard-of-oz/DEPLOYMENT.md` |
| **Mistakes we've made** | `.process/COMMON_MISTAKES.md` |
| **Session workflow** | `.process/SESSION_CHECKLIST.md` |
| **How to start new project** | `CONTRIBUTING.md` |

### Core Philosophies (Aperture Projects)

1. **Start Minimal**: Cost/benefit analysis before adding complexity
   - Example: Testing agent anti-pattern (see `COMMON_MISTAKES.md`)
   - Always ask: "What's the minimum viable implementation?"

2. **Plan First**: Separate thinking from doing
   - Use Plan Mode for non-trivial tasks (see `DEVELOPMENT.md`)
   - Never accept first plan version - iterate

3. **Continuous Improvement**: Learn from every mistake
   - Capture immediately in `COMMON_MISTAKES.md`
   - Detail at session end
   - Update process docs

4. **Context Efficiency**: Fresh context > degraded performance
   - Start new session at 100K+ tokens
   - Don't try to preserve context - trust the docs
   - 5-minute handoff via `NEXT_SESSION.md`

---

## 👤 Instructions for User (Reminder)

### Optimal Opening Messages

**Simple (recommended)**:
```
Read START_HERE.md and continue with the plan.
```

**With specific focus**:
```
Read START_HERE.md. Focus on completing the remaining documentation files listed in NEXT_SESSION.md.
```

**For debugging/questions**:
```
Read START_HERE.md. I need help with [specific issue]. Check projects/wizard-of-oz/plan.md for context.
```

### What NOT to Say

- ❌ "Do you remember..."
- ❌ "As we discussed earlier..."
- ❌ "Last time you said..."
- ❌ Long summaries of previous session

### If Claude Seems Lost

Point to specific files:
- "Check NEXT_SESSION.md for current status"
- "See DECISION_LOG.md for why we chose that"
- "Read ARCHITECTURE.md for the Start Minimal principle"

---

## 🎯 Success Metrics

**Good session start** (< 5 minutes):
- ✅ Claude reads START_HERE.md + NEXT_SESSION.md
- ✅ Claude confirms understanding of current task
- ✅ Work begins on documented next steps

**Bad session start** (avoid):
- ❌ User tries to summarize previous session
- ❌ Claude asks "what should I work on?"
- ❌ No clear direction (means NEXT_SESSION.md needs update)

---

## ⚠️ Common Startup Mistakes to Avoid

**❌ DON'T**:
- Skip reading CLAUDE.md (you won't know which project you're on)
- Read only NEXT_SESSION.md without project context
- Start coding before completing the validation checklist
- Assume you know the project type without checking
- Mix Nudj and Aperture patterns

**✅ DO**:
- Follow the 5-step sequence exactly as written
- Explicitly confirm each step before proceeding
- State your understanding before starting work
- Ask if unclear which project you're on
- Use the validation checklist every time

---

## 📖 Need an Example?

**See `STARTUP_EXAMPLE.md`** for a complete example of a correct session startup.

This shows:
- ✅ What Claude should say at each step
- ❌ Common mistakes and anti-patterns
- 🎯 How users can validate Claude followed the process

---

**Last Updated**: 2025-10-10
**Purpose**: Foolproof session handoffs with mandatory startup sequence
**Next Review**: After next session (validate if this works)
