# Claude Startup Automation

**Purpose**: This file is automatically read by Claude Code at the start of EVERY session.

**Effect**: Enforces critical checks without user having to remember.

**Communication Style**: Keep all responses concise. Short explanations, focused answers. Users value efficiency.

---

## 📚 LAZY LOADING STRATEGY

**Read this file only** at startup (~300 tokens). **DON'T** read entire documentation upfront.

**Navigation System**:
- 📍 **Task-based index** → `NAVIGATION.md` (what to read for your task)
- 📖 **Complete doc map** → `DOCUMENTATION_INDEX.md` (all files indexed)
- 📋 **Quick reference** → `.process/QUICK_REFERENCE.md` (fast lookup)
- 🧭 **Reading strategy** → `.process/WHEN_TO_READ.md` (when to read what)
- 🎯 **Patterns & capabilities** → `.process/CAPABILITIES.md` (how to do things)

**Autonomous Docs**: This repo uses self-optimizing documentation
- Updates daily with frontier AI/Claude knowledge
- **REPLACES** outdated content (not accumulative)
- Minimizes tokens while maximizing value
- **Modification guide**: `scripts/autonomous-docs/FEATURE_GUIDE.md`

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

### Step 1.5: Query Classification & Smart Routing

**Purpose**: Load only relevant context based on user intent

**Classify user's request**:

```
User query type → What to read → Pattern to use

"doesn't work", "broken", "error", "bug"
  → DEBUG → .process/META_DEBUGGING_PROTOCOL.md

"implement", "add feature", "create", "build"
  → FEATURE_NEW → .process/CAPABILITIES.md (Task Signature Pattern)

"understand", "how does", "explain", "why"
  → RESEARCH → Launch deep-research subagent

"fix typo", "update text", "quick change"
  → QUICK_FIX → Skip planning, implement directly

"refactor", "improve", "clean up"
  → REFACTOR → Create checkpoint first (.process/CAPABILITIES.md)

"check", "verify", "test", "validate"
  → VERIFICATION → .process/OBSERVABILITY.md

"continue", "keep going", "next"
  → CONTINUATION → Read NEXT_SESSION.md
```

**Full routing guide**: `.process/CAPABILITIES.md:9-32`

---

### Step 2: Project Selection (INTERACTIVE - MANDATORY)

**Ask the user** which project they're working on:

```
Which project are you working on today?

1. 🏢 NUDJ (Work) - Multi-tenant SaaS platform
   → Read: CLAUDE-NUDJ.md

2. 🏠 Aperture (Personal Projects)
   → Read: CLAUDE-APERTURE.md
   → Then ask which sub-project:
      - Wizard of Oz (baby photo app) - 🟢 Production
      - MemoryOS (voice-to-memory) - 🔵 Design phase
      - Self-Healing Tests (meta) - 🟢 Complete
      - Visual Test Generator (meta) - 🚀 Week 1
      - Autonomous Docs (meta) - 🟢 Active
```

**Why ask?**
- Different projects have different conventions
- Prevents mixing concerns
- Loads appropriate context only

**Full router**: `CLAUDE.md`

---

### Step 3: Read Current Status (MANDATORY)

**Two-step approach**:

1. **Read root** `NEXT_SESSION.md` (router)
   - Quick overview of all projects
   - See which project was last active
   - Get links to project-specific files

2. **Read project-specific** NEXT_SESSION.md after user selects project:
   - `projects/wizard-of-oz/NEXT_SESSION.md`
   - `projects/visual-test-generator/NEXT_SESSION.md`
   - `projects/memory-os/NEXT_SESSION.md`
   - `scripts/autonomous-docs/NEXT_SESSION.md`

**What you'll find**:
- Current sprint/milestone for that project
- Active tasks and blockers
- Recent changes and context
- What to work on next

---

### Step 4: IF Debugging → Follow Protocol

**If user mentions**: "doesn't work", "broken", "failing", "error", "bug"

**🚨 MANDATORY - Read in order**:

1. **FIRST**: `.process/META_DEBUGGING_PROTOCOL.md`
   - Universal debugging principles
   - Input verification checklist
   - 80% of bugs are input issues

