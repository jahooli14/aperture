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

**🚨 NEW RULE: Update NEXT_SESSION.md During Session, Not Just At End**

**When to update NEXT_SESSION.md**:
1. ✅ **After completing a major phase** (don't wait until end)
2. ✅ **After a breakthrough or pivot** (document immediately)
3. ✅ **When changing approach** (update before proceeding)
4. ✅ **Before closing session** (final update)

**Why this matters**:
- Prevents drift between documented plan and actual progress
- Ensures continuity if session runs out of tokens mid-work
- Fresh sessions can pick up exactly where you left off
- Captures breakthroughs while context is fresh

**Before closing a session**:
1. **Update `NEXT_SESSION.md`** (current state, next steps, blockers)
   - Remove completed phases
   - Add new next steps based on what you learned
   - Document any breakthroughs or pivots
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

## Task List Standards

### Task Format with Verification Commands

**Every task in a checklist MUST include verification steps when applicable.**

**Template**:
```markdown
- [ ] <Action to take>
  - <Implementation detail 1>
  - <Implementation detail 2>
  - Verify: `<command to run>`
  - Expected: <what you should see>
  - If fail: <troubleshooting step>
```

**Examples**:

✅ **GOOD** - Has verification:
```markdown
- [ ] Deploy new alignment function to Vercel
  - Update `api/align-photo-v4.ts` with coordinate scaling
  - Add Python subprocess call to OpenCV script
  - Verify: `git push origin main` triggers deployment
  - Verify: Deployment logs at vercel.com/deployments show success
  - Verify: `/vercel-logs align-photo 10` shows no errors
  - Expected: Logs show "Alignment completed in X seconds"
  - If fail: Check Vercel environment variables are set
```

❌ **BAD** - No verification:
```markdown
- [ ] Deploy new alignment function
```

### Task Update Rules

**When to update task lists**:
1. ✅ After completing a task (mark with `[x]`)
2. ✅ After discovering subtasks (add to list)
3. ✅ When verification fails (add troubleshooting tasks)
4. ✅ After major phases (update CLAUDE-APERTURE.md tasks section)

**Where to maintain tasks**:
- **CLAUDE-APERTURE.md** - High-level current sprint tasks (single source of truth)
- **NEXT_SESSION.md** - Detailed implementation steps for current work
- **TodoWrite tool** - Session-scoped ephemeral task tracking

### Verification Command Categories

**Build verification**:
```markdown
- Verify: `npm run build` succeeds
- Expected: No TypeScript errors, build output in dist/
```

**Deployment verification**:
```markdown
- Verify: `git push origin main` triggers Vercel deployment
- Verify: Deployment at vercel.com shows "Ready"
- Verify: `/vercel-logs [function] 10` shows successful execution
```

**Functional verification**:
```markdown
- Verify: Upload test photo via UI
- Expected: Photo processes in < 10 seconds
- Verify: Download aligned result and check eye positions
- Expected: Eyes at (360, 432) and (720, 432) ±5px
```

**Infrastructure verification**:
```markdown
- Verify: `/verify-infra wizard-of-oz` passes all checks
- Expected: ✅ Database tables exist, ✅ Storage buckets configured
```

---

## Decision Documentation & Source Citation

### When to Cite Sources

**Required for**:
- ✅ Architectural decisions
- ✅ Choosing between multiple approaches
- ✅ Following documented patterns or protocols
- ✅ Major refactoring decisions
- ✅ Security or performance choices

**Not required for**:
- ❌ Simple bug fixes
- ❌ Minor style changes
- ❌ Boilerplate generation
- ❌ Documentation updates

### Citation Format

**Pattern**: `Based on <file_path:line_number>, which states "<quote>", I will <action>.`

**Examples**:

✅ **Architectural Decision**:
```
Based on .process/ARCHITECTURE.md:45-52, which states "Start Minimal -
always ask what's the minimum viable implementation", I will implement
basic authentication with email/password only, deferring social login
until we validate the feature is needed.
```

✅ **Following Debugging Protocol**:
```
Based on META_DEBUGGING_PROTOCOL.md:88-92, which states "verify inputs
before debugging algorithm", I'm first checking that eye coordinates are
scaled correctly before debugging the alignment transform logic.
```

✅ **Pattern Compliance**:
```
Based on CLAUDE-APERTURE.md:151-158, which shows the pattern for separate
camera and gallery inputs, I will create two <input> elements with distinct
refs instead of a single input with conditional capture.
```

### Decision Records

**For major architectural choices, document in `.process/DECISION_LOG.md`**:

```markdown
## 2025-10-12 | Use Python OpenCV Instead of JavaScript Sharp

**Context**: Photo alignment requires affine transformation with rotation,
scale, and translation. JavaScript Sharp library doesn't support full affine
transforms.

**Decision**: Use Python OpenCV via subprocess, called from Node.js API.

**Alternatives Considered**:
1. Manual JavaScript coordinate math - REJECTED (error-prone, we tried this)
2. Sharp with manual rotation - REJECTED (insufficient - no translation)
3. Different JS library (jimp, canvas) - REJECTED (performance concerns)
4. Python OpenCV - SELECTED

**Rationale**:
- OpenCV has cv2.estimateAffinePartial2D - exactly what we need
- Well-tested, industry standard
- Python subprocess adds ~100ms overhead (acceptable)
- Eliminates error-prone manual coordinate tracking

**Source**: Research documented in NEXT_SESSION.md:Phase 3

**Consequences**:
- Adds Python runtime dependency to Vercel deployment
- Requires opencv-python-headless package
- Adds subprocess communication complexity (mitigated by simple API)
```

---

## Code Output Standards

### When to Show Full Files vs Use Edit Tool

**Show full file when**:
- File is < 200 lines after modification
- Creating a new file
- Major refactoring (> 30% of file changed)
- User explicitly requests full file

**Use Edit tool when**:
- File is > 200 lines and < 30% changed
- Precise single-function updates
- Small bug fixes (< 10 lines)
- Multiple small changes across large file

### Code Output Format

**Always include**:
1. File path with line numbers for references
2. Brief context: What changed and why
3. Verification step if applicable

**Example**:

```typescript
// projects/wizard-of-oz/api/align-photo-v4.ts

// CHANGE: Add coordinate scaling before passing to OpenCV
// WHY: Database stores coordinates for 768x1024 downscaled images,
//      must scale to actual image dimensions
// SOURCE: DEBUGGING_CHECKLIST.md:45-52

const scaleFactor = actualImageWidth / detectionImageWidth;
const scaledCoords = {
  leftEye: {
    x: dbCoords.leftEye.x * scaleFactor,
    y: dbCoords.leftEye.y * scaleFactor
  },
  rightEye: {
    x: dbCoords.rightEye.x * scaleFactor,
    y: dbCoords.rightEye.y * scaleFactor
  }
};

// Verify: Log dimensions to confirm scaling is correct
console.log(`Scaling coordinates: ${detectionImageWidth}px → ${actualImageWidth}px (${scaleFactor}x)`);
```

### Code Comments Standards

**Required comments**:
- **WHY** the code exists (not WHAT it does - that should be obvious)
- Source citations for non-obvious patterns
- Edge case handling explanations
- Performance optimization rationale

**Avoid comments for**:
- Self-explanatory code
- Redundant descriptions of obvious operations
- Commented-out code (delete it)

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

## Observability Requirements: Self-Sufficient Debugging

**Core Principle**: Claude must NEVER ask users to check external logs. All debugging information must be accessible programmatically or through comprehensive in-code logging.

### The Problem

When Claude asks "Can you check the Vercel logs?", it creates friction:
- User must context-switch to Vercel dashboard
- User must manually copy/paste logs back
- Slows down debugging cycle
- User becomes a bottleneck in the development loop

### The Solution: Two-Path Strategy

#### Path A: Programmatic Log Access (Preferred)
- Use Vercel API to fetch logs directly via scripts/commands
- Create `/vercel-logs [function]` slash command
- Claude can debug autonomously without user involvement
- **Setup**: Requires Vercel API token (one-time setup)

#### Path B: Comprehensive In-Code Logging (Fallback)
- All new features include extensive console logging by default
- Logging remains until feature passes User Acceptance Testing (UAT)
- After UAT approval, clean up logging as final step
- **Use when**: Vercel API not configured or for quick iterations

### Logging Requirements for New Features

**Every new feature MUST include**:

1. **Entry Point Logging**
   ```typescript
   console.log('=== FEATURE_NAME START ===');
   console.log('Input:', { param1, param2 });
   ```

2. **Decision Point Logging**
   ```typescript
   console.log('Condition check:', { condition: value, result: true/false });
   if (condition) {
     console.log('Taking path A because:', reason);
   }
   ```

3. **External Call Logging**
   ```typescript
   console.log('Calling external API:', { url, method, payload });
   const response = await fetch(...);
   console.log('External API response:', {
     status: response.status,
     ok: response.ok,
     bodyPreview: body.substring(0, 200)
   });
   ```

4. **Error Logging**
   ```typescript
   catch (error) {
     console.error('❌ Feature failed at step X:', error);
     console.error('Context:', { relevantState, relevantData });
     throw error; // Re-throw to maintain error propagation
   }
   ```

5. **Success Logging**
   ```typescript
   console.log('✅ FEATURE_NAME COMPLETE');
   console.log('Result:', { outputSummary });
   ```

### Logging Lifecycle

```
Development → Deploy → Monitor → UAT → Clean Up Logs → Done
                ↑                      ↓
                └──── Bug Found ───────┘
                      (keep logs)
```

**Stages**:
1. **Development**: Add comprehensive logging to new feature
2. **Deploy**: Push with logs intact
3. **Monitor**: Claude checks logs to verify functionality
4. **UAT**: User tests feature in production
5. **Clean Up**: If UAT passes, remove excessive logs (keep critical error logs)
6. **Done**: Feature is production-ready with minimal logging

### When to Keep vs. Remove Logs

**Keep Forever** (production logs):
- ❌ Errors and exceptions
- ❌ Security events (auth failures, permission denials)
- ❌ Business-critical operations (payments, data deletion)
- ❌ Performance metrics

**Remove After UAT** (debug logs):
- ✅ "Step 1, Step 2, Step 3" progress logs
- ✅ Intermediate calculation values
- ✅ "Entering function X" / "Exiting function Y"
- ✅ Verbose object dumps for debugging

### Structured Logging Format

Use consistent format for easy parsing:

```typescript
// Good: Structured and parseable
console.log('Action:', 'user_upload', {
  userId: '123',
  fileName: 'photo.jpg',
  fileSize: 2048000,
  timestamp: Date.now()
});

// Bad: Unstructured text blob
console.log('User 123 uploaded photo.jpg which is 2048000 bytes');
```

### Logging Anti-Patterns

**❌ Don't**:
- Log sensitive data (passwords, tokens, PII)
- Use `console.log()` for user-facing messages (use proper error handling)
- Log inside tight loops (causes performance issues)
- Mix logging with application logic (keep logs separate)
- Assume logs will always be available (add graceful degradation)

**✅ Do**:
- Use semantic prefixes (`✅`, `❌`, `⚠️`, `🎯`) for visual scanning
- Include context (what operation, what data, what state)
- Log before and after external calls
- Use consistent naming conventions
- Add timestamps for performance debugging (Vercel adds these automatically)

### Integration with Development Workflow

**Updated Feature Development Cycle**:

```markdown
1. Plan feature (Plan Mode)
2. Implement with comprehensive logging
3. Deploy to Vercel
4. Claude checks logs (self-debug)
5. Fix issues if found
6. User UAT
7. If UAT passes: Clean up logs, redeploy
8. If UAT fails: Keep logs, fix issues, repeat from step 3
```

**SESSION_CHECKLIST.md Integration**:
- Add observability check before marking feature "done"
- Verify logs are accessible (Claude can read them)
- Confirm UAT passed before log cleanup

### Future Enhancements

**Phase 1** (current): Comprehensive console logging
**Phase 2** (future): Vercel API integration for programmatic log access
**Phase 3** (future): Structured logging service (Datadog, LogRocket, etc.)

**Decision Point**: Move to Phase 2/3 when:
- Console logging becomes insufficient (complex multi-function flows)
- Need historical log analysis (beyond Vercel's retention period)
- Multiple developers need log access

Until then: **Start Minimal** - console logs are sufficient.

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

