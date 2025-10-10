# Session Checklist

> **Purpose**: Structure each development session for maximum productivity and continuous improvement.
>
> **When**: Review at START of every session, update at END of every session.

---

## 📋 Start of Session (5 minutes)

### 0. Token Budget Health Check (< 1 min)
⚠️ **CRITICAL**: Check this BEFORE starting new work

- [ ] **Check current token usage** (shown at bottom of Claude Code interface)

**Decision tree**:
- **< 50K tokens**: ✅ Healthy - continue
- **50-100K tokens**: ⚠️ Warning zone
  - Ask: "Can I finish current task in < 50K more tokens?"
  - If YES → continue carefully
  - If NO → close session and start fresh
- **> 100K tokens**: 🛑 MANDATORY FRESH SESSION
  - Update NEXT_SESSION.md
  - Commit all changes
  - Start new session with fresh context

**Why this matters**: AI performance degrades with longer context. Fresh context = better quality, faster responses, lower cost.

**Rule**: Don't start NEW work if already > 50K tokens.

---

### 1. Context Loading
- [ ] Read last session's updates in relevant `plan.md`
- [ ] Review recent entries in `.process/COMMON_MISTAKES.md`
- [ ] Check if any placeholders are ready to implement (see checklist below)

### 2. Today's Focus
**What are we building today?**

Options:
- [ ] Continue existing project: `projects/[name]/plan.md`
- [ ] Start new project: Create new directory
- [ ] Process improvement: Update `.process/` docs
- [ ] Bug fix or refactor: Specific issue

**Selected**: _________________________________

### 3. Pre-Flight Infrastructure Check (< 2 min)
⚠️ **Run BEFORE debugging** when feature "doesn't work"

- [ ] **If debugging issue**: Run `/verify-infra [project-name]`
  - Checks: Database tables, storage buckets, env vars, deployment settings
  - **Rule**: If debugging > 10 min without progress → run this command
  - Catches 80% of "code looks fine but doesn't work" issues

- [ ] **If unsure which project**: Run `/which-project`
  - Auto-detects NUDJ vs Aperture
  - Shows which CLAUDE.md to read

### 4. Readiness Check
- [ ] Environment configured (dependencies installed)
- [ ] Credentials available (if needed for new features)
- [ ] Relevant docs read (project README, architecture.md)

### 5. Placeholder Decision Point
**Is today the day we implement?**

- [ ] **Subagents**: Has a task been repeated 5+ times? → See `.process/SUBAGENTS.md`
- [ ] **Multi-agent orchestration**: Do we need parallel work streams? → Evaluate cost/benefit
- [ ] **Custom SDK tools**: Do we have a specific high-value integration need?
- [ ] **Testing automation**: Has manual testing become a bottleneck?
- [ ] **CI/CD enhancement**: Are we deploying frequently enough to benefit?

**Decision**: _________________________________

---

## 🎯 During Session (Continuous)

### Task Tracking (Single System)

**ONE tool for tracking tasks**: TodoWrite tool during active work

**For non-trivial features (> 30 min work)**:
1. Use TodoWrite to create task list BEFORE starting
2. Mark tasks in_progress/completed as you work
3. At session end: Update NEXT_SESSION.md with summary

```markdown
Example TodoWrite usage:
- [ ] Setup: Install dependencies (5 min)
- [ ] Implement: Create component (20 min)
- [ ] Test: Manual QA (10 min)
- [ ] Document: Update README (5 min)
```

**Benefits**:
- Single source of truth (no duplicate tracking)
- Real-time progress visibility
- Nothing gets forgotten
- Easy to resume if interrupted

**DON'T**:
- ❌ Maintain separate todo.md file
- ❌ Track same tasks in multiple places
- ❌ Write tasks in both TodoWrite AND plan.md
- ✅ USE: TodoWrite during work → NEXT_SESSION.md at end

---

### Immediate Capture (as they happen)

#### Mistakes Made
```markdown
## [Date] | [Category] | [Title]
**What Happened**: [One sentence]
**Next**: Detail at session end
```
→ Add to `.process/COMMON_MISTAKES.md`

#### Important Decisions
```markdown
## [Date] | [Decision Title]
**Context**: [Why this came up]
**Decision**: [What we chose]
**Rationale**: [Key reasons]
```
→ Add to project's `decisions.md`

#### Lessons Learned
- Quick notes for reflection at session end
- Patterns that emerged
- Things that worked surprisingly well
- Things that were harder than expected

---

## ✅ End of Session (10-15 minutes)

### 1. Update Project State
- [ ] Update `projects/[name]/plan.md` with:
  - [ ] Completed tasks (check boxes)
  - [ ] Current state (what works now)
  - [ ] Next steps (what to do next session)
  - [ ] Blockers (if any)

### 2. Detail Captured Mistakes
For each mistake captured during session:
- [ ] Expand with full context
- [ ] Document the fix
- [ ] Add prevention strategy
- [ ] Reference updated process docs

### 3. Reflect on Patterns
**What worked well today?**
- _______________________________________________
- _______________________________________________

**What slowed us down?**
- _______________________________________________
- _______________________________________________

**What should we change in our process?**
- _______________________________________________
- _______________________________________________

