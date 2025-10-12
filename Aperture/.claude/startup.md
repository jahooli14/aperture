# Claude Startup Automation

**Purpose**: This file is automatically read by Claude Code at the start of EVERY session.

**Effect**: Enforces critical checks without user having to remember.

---

## 🚨 AUTOMATIC SESSION STARTUP SEQUENCE

### Step 1: Token Budget Check (MANDATORY)

**Current token usage**: [Claude will report this]

**Health Assessment**:
- ✅ **< 50K tokens**: Healthy - proceed normally
- ⚠️ **50-100K tokens**: Warning - can you finish current task in < 50K more?
  - If NO → Update NEXT_SESSION.md and start fresh session
- 🛑 **> 100K tokens**: CRITICAL - STOP
  - DO NOT start new work
  - Update NEXT_SESSION.md
  - Close session and start fresh

**Action Required**: Acknowledge token health status before proceeding.

---

### Step 2: Project Detection (AUTOMATIC)

**Checking git remote and directory structure...**

**Detection logic**:
```bash
# Git remote check
git remote -v
# If contains "nudj-digital" → NUDJ (work)
# If contains "aperture" → APERTURE (personal)

# Directory structure check
# NUDJ: apps/api, apps/admin, pnpm-workspace.yaml
# APERTURE: projects/wizard-of-oz, .process/
```

**Action Required**: Confirm project type and state which CLAUDE.md to follow.

---

### Step 3: Read Current Status (MANDATORY)

**YOU MUST READ**: `NEXT_SESSION.md`

**This file contains**:
- What was completed last session
- What to work on today
- Critical context and blockers
- Infrastructure status

**Action Required**: After reading, state:
```
Current status: [brief summary]
Today's task: [what to work on]
Any blockers: [yes/no]
```

---

### Step 4: Debugging Protocol (IF DEBUGGING)

**If user mentions**: "doesn't work", "broken", "failing", "error", "bug"

**🚨 MANDATORY - Follow this exact sequence**:

1. **FIRST**: Read `META_DEBUGGING_PROTOCOL.md` (5 min)
   - Universal debugging principles
   - Input verification checklist
   - 80% of bugs are input issues

2. **SECOND**: Check infrastructure
   ```
   /verify-infra [project-name]
   ```
   - Catches environment/setup issues
   - Database, storage, env vars

3. **THIRD**: Verify inputs before debugging algorithm
   - See META_DEBUGGING_PROTOCOL.md for checklist
   - Log what you RECEIVE vs what you EXPECT
   - If mismatch → fix input, not algorithm

4. **ONLY THEN**: Debug the algorithm/logic

**Why this order?**
- Meta protocol: Prevents wasting 90+ minutes debugging wrong thing
- Infrastructure check: Catches 80% of deployment issues
- Input verification: Catches 80% of logic issues
- **Together: Saves hours of debugging time**

**Common issues caught by protocol**:
- Input format mismatches (dimensions, units, scaling)
- Database tables don't exist
- Storage buckets missing
- Environment variables not set
- Vercel Deployment Protection enabled (blocks server-to-server calls)

---

### Step 5: Validation Before Starting Work

**Confirm you have**:
- ✅ Token budget status (and it's acceptable to continue)
- ✅ Project type identified (NUDJ or Aperture)
- ✅ Current status from NEXT_SESSION.md
- ✅ Today's task is clear

**If ANY is unclear**: Ask user before proceeding.

---

## 🔄 Continuous Improvement Enforcement

### When You Make a Mistake

**STOP - Before continuing**:

1. **Identify root cause** (not symptom):
   ```
   Symptom: "Code didn't work"
   Root cause: "Infrastructure check wasn't run before debugging"

   Fix: Add infrastructure check to automatic startup sequence
   ```

2. **Fix process, not just code**:
   - If you forgot to check something → Add to this file
   - If documentation was unclear → Update the doc
   - If you repeated a mistake → Create automation

3. **Update COMMON_MISTAKES.md immediately**:
   ```markdown
   ## [Date] | [Category] | [Title]
   **What Happened**: [One sentence]
   **Root Cause**: [The actual reason, not symptom]
   **Process Fix**: [How we prevent this permanently]
   ```

4. **Propose automation**:
   ```
   "This mistake happened because [manual step].
   We should automate this by [specific solution].
   Shall I implement that now?"
   ```

### Red Flags That Need Process Fixes

**If you hear yourself saying**:
- "Remember to..." → Should be automated
- "Don't forget to..." → Should be enforced
- "Make sure you..." → Should be checked automatically
- "We did this before..." → Should be documented/automated

**Action**: Stop and propose process improvement before continuing.

---

## 🚫 Anti-Patterns to Catch

### Symptom Fixing (BAD)
```
User: "Upload doesn't work"
You: [Debug code for 2 hours]
Result: Bucket didn't exist
```

### Root Cause Fixing (GOOD)
```
User: "Upload doesn't work"
You: "Let's run /verify-infra first - checks if buckets exist"
Result: Bucket missing, created in 2 minutes
```

### Repeating Mistakes (BAD)
```
Session 1: Forgot to check token budget → hit 120K
Session 2: Forgot to check token budget → hit 120K
Session 3: Forgot to check token budget → hit 120K
```

### Learning from Mistakes (GOOD)
```
Session 1: Forgot to check token budget → hit 120K
Fix: Added token check to automatic startup (this file)
Session 2+: Token check happens automatically
```

---

## 📋 Enforcement Checklist

**At start of EVERY session**, you must:

- [ ] Report token budget status (< 50K / 50-100K / > 100K)
- [ ] Identify project (NUDJ or Aperture) and state which CLAUDE.md to follow
- [ ] Read NEXT_SESSION.md and confirm current status
- [ ] If user reports "doesn't work" → suggest /verify-infra BEFORE debugging

**If you skip any step**: User should remind you to read this file.

---

## 🔧 How to Update This File

**When you discover a repeated mistake**:

1. Add to this file (automated enforcement)
2. Update relevant process docs (documentation)
3. Create automation if possible (tools/commands)
4. Update COMMON_MISTAKES.md (learning)

**Example**:
```
Mistake: Forgot to check if tests pass before committing
Fix: Add to this file → "Before committing, YOU MUST: npm run test"
Better: Add git pre-commit hook that runs tests automatically
```

---

## 🎯 Success Criteria

**This file is working when**:
- ✅ Token budget never exceeds 100K (caught automatically)
- ✅ Infrastructure issues caught in < 5 min (suggested automatically)
- ✅ Same mistake never happens 3+ times (process fixed after 2nd occurrence)
- ✅ New automations added when patterns emerge

**This file is failing when**:
- ❌ Token budget regularly exceeds 100K
- ❌ Debugging code for > 30 min before checking infrastructure
- ❌ Same mistake happens repeatedly
- ❌ Manual steps that should be automated

---

**Note to Claude**: This file overrides SESSION_CHECKLIST.md for startup. This is the authoritative startup sequence. If there's a conflict between this file and other docs, THIS FILE WINS.

**Note to User**: If Claude doesn't follow this sequence, say: "Read startup.md"
