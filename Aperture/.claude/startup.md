# Claude Startup Automation

**Purpose**: This file is automatically read by Claude Code at the start of EVERY session.

**Effect**: Enforces critical checks without user having to remember.

**Communication Style**: Keep all responses concise. Short explanations, focused answers. Users value efficiency.

---

## 📚 LAZY LOADING STRATEGY

**Read this file only** at startup (~300 tokens). **DON'T** read entire documentation upfront.

**Navigation**:
- Task-based index → `NAVIGATION.md`
- Reading strategy → `.process/WHEN_TO_READ.md`
- Project router → `CLAUDE.md` (NUDJ vs Aperture)

**Autonomous Docs**: This repo uses self-optimizing documentation
- Updates daily with frontier AI/Claude knowledge
- **REPLACES** outdated content (not accumulative)
- Minimizes tokens while maximizing value
- **Modification guide**: `scripts/autonomous-docs/FEATURE_GUIDE.md`

---

## 📖 CONTEXTUAL DOCUMENTATION INDEX

**These docs are read ONLY when needed, not at startup.**

**Last scanned**: 2025-10-19
**Total files**: 83

### Core Documentation (Auto-Read)
- `.claude/startup.md` - This file is automatically read by Claude Code at the start of EVERY session.
- `CLAUDE-APERTURE.md` - Reduce test maintenance burden through AI-powered repair
- `CLAUDE-NUDJ.md` - Core backend API service with tRPC v11, multi-tenant architecture
- `CLAUDE.md` - Distinguish NUDJ (work) vs Aperture (personal) projects
- `NEXT_SESSION.md` - Current status and immediate next steps.

### Navigation & Strategy
- `.process/CAPABILITIES.md` - Fast lookup for available patterns and when to use them
- `.process/WHEN_TO_READ.md` - Optimize documentation reading for token efficiency
- `NAVIGATION.md` - Task-based index for efficient documentation access.

### Debugging & Troubleshooting (Read when debugging)
- `.process/COMMON_MISTAKES.md` - Learn from every mistake. Capture immediately, detail at session end.
- `.process/OBSERVABILITY.md` - Enable self-sufficient debugging - Claude should never ask users to check external logs.
- `.process/PROACTIVE_LOG_MONITORING.md` - Enable Claude to proactively review Vercel logs and catch production issues early.
- `DEBUGGING_CHECKLIST.md` - Documentation file
- `META_DEBUGGING_PROTOCOL.md` - Prevent wasting hours debugging algorithms when inputs are wrong
- `projects/wizard-of-oz/DEBUGGING.md` - Documentation file

### Development & Process (Read when implementing)
- `.process/DEPLOYMENT.md` - Deploy to production safely with Vercel + Supabase
- `.process/DEVELOPMENT.md` - Documentation file
- `.process/TESTING_GUIDE.md` - Define what, when, and how to test with Claude
- `projects/wizard-of-oz/DEPLOYMENT.md` - Documentation file
- `SESSION_CHECKLIST.md` - Structure each development session for maximum productivity and continuous improvement.

### Meta Projects (Read when working on infrastructure)
- `.process/CONTINUOUS_IMPROVEMENT.md` - Turn repeated mistakes into automated solutions
- `.process/DECISION_LOG.md` - Document significant architectural decisions and their rationale
- `.process/LESSONS_LEARNED.md` - Post-project reflections. What worked? What didn't? What would we do differently?
- `scripts/autonomous-docs/FEATURE_GUIDE.md` - Keep documentation minimal, current, and frontier-quality through automated optimization.
- *... and 7 more files (see DOCUMENTATION_INDEX.md for full list)*

### Reference & Analysis (Read when researching)
- `.process/CONTEXT_ENGINEERING_ANALYSIS.md` - Compare proposed context engineering best practices against Aperture's current process
- `GOOGLE_CLOUD_PATTERNS_ANALYSIS.md` - Evaluate Google Cloud's agentic AI patterns against Aperture documentation to identify gaps and opportunities
- *... and 6 more files (see DOCUMENTATION_INDEX.md for full list)*