### 4. Update Process Docs (if needed)
- [ ] `.process/ARCHITECTURE.md`: New patterns or principles?
- [ ] `.process/DEVELOPMENT.md`: New workflows discovered?
- [ ] `.process/TESTING_GUIDE.md`: New testing patterns?
- [ ] `.process/COMMON_MISTAKES.md`: Already done during session
- [ ] `knowledge-base/`: New reusable knowledge?

### 5. Create/Update Slash Commands
Did we write a complex prompt more than once?
- [ ] Convert to `.claude/commands/[name].md`
- [ ] Test the command
- [ ] Document in `.process/SLASH_COMMANDS.md`

### 6. Commit Progress
```bash
git add .
git commit -m "session: [brief summary of work done]"
# Use /commit command for detailed conventional commit
```

---

## 📊 Session Metrics (Optional)

Track these to understand velocity:

| Metric | This Session | Goal |
|--------|--------------|------|
| Tasks completed | ___ | 3-5 |
| Plan Mode uses | ___ | 1+ (for non-trivial work) |
| Mistakes captured | ___ | 1+ (we always learn something) |
| Process docs updated | ___ | As needed |
| Commands created | ___ | As needed |

---

## 🔄 Continuous Improvement Tracker

### Placeholder Status (Review each session)

| Feature | Status | Decision Criteria | Last Evaluated |
|---------|--------|-------------------|----------------|
| **Subagents** | 🔮 Placeholder | Task repeated 5+ times | 2025-10-10 |
| **Multi-agent** | 🔮 Placeholder | Need parallel work streams | 2025-10-10 |
| **Custom SDK** | 🔮 Placeholder | Specific integration need | 2025-10-10 |
| **Advanced Testing** | 🔮 Placeholder | Manual testing bottleneck | 2025-10-10 |
| **CI/CD Pipeline** | 🔮 Placeholder | Frequent deployments | 2025-10-10 |

**Key**:
- 🔮 Placeholder: Not implemented yet
- 🚧 In Progress: Currently building
- ✅ Active: Implemented and in use
- ❌ Deprecated: Removed (didn't provide value)

### Process Health Check

| Indicator | Current State | Target | Action Needed |
|-----------|---------------|--------|---------------|
| Plan Mode usage | ___% of non-trivial tasks | 100% | None / Reminder needed |
| Mistakes captured | ___ per session | 1+ | Good / Need better awareness |
| Process docs updated | Last: _______ | Within 5 sessions | Up to date / Needs refresh |
| Team velocity | Feeling: _______ | Fast & sustainable | On track / Need to simplify |

---

## 🎯 Next Session Preview

**Prepare for next time**:
- [ ] What to tackle next: _________________________________
- [ ] Blockers to resolve: _________________________________
- [ ] Research needed: _________________________________
- [ ] Questions to answer: _________________________________

---

## 📝 Template: Quick Session Log

Use this for rapid session logging:

```markdown
## Session: [Date] - [Brief Focus]

**Goal**: [What we set out to do]
**Completed**: [What we actually finished]
**Learned**: [Key insights]
**Next**: [Top priority for next session]
```

---

**Created**: 2025-10-10
**Last Session**: [Update this each session]
**Total Sessions**: 1 (wizard-of-oz initial build)

---

## 🔄 Session Handoff (Context Window Management)

### Context Health Check

**Before continuing or closing**:

Current metrics:
- [ ] Token usage: ______K (< 50K = healthy, 50-100K = watch, > 100K = start fresh)
- [ ] Response quality: Clear / Occasional confusion / Frequent errors
- [ ] Response time: Fast (< 10s) / Slower (10-30s) / Very slow (> 30s)

**Decision**: 
- [ ] Continue this session (< 50K tokens, good performance)
- [ ] Close and start fresh (> 100K tokens or degraded quality)

### Before Closing This Session

**Required actions**:

1. [ ] **Update `NEXT_SESSION.md`**
   - Current status (what's done)
   - Immediate next steps (what to do next)
   - Key context (important decisions/files)
   - Blockers (if any)
   - Session metrics (tokens, quality)

2. [ ] **Update project `plan.md`**
   - Check off completed items
   - Add any new items discovered
   - Update "Current State" section
   - Document blockers

3. [ ] **Session log** (add to NEXT_SESSION.md or plan.md)
   ```markdown
   ## Session: [Date] - [Focus]
   **Goal**: [What we set out to do]
   **Completed**: [What we finished]
   **Next**: [Top priority for next session]
   **Blockers**: [Any blockers]
   **Tokens**: [Usage at session end]
   ```

4. [ ] **Commit all changes**
   ```bash
   git add .
   /commit  # Use slash command for conventional commit
   git push
   ```

### Starting Next Session (Fresh Context)

**Efficient onboarding (5 minutes)**:

1. [ ] **Read `NEXT_SESSION.md`** (ALWAYS start here)
2. [ ] **Read relevant `plan.md`** (project-specific state)
3. [ ] **Quick git check**: `git log --oneline -10`
4. [ ] **Context check**: Read 1-2 key files mentioned in NEXT_SESSION.md

**Don't**:
- ❌ Try to reload full conversation history
- ❌ Ask "what were we working on?"
- ❌ Spend > 5 minutes on context loading

**Philosophy**: Well-documented state > trying to preserve context

