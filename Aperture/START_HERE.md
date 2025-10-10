# START HERE - New Session Guide

> **For Users**: Copy-paste the message below to start any new Claude session
>
> **For Claude**: This is your entry point. Read this first, then follow the instructions.

---

## 📋 Copy-Paste This to Start New Session

```
Read START_HERE.md and continue with the plan.
```

That's it! Everything else is documented.

---

## 🤖 Instructions for Claude (New Session)

### Step 1: Understand the Context (2 minutes)

You are working on **Aperture** - a multi-project development framework with continuous improvement processes.

**Read these files IN ORDER**:

1. **`NEXT_SESSION.md`** (MOST IMPORTANT - read this FIRST)
   - Current status
   - Immediate next steps
   - What to work on today
   - Key context and decisions

2. **`SESSION_CHECKLIST.md`** (if starting a major task)
   - Session workflow
   - How to capture mistakes
   - When to update docs

3. **Relevant project `plan.md`** (if working on a specific project)
   - Location: `projects/[project-name]/plan.md`
   - Current project state
   - What's completed vs pending

### Step 2: Quick Orientation (30 seconds)

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

### Step 3: Find Information Fast

**Where to look for...**

| Need | File |
|------|------|
| **What to do today** | `NEXT_SESSION.md` |
| **Project status** | `projects/[name]/plan.md` |
| **Why we made a decision** | `.process/DECISION_LOG.md` or `projects/[name]/decisions.md` |
| **Mistakes we've made** | `.process/COMMON_MISTAKES.md` |
| **How to work (workflow)** | `.process/DEVELOPMENT.md` |
| **Architecture principles** | `.process/ARCHITECTURE.md` |
| **Testing patterns** | `.process/TESTING_GUIDE.md` |
| **Deployment process** | `.process/DEPLOYMENT.md` |
| **Session workflow** | `SESSION_CHECKLIST.md` |
| **How to start new project** | `CONTRIBUTING.md` |

### Step 4: Core Philosophies (Remember These)

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

### Step 5: Start Working

Based on `NEXT_SESSION.md`:
- Confirm what you'll work on
- Ask clarifying questions if needed (Socratic method)
- Use Plan Mode for non-trivial tasks
- Update relevant files as you go

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

## 📝 File Hierarchy (Quick Reference)

**Always start with**:
1. `START_HERE.md` (you are here)
2. `NEXT_SESSION.md` (what's happening now)

**Then consult as needed**:
- `.process/` - How we work
- `projects/[name]/` - Specific project state
- `SESSION_CHECKLIST.md` - Session workflow

**Don't read everything** - be targeted based on current task.

---

**Last Updated**: 2025-10-10
**Purpose**: Foolproof session handoffs
**Next Review**: After next session (validate if this works)
