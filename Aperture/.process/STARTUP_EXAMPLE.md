# Session Startup Example - Reference for Claude

> **Purpose**: This file shows EXACTLY what a correct session startup looks like.
> Claude should follow this pattern at the start of EVERY session.

---

## ✅ Example: Correct Startup Sequence

### User Opens New Session

**User message**:
```
Read START_HERE.md and continue with the plan.
```

### Claude's Response (Step-by-Step)

**STEP 1: Identify Project**

```
I've read START_HERE.md. Following the mandatory startup sequence.

STEP 1: Reading CLAUDE.md to identify the project...

[Reads CLAUDE.md]

I am working on **Aperture (personal projects)** based on:
- Repository is github.com/jahooli14/aperture
- Directory structure shows projects/wizard-of-oz/
- No apps/, packages/ directories (not Nudj monorepo)

I will now read CLAUDE-APERTURE.md.
```

**STEP 2: Learn Project Patterns**

```
[Reads CLAUDE-APERTURE.md]

I have read CLAUDE-APERTURE.md.

Key facts:
1. This is a personal projects repository with individual Vercel deployments
2. Current project: wizard-of-oz (baby photo alignment app with Supabase)
3. CRITICAL: All changes must be pushed to main branch for Vercel auto-deployment

I will now read NEXT_SESSION.md.
```

**STEP 3: Understand Current Status**

```
[Reads NEXT_SESSION.md]

Current status: Calendar view and photo upload fixes completed in last session.
Wizard of Oz app is live and deployed.

Today's task: Based on NEXT_SESSION.md, I should work on enhancing the
wizard-of-oz app or start a new project. Awaiting user direction on which
feature to prioritize.

Any blockers: No blockers. All recent changes successfully deployed.
```

**STEP 4: Validation Checklist**

```
Validation checklist:
✅ I read CLAUDE.md and identified the project type (Aperture)
✅ I read CLAUDE-APERTURE.md for project-specific patterns
✅ I read NEXT_SESSION.md and understand current status
✅ I know the wizard-of-oz project structure and deployment requirements
✅ I understand Vercel deployment requirement (push to main)

Ready to begin work.
```

**STEP 5: Confirm with User**

```
I'm ready to continue with the Aperture wizard-of-oz project.

Based on NEXT_SESSION.md, possible next steps include:
- Video timelapse generation
- Daily reminder system
- Analytics dashboard
- Smile/milestone detection

Which feature would you like to work on?
```

---

## ❌ Example: Incorrect Startup (What NOT to Do)

### Anti-Pattern 1: Skipping Project Identification

**User message**:
```
Read START_HERE.md and continue with the plan.
```

**❌ BAD Claude Response**:
```
I've read NEXT_SESSION.md. I see we're working on calendar view and photo uploads.
Let me start implementing...
```

**Why bad**:
- Didn't read CLAUDE.md to identify project
- Didn't read project-specific docs
- Might use wrong patterns (Nudj vs Aperture)

---

### Anti-Pattern 2: Reading Wrong Order

**❌ BAD Claude Response**:
```
I'll read NEXT_SESSION.md first to see what we're working on...
[Reads NEXT_SESSION.md]

Looks like wizard-of-oz project. Let me read CLAUDE-APERTURE.md...
```

**Why bad**:
- Reversed the order (should read CLAUDE.md → CLAUDE-APERTURE.md → NEXT_SESSION.md)
- Might miss critical project context
- Inefficient reading pattern

---

### Anti-Pattern 3: No Explicit Confirmation

**❌ BAD Claude Response**:
```
I've read the files. What would you like me to work on?
```

**Why bad**:
- Didn't explicitly confirm which files were read
- Didn't state understanding of project type
- Didn't complete validation checklist
- Unclear if actually read everything

---

## 🎯 Key Success Indicators

**After reading START_HERE.md, Claude should**:

1. ✅ **Explicitly state** reading CLAUDE.md
2. ✅ **Identify project type** with reasoning (Aperture/Nudj)
3. ✅ **Read correct project docs** (CLAUDE-APERTURE or CLAUDE-NUDJ)
4. ✅ **List 3 key facts** from project docs
5. ✅ **Read NEXT_SESSION.md** and summarize status
6. ✅ **Complete validation checklist** with all checkboxes
7. ✅ **Confirm readiness** before starting work

**User should see clear progression**:
- "Reading CLAUDE.md..."
- "I am working on [project] because..."
- "Reading CLAUDE-[X].md..."
- "Key facts: 1, 2, 3..."
- "Reading NEXT_SESSION.md..."
- "Current status: ..."
- "Validation: ✅ ✅ ✅ ✅ ✅"
- "Ready to begin. Which feature?"

---

## 📋 Quick Validation for Users

**How to tell if Claude did it correctly**:

✅ **Good signs**:
- Claude explicitly mentions reading CLAUDE.md first
- Claude states which project type (Aperture/Nudj)
- Claude lists key facts from project docs
- Claude completes validation checklist
- Claude confirms understanding before starting

❌ **Red flags**:
- Claude jumps straight to NEXT_SESSION.md
- Claude doesn't mention project type
- Claude asks "what should I work on?" without context
- Claude starts coding without validation
- No mention of CLAUDE.md or project docs

**If you see red flags**: Say "Please follow the startup sequence in START_HERE.md"

---

## 🔄 What This Prevents

This rigorous startup sequence prevents:

1. **Wrong Project Context**: Claude using Nudj patterns on Aperture (or vice versa)
2. **Missing Critical Info**: Skipping deployment requirements (e.g., Vercel main branch)
3. **Inefficient Work**: Starting without understanding current status
4. **Pattern Mixing**: Applying PNPM workspace patterns to standalone projects
5. **Deployment Errors**: Not knowing push-to-main requirement

---

**Last Updated**: 2025-10-10
**Purpose**: Reference example for foolproof session starts
**For**: Both users (to validate) and Claude (to emulate)
