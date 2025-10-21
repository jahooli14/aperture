# Aperture Capabilities - Quick Reference

> **Purpose**: Fast lookup for available patterns and when to use them
>
> **Last Updated**: 2025-01-21 (Session 21 - Pattern Tiers Added)

---

## Pattern Tiers

**How to use this guide**:
- 🔵 **Core** - Use these always. Required for effective development.
- 🟢 **Reliability-Critical** - Use when building uploads/APIs/auth/payments.
- 🟡 **Complex Features** - Use only for features > 30 min or cross-session work.
- 🔴 **Experimental** - Low usage. Use if you understand the trade-offs.

---

## 🔵 Core Patterns (Always Use)

### Meta Debugging Protocol
**Tier**: 🔵 Core (always)
**When to Use**: Any bug, any issue, any "doesn't work"
**Where Documented**: `META_DEBUGGING_PROTOCOL.md`
**Why Core**: 80% of bugs are input issues. Verify inputs first saves hours.

**Two-phase approach**:
1. Verify inputs first (10 min) - Infrastructure, logs, assumptions
2. Systematic reduction (variable) - Find repro → Narrow → Remove → Root cause

**Example**: Photo alignment bug (90 min wasted debugging perfect algorithm applied to wrong coordinates)

---

### Targeted Operations
**Tier**: 🔵 Core (always)
**When to Use**: File searches, code lookups, any search operation
**Where Documented**: `CLAUDE-APERTURE.md:210-240` (Tool Design Philosophy)
**Why Core**: 10-100x faster than broad operations. Token efficient.

**Prefer**:
- `grep "pattern" --glob "*.tsx"` over reading all files
- Specific queries with filters over fetch-everything-then-filter

---

### Parallel Execution
**Tier**: 🔵 Core (always)
**When to Use**: Multiple independent operations
**Where Documented**: `.claude/startup.md:341-361` (Step 5.6)
**Why Core**: 3x faster than sequential. Standard practice.

**Example**: Run `git status`, `git diff`, `git log` in parallel (single message, 3 tool calls)

---

## 🟢 Reliability-Critical Patterns

### Loop Pattern with Safeguards
**Tier**: 🟢 Reliability-Critical (uploads/payments/auth)
**When to Use**: Retry logic, iterative refinement, progressive workflows
**Where Documented**: `CLAUDE-APERTURE.md:616-895`
**Why Reliability-Critical**: Prevents infinite loops, token waste, user-facing failures

**Required safeguards**:
1. Max attempts (3-5, not 100)
2. Total timeout (30s typical)
3. Explicit success condition
4. Error classification (fatal vs retryable)
5. Progress tracking
6. State logging

**Example**: Photo upload with retry (3 attempts, 30s timeout, exponential backoff)

---

### Validation-Driven Development
**Tier**: 🟢 Reliability-Critical (uploads/APIs/auth/payments)
**When to Use**: Reliability-critical features
**Where Documented**: `.claude/startup.md:264-379`
**Maturity**: 🟡 Learning (cited research, local validation needed)

**Pattern**: Define constraints → Implement validation → Retry with refinement

---

## 🟡 Complex Feature Patterns

### Task Signature Pattern
**Tier**: 🟡 Complex Features (>30 min or cross-session)
**When to Use**: Complex features, user-facing work, unclear requirements
**Where Documented**: `CLAUDE-APERTURE.md:490-587`
**Why Use**: Saves 30-60 min in rework by clarifying upfront

**Template**: `inputs → outputs` + validation criteria + success metrics + constraints

**Example**: Photo gallery pagination (clear contract prevents scope creep)

**Skip when**: Trivial tasks (< 10 min), obvious requirements, one-line fixes

---

### Three-Stage Development
**Tier**: 🟡 Complex Features (>30 min)
**Where Documented**: `SESSION_CHECKLIST.md:84-167`
**Maturity**: 🔴 Rare (aspirational DSPy pattern, no local examples)

**Stages**: Programming → Evaluation → Optimization