### Quick Reference (Read when needed)
- `CHEATSHEET.md` - Documentation file
- `DOCUMENTATION_INDEX.md` - Find the right doc for your current situation
- `QUICK_REFERENCE.md` - Fast navigation for new sessions
- `STARTUP_EXAMPLE.md` - This file shows EXACTLY what a correct session startup looks like.

### Project-Specific Documentation
- `projects/visual-test-generator/ARCHITECTURE.md` - UI element detection and understanding
- `projects/visual-test-generator/docs/COMPARISON.md` - Proactive test creation
- *... and 14 more files (see DOCUMENTATION_INDEX.md for full list)*

### Other Documentation
- `.claude/commands/token-health.md` - Quick visual check of current context window health.
- `.claude/commands/vercel-logs.md` - Fetch Vercel runtime logs for self-sufficient debugging without user intervention.
- `.claude/commands/verify-infra.md` - Check that all infrastructure is properly configured before debugging code issues.
- `.claude/commands/which-project.md` - Automatically detect which project you're working on (NUDJ or Aperture) to load correct documentation.
- `.claude/skills/aperture-router/SKILL.md` - ---
- *... and 20 more files (see DOCUMENTATION_INDEX.md for full list)*

**When to read what**: See `.process/WHEN_TO_READ.md` for complete reading strategy

---

## 🚨 AUTOMATIC SESSION STARTUP SEQUENCE

### Step 0: Capability Quick Reference

> **Purpose**: Know what's available before starting work
>
> **Quick reference**: See `.process/CAPABILITIES.md` for full pattern catalog
>
> **Documentation map**: See `NAVIGATION.md` for task-based navigation

**Before starting work, these capabilities are available**:

#### 1. Task Signature Pattern
**When**: Complex features (> 30 min), cross-session work, user-facing features
**Where**: `CLAUDE-APERTURE.md:352-450`
**What**: Define `inputs → outputs`, validation criteria, success metrics
**Why**: Structured approach prevents scope creep, enables measurement, clearer handoffs
**Time**: 5-10 min upfront → Saves 30-60 min in rework

#### 2. Three-Stage Development
**When**: User-facing features, data processing, integrations
**Where**: `SESSION_CHECKLIST.md:84-167`
**Stages**: Programming (define) → Evaluation (test) → Optimization (refine)
**Why**: Systematic improvement based on metrics, not guesswork
**Impact**: Measurable quality improvements, clear "done" criteria

#### 3. Validation-Driven Development
**When**: Reliability-critical features (uploads, APIs, authentication, payments)
**Where**: See Step 4.6 below
**Pattern**: Define constraints → Add validation → Implement retry
**Why**: 164% better rule-following, 37% better responses (DSPy research)
**Impact**: Catches failures at validation points, not in production

#### 4. Parallel Execution
**When**: Multiple independent operations (file reads, searches, git commands)
**Where**: See Step 5.5 below
**How**: Single message with multiple tool calls
**Why**: 3x faster execution, better token efficiency

#### 5. Subagent Delegation
**When**: Research, code analysis, review tasks that can run in background
**Where**: See Step 5.6 below
**Agents**: deep-research, codebase-pattern-analyzer, check-and-challenge
**Why**: Work continues while agents gather specialized information

#### 6. Targeted Operations
**When**: Searching for code, finding implementations
**Where**: `CLAUDE-APERTURE.md:326-371`
**Pattern**: Use `grep` with patterns instead of reading entire files
**Why**: 10-100x faster than broad file reads, saves thousands of tokens

**Quick Decision Tree**:
```
Task complexity?
├─ Simple (< 10 min) → Just do it
├─ Medium (10-30 min) → Use TodoWrite, proceed
├─ Complex (> 30 min) → Define Task Signature first
└─ Cross-session → Task Signature + Checkpoint

Reliability critical?
└─ Yes (uploads, APIs, auth) → Use Validation-Driven Development

Need research/analysis?
└─ Yes → Launch subagent in parallel
```

