# Development Workflow

> **Version**: 2.0 - Optimized for CI philosophy (Start Minimal, Cost/Benefit)

## 🚨 CRITICAL: Context Window Management

**Most important rule**: AI performance degrades as context grows. Fresh context > struggling with degraded performance.

### When to Start a New Session

**Mandatory fresh start when**:
- ✅ Context window > 100K tokens used
- ✅ Starting completely new feature or project
- ✅ Switching to different part of codebase
- ✅ Noticing degraded response quality (slow, confused, errors)
- ✅ Planning major architectural changes

**Optional fresh start when**:
- ⚠️ Current task completed (natural break point)
- ⚠️ Stuck on problem (fresh perspective helps)
- ⚠️ Multiple tangential discussions (context pollution)

**Continue current session when**:
- ❌ In middle of implementing a plan
- ❌ Debugging with accumulated context
- ❌ Making small related changes
- ❌ Context < 50K tokens and performance good

### Token Budget Health Check

| Token Usage | Status | Action |
|-------------|--------|--------|
| < 50K | ✅ Healthy | Continue normally |
| 50-100K | ⚠️ Warning | Can I finish current task in < 50K more? If no → fresh session |
| > 100K | 🛑 Critical | MANDATORY fresh session |

**Check token usage at**:
- Start of session (in SESSION_CHECKLIST.md)
- Before starting new work
- When noticing degraded quality

### Session Handoff Protocol

**Before closing a session**:
1. Update `NEXT_SESSION.md` (current state, next steps, blockers)
2. Update project `plan.md` (check off completed items)
3. Commit all changes (clean state for next session)

**Starting a new session** (< 5 minutes):
1. Read `NEXT_SESSION.md` (always start here)
2. Read relevant `plan.md` (project-specific state)
3. Quick git check: `git log --oneline -10`

**DON'T**: Try to re-read entire conversation or reload full context.

---

## Core Principle: Plan First, Execute Second

Never go straight from idea to code for non-trivial tasks. **Separate thinking from doing**.

---

## Plan Mode Discipline

### When to Use Plan Mode (Mandatory)
- ✅ Starting any new feature
- ✅ Complex refactoring across multiple files
- ✅ Debugging issues where root cause is unclear
- ✅ Architectural decisions with broad impact

### When to Skip Plan Mode
- ❌ Simple bug fixes (< 5 lines changed)
- ❌ Boilerplate generation
- ❌ Minor styling tweaks
- ❌ Updating documentation only

### The Plan Mode Workflow

1. **Enter Plan Mode**: Press `Shift+Tab` twice in Claude Code
2. **Describe Goal**: High-level objective (not implementation details)
3. **Receive Plan**: Claude researches codebase and generates step-by-step plan
4. **Review & Refine**: 🚨 **NEVER accept first version**
   - Ask clarifying questions
   - Challenge assumptions
   - Request modifications
   - Iterate until plan is robust
5. **Execute**: Exit Plan Mode and implement the agreed plan

### Plan Mode Example

**❌ Bad (No Planning)**:
```
User: "Add authentication to the app"
Claude: [starts generating auth code immediately]
```

**✅ Good (Plan First)**:
```
User: [Shift+Tab twice]
User: "Add authentication to the app"
Claude: [generates plan]
User: "What about password reset flow? And social login?"
Claude: [refines plan]
User: "Perfect, let's execute"
Claude: [implements refined plan]
```

---

## Reasoning Modes (Simplified)

**Two modes - don't overthink it**:

| Mode | When to Use | Example |
|------|-------------|---------|
| **Default** | 90% of work - routine tasks, features, bugs | "Add pagination to user list" |
| **think hard** | 10% of work - critical architecture, security, "impossible" bugs | "think hard about authentication system architecture" |

**Rule**: If unsure, use default. Claude adjusts reasoning automatically. Don't waste time deciding which thinking level to use.

**Red Flag**: If you're using `think hard` frequently, you may have an architecture problem - simplify the system.

---

## Socratic Questioning: Make Claude Ask Questions

The most common AI failure mode: **proceeding on flawed assumptions**.

### The Fix: Invert the Interaction

**Before Claude starts planning or coding**, make it ask questions:

```
"Before you start implementing user authentication,
ask me clarifying questions about the requirements."
```

### What Claude Should Ask
- Edge cases: "What happens if the user's email already exists?"
- Design decisions: "Do you want social login or just email/password?"
- Security: "What's the password strength policy?"
- Integration: "Should this integrate with the existing user management system?"

### When to Use
- ✅ Starting any new feature
- ✅ Implementing based on vague requirements
- ✅ Working in unfamiliar parts of the codebase
- ✅ Security or performance-critical code

---

## Memory Externalization: Write Plans to Disk

**Problem**: Chat history is ephemeral and limited by token count.

**Solution**: Persist critical artifacts to version-controlled markdown files.

### Essential Artifacts