**Note**: Experimental. Use Task Signature instead unless you're familiar with DSPy.

---

## 🔴 Experimental Patterns

### Subagent Delegation
**Tier**: 🔴 Experimental (low usage)
**When to Use**: Deep research, codebase analysis, multi-step autonomous tasks
**Where Documented**: `.claude/startup.md:394-421`
**Maturity**: 🟡 Learning (basic usage working, advanced patterns TBD)

**Available agents**: general-purpose, deep-research, codebase-pattern-analyzer, check-and-challenge

**Use sparingly**: Adds coordination overhead. Only use when task truly requires autonomy.

---

## Query Routing & Coordination

### Query Classification & Smart Routing
**When to Use**: Every session start - automatic routing based on user intent
**Where Documented**: `.claude/startup.md:92-197` (Step 1.5)
**Performance Gain**: Saves 20-30% tokens per session

**What it does**:
- Automatically classifies user queries (DEBUG, FEATURE_NEW, RESEARCH, QUICK_FIX, etc.)
- Routes to appropriate patterns and documentation
- Loads only minimal necessary context
- Reduces cognitive load on pattern selection

**Query Types**:
- **DEBUG**: Routes to META_DEBUGGING_PROTOCOL.md
- **FEATURE_NEW**: Routes to Task Signature Pattern
- **RESEARCH**: Launches deep-research subagent
- **QUICK_FIX**: Uses Targeted Operations, skips planning
- **REFACTOR**: Creates Checkpoint first
- **VERIFICATION**: Uses observability tools
- **CONTINUATION**: Reads NEXT_SESSION.md

**Example**: User says "upload doesn't work" → Classified as DEBUG → Loads debugging protocol, skips feature implementation patterns

---

### Loop Pattern with Safeguards
**When to Use**: Retry logic, iterative refinement, progressive workflows
**Where Documented**: `CLAUDE-APERTURE.md:478-758`
**Time Investment**: Prevents infinite loops and token waste

**What it does**:
- Iterative operations with explicit exit conditions
- Required safeguards: max attempts, timeout, success condition, error classification
- Progress tracking and state logging
- Token-aware iteration limits (3-5 max, not 100)

**Required Safeguards**:
1. Maximum iteration limit (e.g., 3 attempts)
2. Total timeout (e.g., 30 seconds)
3. Explicit success condition
4. Error classification (fatal vs retryable)
5. Progress tracking (measurable improvement)
6. State logging (debugging context)

**Example use case**: API retry with exponential backoff, photo upload retry, iterative code refinement

**Anti-pattern**: Unbounded loops, no timeout, no progress validation

---

## Development Patterns

### Task Signature Pattern
**When to Use**: Complex features (> 30 min), cross-session work, user-facing features
**Where Documented**: `CLAUDE-APERTURE.md:352-450`
**Time Investment**: 5-10 min upfront → Saves 30-60 min in rework

**What it does**:
- Define clear `inputs → outputs` contract
- Specify validation criteria (must-have vs should-have)
- Set success metrics (objective completion criteria)
- Document constraints (time, tokens, dependencies, risk)

**Example use case**: Implementing photo gallery pagination, user authentication, payment flow

---

### Three-Stage Development
**When to Use**: User-facing features, data processing, integrations
**Where Documented**: `SESSION_CHECKLIST.md:84-167`
**Time Investment**: Ongoing throughout feature development

**Stages**:
1. **Programming** (Define & Explore) - Define signature, constraints, approach
2. **Evaluation** (Test & Iterate) - Collect test cases, measure metrics, iterate
3. **Optimization** (Refine & Polish) - Address edge cases, improve performance

**Example use case**: Photo upload flow, alignment algorithm, eye detection integration

---

### Validation-Driven Development
**When to Use**: Reliability-critical features (uploads, APIs, authentication, payments)
**Where Documented**: `.claude/startup.md:264-379` (Step 4.6)
**Time Investment**: 10-15 min per critical feature