---

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

> **Source**: Adapted from Google Cloud Coordinator Pattern
>
> **Purpose**: Route user queries to appropriate patterns/docs, saving 20-30% tokens per session
>
> **Principle**: Load only relevant context based on user intent

**Automatically classify the user's request**:

#### Query Type Detection

```
User query contains → Route to → Expected outcome

"doesn't work", "broken", "failing", "error", "bug"
  → DEBUG
  → META_DEBUGGING_PROTOCOL.md FIRST
  → Infrastructure check → Input verification → Logic debugging

"implement", "add feature", "create", "build"
  → FEATURE_NEW
  → Task Signature Pattern (if > 30 min)
  → Three-Stage Development (if user-facing)
  → Validation-Driven (if reliability-critical)

"understand", "how does", "explain", "what is", "why"
  → RESEARCH
  → Launch deep-research subagent
  → Or use codebase-pattern-analyzer for code understanding

"fix typo", "update text", "change color", "quick change"
  → QUICK_FIX
  → Skip planning, just do it (< 10 min)
  → Use Targeted Operations for finding code

"refactor", "improve", "optimize", "reorganize"
  → REFACTOR
  → Create Checkpoint FIRST
  → Task Signature if complex
  → Parallel execution for analysis phase

"test", "verify", "check if", "validate"
  → VERIFICATION
  → Read relevant verification commands from NEXT_SESSION.md
  → Use observability tools (/vercel-logs)

"continue", "next", "keep going"
  → CONTINUATION
  → Read NEXT_SESSION.md
  → Check last completed task
  → Proceed with next priority
```

#### Smart Context Loading

**Based on query type, load minimal necessary context**:

```
DEBUG:
  ✅ Load: META_DEBUGGING_PROTOCOL.md, /verify-infra
  ❌ Skip: Task Signature, Three-Stage Development
  💾 Tokens saved: ~5K

FEATURE_NEW (Complex):
  ✅ Load: Task Signature Pattern, CAPABILITIES.md
  ✅ Load: Three-Stage Development, Validation-Driven (if applicable)
  ❌ Skip: META_DEBUGGING_PROTOCOL.md (unless needed later)
  💾 Tokens saved: ~3K

RESEARCH:
  ✅ Load: Subagent delegation info
  ✅ Launch: deep-research or codebase-pattern-analyzer
  ❌ Skip: Most implementation patterns
  💾 Tokens saved: ~6K

QUICK_FIX:
  ✅ Load: Targeted Operations, Parallel Execution
  ❌ Skip: Task Signature, Three-Stage, Validation-Driven
  💾 Tokens saved: ~8K
```

#### Communication Pattern

**After classifying query**:
```
Query classified as: [DEBUG/FEATURE_NEW/RESEARCH/QUICK_FIX/REFACTOR/VERIFICATION/CONTINUATION]

Routing to:
- [Pattern/Protocol name]
- [Relevant documentation]

Loading minimal context for efficiency.
```

