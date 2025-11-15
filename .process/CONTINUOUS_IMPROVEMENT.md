# Continuous Improvement Framework

> **Core Principle**: Fix root causes once, not symptoms many times.

> **🧭 You are here**: Root cause analysis and mistake prevention framework
>
> **Purpose**: Turn repeated mistakes into automated solutions
>
> **Last Updated**: 2025-10-13

---

## 🧭 Navigation

**Where to go next**:
- If mistake just happened → See "When Any Mistake Happens" section (capture immediately)
- If same mistake happened 2+ times → See "Process Fix Decision Tree" (build automation)
- If analyzing mistake at session end → Use "Root Cause Analysis Template" (Five Whys)
- If planning next session → Check `.process/COMMON_MISTAKES.md` (learn from past)
- If quarterly review time → See "Quarterly Process Audit" section

**Related documentation**:
- `.process/COMMON_MISTAKES.md` - Log of all mistakes (capture here first)
- `.claude/startup.md` - Automated enforcement of learned lessons
- `SESSION_CHECKLIST.md` - Manual workflow checks (non-automatic)
- `.process/ARCHITECTURE.md` - "Start Minimal" philosophy context
- `.process/LESSONS_LEARNED.md` - Big-picture project reflections

**Referenced by**:
- `.process/COMMON_MISTAKES.md` - Uses this framework for categorization
- `.process/TESTING_GUIDE.md` - Apply improvement cycle to test failures
- `.process/DEPLOYMENT.md` - Improve deployment reliability over time

---

## 🎯 The Problem

**Symptom fixing**:
```
Mistake → Fix code → Move on
Mistake → Fix code → Move on
Mistake → Fix code → Move on  [← Same mistake, 3rd time]
```

**Root cause fixing**:
```
Mistake → Analyze root cause → Fix process → Automate → Never happens again
```

---

## 📊 Three Types of Mistakes

### Type 1: One-Time Errors (Accept)
**Example**: Typo in variable name, forgot semicolon
**Response**: Fix and move on
**Process change**: None needed

### Type 2: Process Failures (Fix Process)
**Example**: Forgot to check if infrastructure exists before debugging
**Response**:
1. Fix immediate issue
2. **Add to automated checks**
3. Update documentation
4. Add to COMMON_MISTAKES.md

### Type 3: Repeated Patterns (Automate)
**Example**: Same type of error happens 3+ times
**Response**:
1. Stop work
2. Analyze pattern
3. **Build automation**
4. Integrate into workflow
5. Document in COMMON_MISTAKES.md

---

## 🔄 The Improvement Cycle

### When Any Mistake Happens

**STEP 1: Immediate - Capture (30 seconds)**
```markdown
## [Date] | [Category] | [Title]
**What Happened**: [One sentence]
**Next**: Analyze at session end
```
→ Add to `.process/COMMON_MISTAKES.md`

**STEP 2: Session End - Analyze (5 minutes)**
```markdown
**Root Cause**: [The actual reason, not symptom]
**Is this Type 1, 2, or 3?**
- Type 1 → Document and move on
- Type 2 → Fix process (add checks, update docs)
- Type 3 → Build automation
```

**STEP 3: Next Session - Implement (variable)**
- Type 2: Update relevant docs, add to startup checks
- Type 3: Build tool/command/hook, integrate into workflow

---

## 🚨 Root Cause Analysis Template

### The Five Whys

**Symptom**: Upload doesn't work

**Why 1**: Supabase storage upload failed
**Why 2**: Bucket doesn't exist
**Why 3**: We didn't check if bucket exists before deploying
**Why 4**: No infrastructure verification in our process
**Why 5**: We debug code first, infrastructure second

**Root Cause**: No automated infrastructure check before debugging

**Fix**:
- ✅ Create `/verify-infra` command
- ✅ Add to `.claude/startup.md` - suggest before debugging
- ✅ Document in COMMON_MISTAKES.md

---

## 🔧 Process Fix Decision Tree

```
Mistake occurred
│
├─ First time?
│  ├─ Yes → Document in COMMON_MISTAKES.md
│  └─ No → Continue below
│
├─ Second time?
│  ├─ Yes → Fix process (add check/documentation)
│  └─ No → Continue below
│
└─ Third+ time?
   └─ BUILD AUTOMATION (no excuses)
```

---

## 🎯 Automation Opportunities Checklist

### Red Flags (Manual → Should Be Automated)

**If you catch yourself**:
- [ ] Manually checking same thing multiple times → Automate
- [ ] Telling user "Remember to..." → Enforce automatically
- [ ] Repeating same debugging steps → Create command
- [ ] Manually verifying infrastructure → Build check script
- [ ] Manually formatting commits → Git hooks
- [ ] Manually checking token budget → Add to startup

**Action**: Stop and create automation before continuing.

---

## 📝 Documentation of Improvements

### COMMON_MISTAKES.md Entry Format

**Must include**:
1. **What Happened**: The symptom
2. **Root Cause**: The actual underlying issue
3. **The Fix**: What we implemented
4. **Prevention Strategy**: How we ensure it never happens again
5. **Cost of Mistake**: Time lost, impact
6. **Documented in**: Where the fix lives

