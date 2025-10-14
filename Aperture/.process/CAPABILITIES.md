# Aperture Capabilities - Quick Reference

> **Purpose**: Fast lookup for available patterns and when to use them
>
> **Last Updated**: 2025-10-14 (Session 14)

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

| Task Type | Recommended Patterns |
|-----------|---------------------|
| **New user-facing feature** | Task Signature + Three-Stage Development + Observability |
| **API integration** | Task Signature + Validation-Driven + Observability |
| **Bug fix (unknown cause)** | Meta Debugging Protocol → Targeted Operations |
| **Major refactor** | Checkpoint + Task Signature (if complex) |
| **Research/investigation** | Subagent Delegation (deep-research) |
| **Code understanding** | Targeted Operations + Subagent (codebase-pattern-analyzer) |
| **Quick fix (< 10 min)** | None - just do it |

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
Starting new task?
│
├─ Complexity assessment
│  ├─ < 10 min → Just do it
│  ├─ 10-30 min → Use TodoWrite, proceed
│  ├─ > 30 min → Define Task Signature first
│  └─ Cross-session → Task Signature + Checkpoint
│
├─ Reliability assessment
│  ├─ Critical (auth, payments) → Validation-Driven Development
│  ├─ High (uploads, APIs) → Validation-Driven Development
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
├─ Debugging?
│  └─ Yes → Meta Debugging Protocol FIRST
│
└─ Multiple independent operations?
   └─ Yes → Use Parallel Execution
```

---

## Capability Maturity Tracking

Track adoption of each pattern to measure improvement:

| Capability | Current Status | Target | Notes |
|------------|----------------|--------|-------|
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