**Why this matters**:
- 💰 Saves 20-30% tokens per session (load only what's needed)
- ⚡ Faster first response (less reading upfront)
- 🎯 Better pattern selection (automatic not manual)
- 🧠 Reduces cognitive load (clear routing logic)

**Enforcement**:
- Always classify before proceeding
- If unclear → Ask user to clarify intent
- If multiple query types → Handle sequentially or in priority order

---

### Step 2: Project Selection (INTERACTIVE - MANDATORY)

**🚨 YOU MUST ASK THIS QUESTION AT THE START OF EVERY NEW SESSION 🚨**

**Even if the user's first message clearly indicates a project, ALWAYS show this menu and ask them to select.**

**Ask the user which project they want to work on:**

```
Which project would you like to work on?

WORK PROJECTS:
1. 🏢 NUDJ
   - Admin app, user app, API
   - MongoDB gamification platform
   - PNPM monorepo

PERSONAL PROJECTS:
2. 🏠 Wizard of Oz
   - Baby photo app
   - Supabase backend
   - Vercel deployment

3. 🧠 MemoryOS
   - Voice-to-memory system
   - Audiopen integration
   - Personal knowledge graph

META PROJECTS (Infrastructure):
4. 🔬 Self-Healing Tests
   - Automated test repair system
   - Meta-testing framework
   - AI-powered test maintenance

5. 📚 Autonomous Docs
   - Self-optimizing documentation
   - Daily knowledge updates
   - Token-efficient doc system

6. 🔧 Other Aperture project
   - (You'll specify)
```

**After user selects**:
- Load appropriate documentation (CLAUDE-NUDJ.md or CLAUDE-APERTURE.md)
- Read NEXT_SESSION.md for current context
- Proceed with session startup

---

### Step 3: Read Current Status (MANDATORY)

**YOU MUST READ**:
1. `CLAUDE-APERTURE.md` or `CLAUDE-NUDJ.md` - Check "Current Tasks & Status" section
2. `NEXT_SESSION.md` - Detailed implementation context

**CLAUDE-APERTURE.md contains**:
- High-level current sprint tasks (single source of truth)
- Recent completions with verification status
- Active work with verification commands
- Blockers

**NEXT_SESSION.md contains**:
- Detailed implementation notes
- Technical context and decisions
- Infrastructure status
- Key resources and commands

**Action Required**: After reading BOTH files, state:
```
Current sprint (from CLAUDE-APERTURE.md): [high-level tasks]
Today's focus (from NEXT_SESSION.md): [specific implementation]
Verification ready: [can I verify my work?]
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

**Error Communication Format**:

When reporting errors, use this structured format:

```
❌ Error: [What failed in plain language]
📍 Location: [file:line or component name]
🔍 Cause: [Root cause, not just symptom]
✅ Fix: [Specific command or code change needed]
📚 See: [Related documentation if applicable]
```

**Examples**:

**Good error reporting**:
```
❌ Error: Photo upload fails with 401 Unauthorized
📍 Location: src/lib/uploadToSupabase.ts:45
🔍 Cause: Supabase anon key missing from environment
✅ Fix: Set VITE_SUPABASE_ANON_KEY in Vercel dashboard
📚 See: projects/wizard-of-oz/DEPLOYMENT.md#environment-variables
```

**Bad error reporting**:
```
Error: Upload doesn't work
[provides stack trace]
[no guidance on fix]
```

**Why this format matters**:
- 🎯 User knows exactly what broke
- 📍 User can find the problem immediately
- 🔍 User understands why it broke
- ✅ User knows how to fix it
- 🚀 Faster resolution (minutes vs hours)

---

### Step 4.5: Production Health Check (AUTOMATIC for Aperture)

> **📍 Full guide → `.process/PROACTIVE_LOG_MONITORING.md`**

**For Aperture projects only** - Proactively check production logs for errors.

**Quick check** (60 seconds):

```bash
# 1. Check last deployment status
curl -s -H "Authorization: Bearer FWsU3v4DJU8HKGZYb63exOIf" \
  "https://api.vercel.com/v6/deployments?projectId=prj_rkI3NQOI5SfBle7lflFkwFkj0eYd&limit=1" \
  | python3 -c "import sys, json; d = json.load(sys.stdin)['deployments'][0]; print(f\"State: {d['state']}\nError: {d.get('errorMessage', 'None')}\")"

# 2. Check alignment pipeline (critical)
/vercel-logs align-photo-v4 10

# 3. Check eye detection (critical)
/vercel-logs detect-eyes 10
```

**Report format**:
```
Production Health: 🟢 Healthy / 🟡 Warning / 🔴 Critical

Last deployment: [state]
Alignment logs: [X successes, Y failures]
Eye detection: [X successes, Y failures]

Issues: [if any]
Action needed: [yes/no]
```

**If 🔴 Critical issues found**:
1. Stop new work
2. Document in session notes
3. Fix production issue first
4. Update NEXT_SESSION.md

**Why this matters**:
- Catch issues before user reports them
- Fix production bugs within 5 minutes of occurrence
- Build trust through proactive monitoring
- Learn from error patterns

---

### Step 4.6: Validation-Driven Development (For Reliability-Critical Features)

> **Source**: Adapted from DSPy's assertion framework principles

**When to use**:
- User-facing features with clear success/failure modes
- API integrations with external services
- Data processing pipelines
- Features where "it works" has objective criteria

**Three-Step Pattern**:

**1. Define Constraints Upfront** (Before implementation):

```markdown
Task: [Feature name]

Must Have (Assert - task fails if missing):
- [ ] Constraint 1: [specific, testable requirement]
- [ ] Constraint 2: [specific, testable requirement]

Should Have (Suggest - improves quality):
- [ ] Enhancement 1: [nice-to-have feature]
- [ ] Enhancement 2: [nice-to-have feature]
```

**2. Implement Validation Checks** (During implementation):

Add validation at critical points:
```typescript
// Example: Photo upload validation
async function uploadPhoto(file: File) {
  // Assert: File must exist and be valid image
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Invalid file type')
  }

  // Assert: File size under limit
  if (file.size > 10_000_000) {
    throw new Error('File too large (max 10MB)')
  }

  const result = await upload(file)

  // Assert: Upload succeeded and returned URL
  if (!result.url) {
    throw new Error('Upload failed - no URL returned')
  }

  // Suggest: Should have width/height metadata
  if (!result.metadata?.width) {
    console.warn('Missing image dimensions')
  }

  return result
}
```

**3. Add Retry with Refinement** (Error recovery):

```typescript
// Retry pattern with improved context
async function uploadWithRetry(file: File, maxRetries = 2) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}: ${lastError}`)
        // Refine approach based on previous failure
        await delay(1000 * attempt) // Exponential backoff
      }

      return await uploadPhoto(file)
    } catch (error) {
      lastError = error.message

      // If critical constraint fails, don't retry
      if (error.message.includes('Invalid file type')) {
        throw error
      }
    }
  }

  throw new Error(`Upload failed after ${maxRetries} retries: ${lastError}`)
}
```