**Pattern**:
1. Define constraints upfront (must-have vs should-have)
2. Implement validation checks at critical points
3. Add retry with refinement for error recovery

**Performance Impact**:
- Features follow rules up to **164% more often**
- Generate up to **37% better responses**
- Specific tasks improved from 30.5% to 87.2% success rate

**Example use case**: File upload validation, API error handling, payment processing

---

### Separation of Concerns
**When to Use**: Any feature (always applicable)
**Where Documented**: `CLAUDE-APERTURE.md:303-348`
**Time Investment**: 2 min per task

**Pattern**: Explicitly separate **what** (task definition) from **how** (implementation) from **done** (verification)

**Benefits**:
- Prevents scope confusion
- Clearer handoffs between sessions
- Objective completion criteria
- Measurable progress

**Example**: Instead of "Implement photo gallery" → Define WHAT (display photos in grid), HOW (CSS Grid + React state), DONE (all photos accessible, tests pass)

---

## Efficiency Patterns

### Parallel Execution
**When to Use**: Multiple independent operations
**Where Documented**: `.claude/startup.md:400-461` (Step 5.5)
**Performance Gain**: 3x faster execution

**Applies to**:
- File reads that aren't dependent on each other
- Multiple grep/glob searches
- Git status + git diff + git log
- Multiple bash commands that don't depend on each other
- Infrastructure checks across different services

**Example**: Reading 3 component files in parallel instead of sequentially

---

### Subagent Delegation
**When to Use**: Research, code analysis, review tasks that can run in background
**Where Documented**: `.claude/startup.md:463-518` (Step 5.6)
**Performance Gain**: Work continues while agents gather specialized information

**Available Agents**:
- **deep-research**: Understanding APIs, best practices, documentation
- **codebase-pattern-analyzer**: Tracing features, understanding architecture
- **check-and-challenge**: Critical review of completed work
- **docs-writer/docs-reviewer**: Creating/updating user guides

**Example**: Launch deep-research agent to investigate MediaPipe while implementing feature

---

### Background Processes
**When to Use**: Long-running builds, tests, deployments
**Where Documented**: `.process/BACKGROUND_PROCESSES.md`
**Performance Gain**: No blocking on long operations

**Pattern**:
- Start process with `run_in_background: true`
- Continue with other work
- Check output later with `BashOutput` tool

**Example**: Run `npm run build` in background while writing tests

---

### Targeted Operations
**When to Use**: Searching for code, finding implementations
**Where Documented**: `CLAUDE-APERTURE.md:326-371`
**Performance Gain**: 10-100x faster than broad file reads, saves thousands of tokens

**Pattern**: Use `grep` with specific patterns instead of reading entire files

**Examples**:
- ✅ `grep -r "useState" src/components/ --include="*.tsx"`
- ❌ `cat src/components/*.tsx | grep "useState"`

---

## Quality Patterns

### Meta Debugging Protocol
**When to Use**: BEFORE debugging any logic issue
**Where Documented**: `META_DEBUGGING_PROTOCOL.md`
**Performance Gain**: 80% faster bug resolution

**Key Principle**: 80% of bugs are input issues, not logic issues

**Sequence**:
1. Read META_DEBUGGING_PROTOCOL.md
2. Run `/verify-infra` to check infrastructure
3. Verify inputs (what you RECEIVE vs what you EXPECT)
4. Only then debug the algorithm/logic

**Example**: Photo upload fails → Check Supabase bucket exists BEFORE debugging upload code

---

### Observability Requirements
**When to Use**: All new features until UAT passes
**Where Documented**: `.process/DEVELOPMENT.md`, `SESSION_CHECKLIST.md:170-197`
**Performance Gain**: Self-sufficient debugging without asking user for logs

**Requirements**:
- Entry point logging: `console.log('=== FEATURE_NAME START ===')`
- Decision points: Log conditions and chosen paths
- External calls: Log request/response for all API calls
- Errors: Log with full context
- Success: `console.log('✅ FEATURE_NAME COMPLETE')`