| File | Purpose | When to Create |
|------|---------|----------------|
| **plan.md** | Step-by-step implementation plan with checkboxes | Start of feature work |
| **architecture.md** | System design, schemas, API contracts | Project setup or major refactor |
| **decisions.md** | Architectural Decision Records (ADRs) | Whenever making a significant choice |
| **todo.md** | Dynamic task checklist | Ongoing during development |

### Example Workflow

```
User: "Create a plan for the authentication system and save it to plan.md"
Claude: [generates detailed plan and writes to plan.md]

[Later, in a new session]
User: "Read plan.md and continue implementation from where we left off"
Claude: [picks up seamlessly from saved state]
```

### Why This Matters
- **Persistence**: Survives beyond single chat session
- **Shareability**: Other developers (or AI agents) can read it
- **Version Control**: Track evolution of plans and decisions
- **Foundation for Multi-Agent Work**: Shared state for parallel development

---

## Test-Driven Development (TDD) with AI

TDD is ideal for AI-augmented development. The tight feedback loop constrains the AI and ensures correctness.

### The AI-TDD Workflow

1. **Generate Tests First**
   ```
   "You are now in Test-Driven Development mode.
   Write comprehensive unit tests for the UserProfile component.
   The tests should fail initially."
   ```

2. **Confirm Failure**: Run tests, verify they fail as expected

3. **Implement to Pass**
   ```
   "Write the minimum code to make these tests pass.
   Do NOT modify the test files."
   ```

4. **Iterate**: Claude runs tests, adjusts code until green

5. **Refactor**: Once passing, improve code clarity

### Critical Constraint
**Always include**: "Do NOT modify the test files."

This prevents the AI from "cheating" by changing tests to fit a flawed implementation.

### Testing Constitution
Create `knowledge-base/testing/` directory with:
- `testing-core.md`: Universal rules (framework, mocking, naming)
- `testing-components.md`: React component patterns
- `testing-api.md`: API endpoint patterns

These files provide Claude with context for generating idiomatic tests.

---

## Git Workflow

### Commit Messages (Automated)
Use the `/commit` slash command to generate Conventional Commits:

```bash
git add .
# In Claude: /commit
# Result: "feat(auth): add email magic link authentication"
```

### Branch Strategy
- `main`: Production-ready code
- `feature/[name]`: New features
- `fix/[name]`: Bug fixes
- `refactor/[name]`: Code improvements without behavior change

### PR Reviews (Automated)
Install the Claude Code GitHub App for automatic PR reviews. Configure in `claude-code-review.yml`:
```yaml
focus:
  - logic errors
  - security vulnerabilities
  - performance issues
ignore:
  - style nitpicks
  - minor formatting
```

---

## Development Commands

### Slash Commands
Store in `.claude/commands/` (see `.process/SLASH_COMMANDS.md` for full list)

Essential commands:
- `/commit`: Generate conventional commit message
- `/test`: Generate unit tests for a file
- `/qa`: Code quality review
- `/refactor`: Apply clean code principles

### Creating New Commands
When you write a complex prompt more than twice, convert it to a command:

```markdown
<!-- .claude/commands/api-endpoint.md -->
Generate a new API endpoint with the following:
1. TypeScript types for request/response
2. Input validation with Zod
3. Error handling
4. Unit tests

Endpoint: $ARGUMENTS
```

Usage: `/api-endpoint POST /api/users`

---

## Development Environment

### Required Tools
- **Node.js**: >= 18
- **Package Manager**: npm (or pnpm for monorepos)
- **IDE**: VS Code (with Claude Code extension) or JetBrains
- **Git**: Version control
- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`

### Optional (for Flow State)
```bash
claude --dangerously-skip-permissions
```

**Use when**:
- ✅ Inner-loop development with active supervision
- ✅ Trusted, routine tasks
- ✅ Local environment with version control

**Avoid when**:
- ❌ Wide-ranging refactors
- ❌ Unfamiliar codebase areas
- ❌ Automated CI/CD
- ❌ Production operations

---

## Session Structure

### Start of Session
1. Review `SESSION_CHECKLIST.md`
2. Decide what to build today
3. Read relevant `plan.md` if continuing work

### During Session
4. Use Plan Mode for non-trivial tasks
5. Externalize key decisions to markdown files
6. Capture mistakes immediately in `COMMON_MISTAKES.md`

### End of Session
7. Update `plan.md` with current state
8. Detail captured mistakes
9. Update process docs if patterns emerged

---

## Quick Reference: Decision Tree

```
New Task
│
├─ Trivial? (< 5 lines)
│  └─ Just do it
│
├─ Simple? (clear path, single file)
│  ├─ Describe goal
│  └─ Execute
│
└─ Complex? (multi-file, unclear path)
   ├─ Enter Plan Mode (Shift+Tab x2)
   ├─ Describe goal + ask Claude to ask questions
   ├─ Review plan (iterate!)
   ├─ Save to plan.md
   ├─ Execute plan
   └─ Update plan.md with progress
```

---

**Last Updated**: 2025-10-10 (v2.0 - CI Philosophy Optimized)
**Based On**: Gemini deep research + CI philosophy (Start Minimal)
**Next Review**: After completing wizard-of-oz project