**Performance Impact** (from DSPy research):
- Features follow rules up to **164% more often**
- Generate up to **37% better responses**
- Specific tasks improved from 30.5% to 87.2% success rate

**Communication Pattern**:

Before implementing reliability-critical feature:
```
I'm implementing [FEATURE] with validation-driven approach:

Must-have constraints:
- [List critical requirements]

Validation points:
- [Where checks will happen]

Retry strategy:
- [How failures will be handled]

This ensures [BENEFIT] and catches [FAILURE_MODE] early.
```

**Why this matters**:
- 🛡️ Catches failures at validation points, not in production
- 🔄 Automatic recovery from transient errors
- 📊 Observable failure modes with detailed logging
- ✅ Higher reliability for critical features

---

### Step 5: Validation Before Starting Work

**Confirm you have**:
- ✅ Token budget status (and it's acceptable to continue)
- ✅ Project type identified (NUDJ or Aperture)
- ✅ Current sprint tasks from CLAUDE-[PROJECT].md
- ✅ Detailed context from NEXT_SESSION.md
- ✅ **Reviewed capabilities in Step 0** (know what patterns are available)
- ✅ Verification commands available for tasks
- ✅ Today's focus is clear

**If ANY is unclear**: Ask user before proceeding.

**Before executing any task**: Confirm verification method is documented.

---

### Step 5.5: Parallel Execution Policy

**When working on tasks, maximize efficiency by running independent operations in parallel.**

**Parallel execution checklist**:
- ✅ File reads that aren't dependent on each other
- ✅ Multiple grep/glob searches
- ✅ Git status + git diff + git log
- ✅ Multiple bash commands that don't depend on each other
- ✅ Infrastructure checks across different services

**Communication pattern**:
```
I'm going to run these operations in parallel:
1. [Operation 1]
2. [Operation 2]
3. [Operation 3]

[Execute all in single message with multiple tool calls]
```

**Examples**:

**GOOD - Parallel file reads**:
```
Single message with 3 Read tool calls:
- Read: src/components/Upload.tsx
- Read: src/components/Gallery.tsx
- Read: src/lib/imageUtils.ts
```

**BAD - Sequential when could be parallel**:
```
Message 1: Read src/components/Upload.tsx
[wait]
Message 2: Read src/components/Gallery.tsx
[wait]
Message 3: Read src/lib/imageUtils.ts
```

**GOOD - Parallel git inspection**:
```
Single message with 3 Bash tool calls:
- git status
- git diff
- git log --oneline -10
```

**Why this matters**:
- ⚡ 3x faster execution
- 🎯 Better token efficiency
- 🔄 More work per session

---

### Step 5.6: Subagent Task Delegation

**Use Task tool proactively for specialized work that can run in parallel.**

**When to delegate to subagents**:
- 🔍 **deep-research** - Understanding APIs, best practices, documentation
- 🔎 **codebase-pattern-analyzer** - Tracing features, understanding architecture
- ✅ **check-and-challenge** - After implementing significant features
- 📝 **docs-writer/docs-reviewer** - Creating/updating user guides

**Parallel subagent pattern**:
```
I'm going to launch 2 agents in parallel:
1. deep-research: Investigate best practices for X
2. codebase-pattern-analyzer: Find all files related to Y

[Single message with 2 Task tool calls]
```

**Benefits**:
- ⚡ Work continues while agents gather information
- 🎯 Specialized expertise for specific tasks
- 🔀 True parallel development (research + implementation simultaneously)

**Example use cases**:
- Launch research agent to find best practices while implementing feature
- Start code review agent on completed feature while working on next feature
- Run pattern analyzer to understand architecture while planning changes

---

### Step 5.7: Checkpoint Before Major Changes

**Create checkpoints before risky or significant changes.**

**When to checkpoint**:
- 🔧 Major refactoring (changing architecture, moving files)
- ✨ New feature implementation (significant additions)
- 🔄 Database migrations or schema changes
- 🚨 High-risk fixes (touching critical code paths)
- 🎯 Any change where you think "I hope this works"

**How to checkpoint**:
1. Ensure current state is stable
2. Add entry to NEXT_SESSION.md under "Session Checkpoints"
3. Document what's working, what you'll change, risk level
4. Note current git commit for potential rollback
5. Proceed with changes

**Format**:
```markdown
### Checkpoint 1 - 2025-10-13 14:30 - Refactor alignment algorithm

**What's working**:
- Upload system functional
- Eye detection working
- Basic alignment operational

**About to change**:
- Refactor alignPhoto() to use matrix transformations
- May affect existing alignment logic

**Risk level**: Medium

**Rollback**: git checkout ba2603e -- src/lib/imageUtils.ts
```

**After change**:
- ✅ Success: Mark checkpoint as complete
- ❌ Failed: Use rollback command, document what went wrong

**Why this matters**:
- 🔒 Safe experimentation without fear
- ⏮️ Quick recovery if things break
- 📊 Learning from what went wrong
- 🎯 Confidence to try bold improvements

---

### Step 6: Task Complexity Assessment

> **Purpose**: Choose the right approach based on task complexity
>
> **Principle**: More planning upfront for complex tasks = less rework later

**Before implementing, categorize the task**:

| Complexity | Criteria | Required Approach | Time Investment |
|------------|----------|-------------------|-----------------|
| **Trivial** | < 10 min, obvious requirements, one-line fixes | Just do it | None |
| **Simple** | 10-30 min, clear scope, familiar patterns | Use TodoWrite, proceed | 2 min |
| **Complex** | > 30 min, multiple approaches, user-facing | **Define Task Signature first** | 5-10 min |
| **Cross-session** | Can't finish in one session, handoff needed | **Task Signature + Checkpoint** | 10-15 min |

**If Complex or Cross-session, BEFORE implementing**:

1. **Define Task Signature** (`CLAUDE-APERTURE.md:352-450`):
   - [ ] Signature: `inputs → outputs`
   - [ ] Validation criteria (must-have vs should-have)
   - [ ] Success metrics (how to verify done)
   - [ ] Constraints (time, tokens, dependencies, risk)

2. **Consider Additional Patterns**:
   - [ ] **Reliability-critical?** → Use Validation-Driven Development (Step 4.6)
   - [ ] **User-facing feature?** → Use Three-Stage Development (SESSION_CHECKLIST.md)
   - [ ] **Risky change?** → Create Checkpoint (NEXT_SESSION.md)

3. **Communicate Plan**:
   ```
   I'm implementing [FEATURE].

   Complexity: [Complex/Cross-session]

   Task Signature:
   - Inputs: [what we need]
   - Outputs: [what we deliver]
   - Must-have: [critical requirements]
   - Success: [how to verify]

   Additional patterns:
   - [X] Validation-Driven (reliability-critical)
   - [ ] Three-Stage Development
   - [X] Checkpoint (risky refactor)

   Time estimate: [X min]
   Proceed? [yes/no]
   ```

**Why this matters**:
- 🎯 Prevents scope creep (signature defines boundaries)
- ⏱️ 5-10 min upfront saves 30-60 min rework
- 🤝 Clear handoffs between sessions
- ✅ Objective completion criteria

**Enforcement**:
- If task takes > 30 min and no signature defined → Stop and define one
- If task spans sessions without signature → High risk of context loss

---

### Step 7: MANDATORY - Update Documentation During Work

**🚨 CRITICAL**: NEXT_SESSION.md must be updated DURING the session, NOT just at the end.

**Update frequency**:
- ✅ After completing ANY task
- ✅ After discovering important information
- ✅ After fixing a bug
- ✅ After changing direction
- ✅ Every 30 minutes of active work

**What to update**:
```markdown
**Last Updated**: [timestamp] (Session [N] - [brief context])

**Current Work**: [one sentence what you're doing right now]

[In Priority sections]:
- Status changed from X to Y
- Added new findings
- Updated what's deployed
- Changed next action required
```

**Why this matters**:
- Next Claude session reads NEXT_SESSION.md first
- If it's out of date, they waste time on wrong context
- Documentation debt compounds quickly
- User frustration when docs don't match reality

**Enforcement**:
- System will remind you if 30+ minutes pass without update
- If you close session without updating → you failed the session
- This is NOT optional

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

4. **Update task status**:
   - If task failed verification → Update CLAUDE-[PROJECT].md with blocker
   - If task completed → Mark [x] in CLAUDE-[PROJECT].md AND NEXT_SESSION.md
   - If discovered subtasks → Add to both files

5. **Propose automation**:
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

**At start of EVERY session**, you MUST do these in order:

1. [ ] **Report token budget status** (< 50K / 50-100K / > 100K)
2. [ ] **ASK USER which project** using the menu from Step 2 (MANDATORY - never skip this)
3. [ ] **Load appropriate docs** based on user's selection
4. [ ] **Read NEXT_SESSION.md** and confirm current status
5. [ ] **Proceed with work** (if user reports "doesn't work" → suggest /verify-infra first)

**🚨 CRITICAL**: Step 2 (asking which project) is MANDATORY at the start of EVERY new session. Even if the user's first message suggests a project, ALWAYS show the menu and ask them to confirm.

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
