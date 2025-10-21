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

### Step 1.5: Query Classification (STRONGLY RECOMMENDED)

**Purpose**: Load only what you need. Make classification visible.

**Best Practice: Report your classification before proceeding:**

**Template:**
```markdown
📋 Query Classification: [DEBUGGING|IMPLEMENTATION|CONTINUATION]
📝 Reasoning: [One sentence why]
📖 Loading: [Specific files to read]
⏭️  Skipping: [What I'm NOT reading to save tokens]
```

**Classification Rules:**

**🐛 DEBUGGING** - User reports something broken/not working
```markdown
Keywords: "doesn't work", "broken", "error", "bug", "failing"
Loading: META_DEBUGGING_PROTOCOL.md, /verify-infra (if infrastructure-related)
Skipping: CAPABILITIES.md, Task Signature pattern, session management
Example: "Photo upload is broken" → DEBUGGING
```

**🔨 IMPLEMENTATION** - User wants to build/add/modify something
```markdown
Keywords: "implement", "add", "build", "create", "refactor"

Simple (<30 min): Just start, load project NEXT_SESSION.md
Complex (>30 min): Load CAPABILITIES.md (Task Signature Pattern)

Loading: NEXT_SESSION.md + (if complex) CAPABILITIES.md (Task Signature section)
Skipping: Debugging docs, full pattern list
Example: "Add dark mode toggle" → IMPLEMENTATION (complex)
```

**📖 CONTINUATION** - User wants to continue previous work
```markdown
Keywords: "continue", "keep going", "next", "where were we"
Loading: NEXT_SESSION.md ONLY (that's it!)
Skipping: Everything else until specific need emerges
Example: "Continue building Polymath" → CONTINUATION
```

**If unsure**: Default to CONTINUATION (safest, minimal loading)

---

### Step 2: Project Detection (SMART INFERENCE)

**Auto-detect project based on context (95% of sessions):**

**Detection algorithm:**
1. Check current working directory (`pwd`)
   - If path contains `/nudj-digital/` → NUDJ (work)
   - If path contains `/Aperture/projects/X/` → Aperture project X
2. If ambiguous, check `NEXT_SESSION.md` "Last Active" field
3. If still unclear, check user's first message for project keywords

**Examples:**
```bash
# Auto-detected (no confirmation needed)
pwd: /Aperture/projects/polymath/
Last Active: Polymath (Session 21)
User: "continue where we left off"
→ Silently load: projects/polymath/NEXT_SESSION.md

# Auto-detected with inference
pwd: /Aperture/
Last Active: Wizard of Oz
User: "fix the upload bug"
→ Infer: Wizard of Oz (was last active, user mentions upload)
→ Silently load: projects/wizard-of-oz/NEXT_SESSION.md
```

**Only ask if truly ambiguous (<5% of cases):**
```
Detected: [Project X based on Y]
Is that correct, or are you working on something else?
```

**Manual override always works:**
- User can say "actually working on Y" → switch immediately
- Saves 30 seconds + 500-1000 tokens per session

**Full router**: `CLAUDE.md`

---

### Step 3: Read Current Status (MANDATORY)

**🚨 CRITICAL - NEXT_SESSION.md Routing Pattern**:

**Root NEXT_SESSION.md is a ROUTER, not content**:
1. **Read root** `NEXT_SESSION.md` ONLY to see which project was last active
2. **Immediately load project-specific** `NEXT_SESSION.md` for actual details:
   - `projects/wizard-of-oz/NEXT_SESSION.md` ← Detailed status HERE
   - `projects/visual-test-generator/NEXT_SESSION.md` ← Detailed status HERE
   - `projects/polymath/NEXT_SESSION.md` ← Detailed status HERE
   - `scripts/autonomous-docs/NEXT_SESSION.md` ← Detailed status HERE

**Pattern**: Root = router index → Project file = actual content

**When updating docs**:
- ✅ **DO**: Update project-specific `NEXT_SESSION.md` with detailed progress
- ✅ **DO**: Update root `NEXT_SESSION.md` "Last Active" section (one line)
- ❌ **DON'T**: Put detailed status in root file (it's just a router!)

**What you'll find in project-specific files**:
- Current sprint/milestone for that project
- Active tasks and blockers
- Recent changes and context
- What to work on next
- Setup instructions
- Known issues

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
- **Task Signature Pattern** → `.process/CAPABILITIES.md` (Complex Feature Patterns section)
  - Define inputs → outputs contract
  - Set validation criteria
  - Document constraints

**For reliability-critical** (uploads, APIs, auth, payments):
- **Validation-Driven Development** → `.process/CAPABILITIES.md` (Reliability-Critical Patterns section)
  - Define constraints upfront
  - Add validation checks
  - Implement retry with refinement

**For iterative operations** (retry logic, refinement):
- **Loop Pattern with Safeguards** → `.process/CAPABILITIES.md` (Reliability-Critical Patterns section)
  - Max attempts (3-5, not 100)
  - Explicit exit conditions
  - Progress tracking

**For performance**:
- **Parallel Execution** → `.process/CAPABILITIES.md` (Core Patterns section)
- **Subagent Delegation** → `.process/CAPABILITIES.md` (Experimental Patterns section)
- **Checkpoint Before Changes** → `.process/CAPABILITIES.md` (Query Routing section)

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

### Step 7: Update Documentation During Work (ENFORCED)

**🚨 MANDATORY - Not Optional**

**As you work**:
- Update `NEXT_SESSION.md` with progress (after each feature/fix)
- If you make a mistake → Add to `.process/COMMON_MISTAKES.md` immediately
- If pattern repeats 2+ times → Add to `.process/CONTINUOUS_IMPROVEMENT.md`

**Session end (REQUIRED)**:
- Update NEXT_SESSION.md with status
- Detail any mistakes made
- Note blockers or dependencies
- Run `/update-docs` to validate completeness

**Enforcement mechanisms**:
1. **Pre-commit hook** - Blocks commits if code changed without doc updates
2. **CI/CD check** - Validates doc freshness on PRs
3. **/update-docs command** - Proactive check before commits

**Full process**: `.process/SESSION_CHECKLIST.md`

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