**Rule**: If Claude asks "Can you check the Vercel logs?", observability requirements were not met

---

### Checkpoints
**When to Use**: Risky changes, major refactoring, architectural modifications
**Where Documented**: `.claude/startup.md:520-568` (Step 5.7)
**Performance Gain**: Safe experimentation without fear of breaking things

**When to checkpoint**:
- Major refactoring (changing architecture, moving files)
- New feature implementation (significant additions)
- Database migrations or schema changes
- High-risk fixes (touching critical code paths)
- Any change where you think "I hope this works"

**Pattern**:
1. Ensure current state is stable
2. Document what's working, what you'll change, risk level
3. Note current git commit for potential rollback
4. Proceed with changes

**Example**: Before refactoring alignment algorithm, create checkpoint at current working commit

---

## Pattern Selection Guide

### By Task Type

| Task Type | Query Classification | Recommended Patterns |
|-----------|----------------------|---------------------|
| **Bug/Error** | DEBUG | Meta Debugging Protocol → /verify-infra → Targeted Operations |
| **New user-facing feature** | FEATURE_NEW | Task Signature + Three-Stage Development + Observability |
| **API integration** | FEATURE_NEW | Task Signature + Validation-Driven + Loop Pattern (retry) + Observability |
| **Research/investigation** | RESEARCH | Subagent Delegation (deep-research) |
| **Code understanding** | RESEARCH | Targeted Operations + Subagent (codebase-pattern-analyzer) |
| **Major refactor** | REFACTOR | Checkpoint FIRST + Task Signature (if complex) |
| **Quick fix (< 10 min)** | QUICK_FIX | Targeted Operations only - skip planning |
| **Continue work** | CONTINUATION | Read NEXT_SESSION.md → Resume from last task |
| **Verification/Testing** | VERIFICATION | Observability tools (/vercel-logs) + verification commands |

---

### By Complexity

| Complexity | Required Patterns | Optional Patterns |
|------------|-------------------|-------------------|
| **Trivial** (< 10 min) | None | None |
| **Simple** (10-30 min) | TodoWrite | Targeted Operations, Parallel Execution |
| **Complex** (> 30 min) | Task Signature, TodoWrite | Validation-Driven, Three-Stage, Checkpoint |
| **Cross-session** | Task Signature, Checkpoint | Three-Stage, Validation-Driven |

---

### By Reliability Requirements

| Reliability Level | Required Patterns | Example Use Cases |
|-------------------|-------------------|-------------------|
| **Low** (UI-only, no data) | Separation of Concerns | Styling changes, layout updates |
| **Medium** (data display) | Task Signature, Observability | Gallery view, calendar display |
| **High** (data mutation) | Task Signature, Validation-Driven, Observability | Photo upload, user settings |
| **Critical** (security, payments) | All patterns + extensive testing | Authentication, payment processing |

---

## Quick Decision Flowchart

```
New session starts
│
├─ Step 1.5: Classify user query
│  ├─ "doesn't work" / "error" → DEBUG
│  ├─ "implement" / "add" → FEATURE_NEW
│  ├─ "understand" / "explain" → RESEARCH
│  ├─ "fix typo" / "quick change" → QUICK_FIX
│  ├─ "refactor" / "improve" → REFACTOR
│  ├─ "verify" / "test" → VERIFICATION
│  └─ "continue" / "next" → CONTINUATION
│
├─ Route to appropriate pattern
│  ├─ DEBUG → META_DEBUGGING_PROTOCOL.md FIRST
│  ├─ FEATURE_NEW → Check complexity below
│  ├─ RESEARCH → Launch subagent (deep-research)
│  ├─ QUICK_FIX → Targeted Operations, skip planning
│  ├─ REFACTOR → Create Checkpoint FIRST
│  ├─ VERIFICATION → Observability tools
│  └─ CONTINUATION → Read NEXT_SESSION.md
│
├─ Complexity assessment (if FEATURE_NEW)
│  ├─ < 10 min → Just do it
│  ├─ 10-30 min → Use TodoWrite, proceed
│  ├─ > 30 min → Define Task Signature first
│  └─ Cross-session → Task Signature + Checkpoint
│
├─ Reliability assessment
│  ├─ Critical (auth, payments) → Validation-Driven + Loop Pattern
│  ├─ High (uploads, APIs) → Validation-Driven + Loop Pattern (retry)
│  └─ Medium/Low → Standard approach
│
├─ User-facing feature?
│  └─ Yes → Three-Stage Development + Observability
│
├─ Risky change?
│  └─ Yes → Create Checkpoint first
│
├─ Need research/understanding?
│  └─ Yes → Launch Subagent (deep-research or codebase-pattern-analyzer)
│
├─ Iterative/retry logic needed?
│  └─ Yes → Loop Pattern with safeguards (max 3-5 attempts, timeout)
│
└─ Multiple independent operations?
   └─ Yes → Use Parallel Execution
```