**Example**:
```markdown
## 2025-10-10 | Debugging | Infrastructure Check Missing

### What Happened
Spent 3 hours debugging upload code. Root issue: storage bucket didn't exist.

### Root Cause
No systematic infrastructure verification before debugging application code.

### The Fix
Created `/verify-infra` command that checks:
- Database tables exist
- Storage buckets exist
- Environment variables set
- Deployment settings correct

### Prevention Strategy
1. Added to `.claude/startup.md` - automatically suggested before debugging
2. Added to SESSION_CHECKLIST.md step 3
3. Documented in COMMON_MISTAKES.md (this entry)

### Cost of Mistake
- Time lost: 3 hours debugging wrong layer
- Could have been caught in: 2 minutes with infrastructure check

### Documented in
- `.claude/commands/verify-infra.md` (the tool)
- `.claude/startup.md` (automatic suggestion)
- `.process/COMMON_MISTAKES.md` (this entry)
```

---

## 🔍 Quarterly Process Audit

**Every 3 months** (or after major project):

### 1. Review COMMON_MISTAKES.md
```
Questions to ask:
- What patterns emerged?
- What mistakes happened 2+ times?
- What should be automated that isn't?
```

### 2. Audit Documentation Against Philosophy
```
- Does process docs follow "Start Minimal"?
- Is documentation minimal or bloated?
- Are we loading unnecessary docs every session?
- Can anything be deleted?
```

### 3. Check Automation Health
```
- Are tools being used? (Check git history)
- Are hooks working? (Check commit messages)
- Are commands documented? (Check .claude/commands/)
- What new automations are needed?
```

### 4. Measure Impact
```
- Session startup time: Has it decreased?
- Repeated mistakes: Are they eliminated?
- Time saved: Is automation providing ROI?
- Quality: Are we catching issues earlier?
```

---

## 🎯 Success Metrics

### Leading Indicators (Predict future quality)
- ✅ New automation created after 2nd occurrence
- ✅ COMMON_MISTAKES.md updated after every mistake
- ✅ Process docs updated when patterns emerge
- ✅ Quarterly audits completed

### Lagging Indicators (Measure past quality)
- ✅ Same mistake happens < 2 times (not 3+)
- ✅ Time to detect issues decreases over time
- ✅ Session startup time stable or decreasing
- ✅ Documentation size stable or decreasing

### Red Flags (Process failing)
- ❌ Same mistake happens 3+ times
- ❌ Documentation growing without deletions
- ❌ New tools created but not used
- ❌ COMMON_MISTAKES.md not updated for > 1 month

---

## 🛠️ Implementation Checklist

### For Every Mistake (Type 2 or 3)

- [ ] **Capture immediately** in COMMON_MISTAKES.md
- [ ] **Analyze root cause** (use Five Whys)
- [ ] **Determine type** (1, 2, or 3)
- [ ] **Fix process if Type 2**:
  - [ ] Add check to startup.md or SESSION_CHECKLIST.md
  - [ ] Update relevant documentation
  - [ ] Create command if helpful (but not required)
- [ ] **Build automation if Type 3**:
  - [ ] Create tool/command/hook
  - [ ] Integrate into workflow (startup.md, git hooks, etc)
  - [ ] Document in relevant places
  - [ ] Test that it works
- [ ] **Update COMMON_MISTAKES.md** with full details
- [ ] **Commit changes** with clear message

---

## 🚀 Example: The Journey of a Mistake

### Session 1: First Occurrence
```
Issue: Forgot to check token budget, session hit 120K tokens
Action: Just document in COMMON_MISTAKES.md
Type: 2 (process failure)
```

### Session 2: Second Occurrence (FIX PROCESS)
```
Issue: Forgot to check token budget again, hit 115K tokens
Action:
1. Add to SESSION_CHECKLIST.md step 0
2. Create `/token-health` command
3. Update COMMON_MISTAKES.md with prevention strategy
Type: 2 → Fixed process
```

### Session 3: Would Be Third (BUT PREVENTED)
```
Issue: Would forget again...
Prevented: startup.md now requires token check first thing
Result: Never happens again - process enforces it
```

---

## 💡 Cultural Principles

### 1. Blame the Process, Not the Person
**Bad**: "I forgot to check the bucket"
**Good**: "Our process didn't enforce infrastructure checks - let's fix that"

### 2. Automate Everything Repeated
**Bad**: "Remember to run tests before committing"
**Good**: Git pre-commit hook runs tests automatically

### 3. Delete More Than You Add
**Bad**: Add new documentation for every issue
**Good**: Fix root cause with automation, reduce docs

### 4. Measure Everything
**Bad**: "Process feels better"
**Good**: "Session startup decreased from 5min to 2min"

### 5. Question the Status Quo
**Bad**: "This is how we've always done it"
**Good**: "Why do we do this manually? Can we automate it?"

---

## 📚 Related Documentation

- `.claude/startup.md` - Automatic enforcement at session start
- `.process/COMMON_MISTAKES.md` - Log of all mistakes and fixes
- `SESSION_CHECKLIST.md` - Session workflow (non-automatic)
- `.process/ARCHITECTURE.md` - "Start Minimal" philosophy
- `CI_PHILOSOPHY_IMPROVEMENTS.md` - Example of process audit

---

**Remember**: Fix root causes once, not symptoms many times. Every repeated mistake is a process failure waiting to be automated.

**Next Review**: After 10 sessions or when same mistake happens twice
