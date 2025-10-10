# START HERE - New Session Guide

> **For Users**: Copy-paste the message below to start any new Claude session
>
> **For Claude**: This is your entry point. **YOU MUST FOLLOW THIS EXACT SEQUENCE.**

---

## 📋 Copy-Paste This to Start New Session

```
Read START_HERE.md and continue with the plan.
```

That's it! Everything else is documented.

---

## 🤖 MANDATORY STARTUP SEQUENCE FOR CLAUDE

> **⚠️ CRITICAL**: Follow these steps **IN EXACT ORDER**. Do not skip any step.

### STEP 1: Determine Which Project (30 seconds)

**YOU MUST READ THIS FILE FIRST**: `CLAUDE.md`

This file is a router that tells you whether you're working on:
- 🏢 **NUDJ (work)** - Monorepo with PNPM, Turbo, MongoDB
- 🏠 **Aperture (personal)** - Individual projects with Vercel

**ACTION REQUIRED**: After reading `CLAUDE.md`, you must explicitly state:
```
I am working on [NUDJ/Aperture] based on [reason from CLAUDE.md].
I will now read [CLAUDE-NUDJ.md/CLAUDE-APERTURE.md].
```

**⛔ DO NOT PROCEED** until you've read `CLAUDE.md` and identified the project.

---

### STEP 2: Read Project-Specific Documentation (2 minutes)

**IF APERTURE** (personal projects):
1. Read `CLAUDE-APERTURE.md` in full
2. Note the current projects (wizard-of-oz)
3. Understand Vercel deployment requirements

**IF NUDJ** (work projects):
1. Read `CLAUDE-NUDJ.md` in full
2. Note the monorepo structure
3. Understand PNPM workspace patterns

**ACTION REQUIRED**: After reading, you must state:
```
I have read [CLAUDE-APERTURE/NUDJ].md.
Key facts: [list 3 key things about this project type]
I will now read NEXT_SESSION.md.
```

**⛔ DO NOT PROCEED** until you've read and acknowledged the project docs.

---

### STEP 3: Understand Current Status (1 minute)

**YOU MUST READ**: `NEXT_SESSION.md`

This file contains:
- What was completed in the last session
- What you should work on today
- Critical context and decisions

**ACTION REQUIRED**: After reading, you must state:
```
Current status: [brief summary]
Today's task: [what you'll work on]
Any blockers: [yes/no, if yes explain]
```

**⛔ DO NOT START WORK** until you've confirmed you understand the current status.

---

### STEP 4: Validation Checklist

Before you start working, **YOU MUST CONFIRM**:

```
✅ I read CLAUDE.md and identified the project type
✅ I read [CLAUDE-APERTURE/NUDJ].md for project-specific patterns
✅ I read NEXT_SESSION.md and understand current status
✅ I know what task to work on today
✅ I understand any deployment requirements (Vercel/other)
```

**IF ANY CHECKBOX IS UNCHECKED**: Go back and read the missing file.

---

### STEP 5: Start Working

Only after completing Steps 1-4, you may:
- Confirm the task with the user
- Ask clarifying questions
- Begin work using appropriate patterns

---

## 📚 Complete Reading Order (Summary)

**MANDATORY SEQUENCE**:
1. **CLAUDE.md** → Identify project type
2. **CLAUDE-APERTURE.md** OR **CLAUDE-NUDJ.md** → Learn patterns
3. **NEXT_SESSION.md** → Understand current status
4. **Validation checklist** → Confirm readiness
5. **Begin work** → Only after all above complete

**OPTIONAL (as needed)**:
- `SESSION_CHECKLIST.md` - For major tasks
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
| **Which project am I on?** | `CLAUDE.md` (router) |
| **Aperture documentation** | `CLAUDE-APERTURE.md` |
| **NUDJ documentation** | `CLAUDE-NUDJ.md` |
| **What to do today** | `NEXT_SESSION.md` |
| **Deployment requirements** | `projects/wizard-of-oz/DEPLOYMENT.md` |
| **Mistakes we've made** | `.process/COMMON_MISTAKES.md` |
| **Session workflow** | `SESSION_CHECKLIST.md` |
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