2. **SECOND**: Check infrastructure
   ```
   /verify-infra [project-name]
   ```

3. **THIRD**: Verify inputs before debugging algorithm
   - Log what you RECEIVE vs what you EXPECT
   - If mismatch → fix input, not algorithm

4. **ONLY THEN**: Debug the algorithm/logic

**Production health**: `.process/PROACTIVE_LOG_MONITORING.md`

---

### Step 5: Development Patterns

**For complex features** (> 30 min):
- **Task Signature Pattern** → `.process/CAPABILITIES.md:62-74`
  - Define inputs → outputs contract
  - Set validation criteria
  - Document constraints

**For reliability-critical** (uploads, APIs, auth, payments):
- **Validation-Driven Development** → `.process/CAPABILITIES.md:91-100`
  - Define constraints upfront
  - Add validation checks
  - Implement retry with refinement

**For iterative operations** (retry logic, refinement):
- **Loop Pattern with Safeguards** → `.process/CAPABILITIES.md:35-57`
  - Max attempts (3-5, not 100)
  - Explicit exit conditions
  - Progress tracking

**For performance**:
- **Parallel Execution** → `.process/CAPABILITIES.md:130-136`
- **Subagent Delegation** → `.process/CAPABILITIES.md:136-142`
- **Checkpoint Before Changes** → `.process/CAPABILITIES.md:142-164`

**Full patterns**: `.process/CAPABILITIES.md`

---

### Step 6: Task Complexity Assessment

**Quick assessment**:

| Time Estimate | Approach | Tools |
|---------------|----------|-------|
| < 10 min | Direct implementation | None needed |
| 10-30 min | Plan → Implement | Plan Mode optional |
| 30-60 min | **Task Signature** → Plan → Implement | Plan Mode recommended |
| > 60 min | Break into sub-tasks | Subagents + checkpoints |

**When in doubt**: Use Task Signature Pattern

---

### Step 7: Update Documentation During Work

**As you work**:
- Update `NEXT_SESSION.md` with progress
- If you make a mistake → Add to `.process/COMMON_MISTAKES.md`
- If pattern repeats 2+ times → Add to `.process/CONTINUOUS_IMPROVEMENT.md`

**Session end**:
- Update NEXT_SESSION.md with status
- Detail any mistakes made
- Note blockers or dependencies

**Full process**: `SESSION_CHECKLIST.md` (moved to `.process/SESSION_CHECKLIST.md`)

---

## 🔄 Continuous Improvement

**When you make a mistake**:
1. **Capture immediately** → `.process/COMMON_MISTAKES.md`
2. **If 2nd+ occurrence** → `.process/CONTINUOUS_IMPROVEMENT.md`
   - Identify root cause
   - Build automation/prevention
   - Update process docs

**Red flags needing process fixes**:
- Same mistake happens twice
- Spending > 30 min debugging preventable issues
- User has to remind you of process
- Documentation drift (docs don't match reality)

**Full anti-patterns**: `.process/COMMON_MISTAKES.md`

---

## 📋 Enforcement Checklist

Before starting work, confirm:
- [ ] Token budget checked (< 100K or noted if higher)
- [ ] Project selected (NUDJ vs Aperture sub-project)
- [ ] NEXT_SESSION.md read
- [ ] Appropriate pattern selected based on task type
- [ ] If debugging: META_DEBUGGING_PROTOCOL.md read

---

## 🎯 Success Criteria

**You're following this correctly if**:
- ✅ You check token budget at session start
- ✅ You ask which project before loading docs
- ✅ You read NEXT_SESSION.md for context
- ✅ You reference appropriate docs based on task type (not reading everything)
- ✅ You update NEXT_SESSION.md as you work
- ✅ You capture mistakes in COMMON_MISTAKES.md

---

**File Stats**: ~200 lines (down from 995 lines) - 80% reduction
**Token Cost**: ~1000 tokens at startup (down from ~5000 tokens)
**Approach**: Thin orchestrator - references detailed docs instead of duplicating content