---

## Capability Maturity Tracking

Track adoption of each pattern to measure improvement:

| Capability | Current Status | Target | Notes |
|------------|----------------|--------|-------|
| **Query Classification** | 🟢 Adopted | Every session | Auto-routing enabled |
| **Loop Pattern Safeguards** | 🟡 Learning | All retry/iteration logic | New pattern, need practice |
| Task Signature | 🟡 Learning | Use for all complex features | High value when used |
| Three-Stage Dev | 🟡 Learning | Standard for user-facing | Need more practice |
| Validation-Driven | 🟡 Learning | All reliability-critical features | Underutilized |
| Parallel Execution | 🟢 Adopted | Default for independent ops | Second nature |
| Subagent Delegation | 🔴 Rare | Use when applicable | High potential, low usage |
| Targeted Operations | 🟢 Adopted | Default for code search | Standard practice |
| Meta Debugging | 🟢 Adopted | Always before debugging | Critical habit |
| Checkpoints | 🟡 Learning | Before risky changes | Inconsistent usage |

**Legend**:
- 🔴 Rare: < 20% usage when applicable
- 🟡 Learning: 20-60% usage
- 🟢 Adopted: > 60% usage

**New Patterns (Session 14)**:
- ✅ Query Classification & Smart Routing (Google Cloud Coordinator Pattern)
- ✅ Loop Pattern with Safeguards (Google Cloud Loop Pattern)

---

## Sources & Attribution

**Anthropic Principles** (Tool Design Philosophy):
- Source: https://www.anthropic.com/engineering/writing-tools-for-agents
- Applied: Quality over quantity, targeted operations, high-signal output, error context

**DSPy Principles** (Development Patterns):
- Source: Stanford NLP DSPy Framework (https://dspy.ai)
- Applied: Task signatures, three-stage development, validation-driven development, separation of concerns
- Research: 164% better rule-following, 37% better responses with validation framework

**Anthropic Claude Code Best Practices**:
- Parallel execution, subagent delegation, background processes
- Documented in startup.md and project conventions

---

## Learning Path

### Week 1 - Core Habits
Focus on efficiency and debugging fundamentals:
- ✅ Parallel Execution
- ✅ Meta Debugging Protocol
- ✅ Targeted Operations

### Week 2 - Structured Approach
Add planning and structure:
- ✅ Task Signature Pattern
- ✅ Separation of Concerns
- ✅ TodoWrite workflow

### Week 3 - Quality & Reliability
Improve feature quality:
- ✅ Validation-Driven Development
- ✅ Three-Stage Development
- ✅ Observability Requirements
- ✅ Checkpoints

### Week 4 - Advanced Patterns
Maximize efficiency with advanced techniques:
- ✅ Subagent Delegation (research, code analysis)
- ✅ Background Processes
- ✅ Pattern combination strategies

---

**Remember**: These are tools, not rules. Use judgment to select appropriate patterns for each task. The goal is efficient, high-quality work—not checkbox compliance.
