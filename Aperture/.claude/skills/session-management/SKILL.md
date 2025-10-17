---
name: session-management
description: Manages session continuity, startup checklists, and task handoffs between Claude Code sessions to ensure seamless workflow across work periods
---

# Session Management

## Purpose

Ensures seamless continuity between Claude Code sessions through structured startup procedures, status checking, and task handoff workflows.

## When to Activate

**Auto-activate on:**
- New session starts
- User asks "what's next?" or "what should I work on?"
- User mentions "continue from last time" or "where were we?"

**Manually invoke when:**
- Switching between tasks
- Reviewing project status
- Planning next work session
- Ending a session and documenting progress

## Session Startup Checklist

### Phase 1: Quick Orientation (30 seconds)

```bash
# 1. Detect project type
./.claude/skills/aperture-router/detect-project.sh

# 2. Check current status
cat NEXT_SESSION.md | head -50

# 3. Review git state
git status
git log --oneline -5
```

### Phase 2: Context Loading (60 seconds)

- Read `NEXT_SESSION.md` completely
- Identify current status (🟢 Working / 🟡 In Progress / 🔴 Blocked)
- Note any blockers
- Understand next steps
- Review recent git history

### Phase 3: Readiness Verification (30 seconds)

Confirm you know:
- ✅ Which project (Aperture/NUDJ)
- ✅ Current state (working/broken/deployed)
- ✅ Priority task
- ✅ Blockers (if any)
- ✅ Sufficient context from previous sessions

### Communication Format

After startup, respond with:

```
✅ Project: [Aperture]
📋 Status: [Status badge and description from NEXT_SESSION.md]
🎯 Task: [What you'll work on next]
🚀 Ready: [Confirmation you can proceed]

[Brief context summary]
```

## Reading NEXT_SESSION.md

**Extract:**
- **Status Badge**: 🟢 Working, 🟡 In Progress, 🔴 Blocked
- **Current Focus**: Active feature/task
- **Blockers**: What's preventing progress
- **Next Steps**: Prioritized task list
- **Recent Changes**: What was just completed

**Interpretation:**
```
🟢 Green  → System working, ready for new features
🟡 Yellow → Work in progress, continue current task
🔴 Red    → Blocked, resolve blocker before proceeding
```

## Session Handoff Pattern

### Before Ending a Session

Update `NEXT_SESSION.md` with:

```markdown
## Current Status
- **Status**: [🟢/🟡/🔴]
- **Active Task**: [What you were working on]
- **Completion**: [Percentage done, what's left]

## What Works
- [Feature X] is working end-to-end
- [Component Y] renders correctly
- Tests passing for [Module Z]

## Blockers
- [Issue 1]: [Description and context]
- [Issue 2]: [Why it's blocking]

## Next Steps
1. [Most important task]
2. [Second priority]
3. [Nice to have]

## Context for Next Session
[Any important context not obvious from code]
```

### Starting a New Session

1. Read `NEXT_SESSION.md`
2. Verify "What Works" is still true
3. Check if blockers are resolved
4. Continue from "Next Steps" list

## Task Prioritization

### High Priority (Do First)
1. **Blockers** - Things preventing progress
2. **Production Issues** - Breaking live features
3. **In-Progress Work** - Don't leave half-done

### Medium Priority (Do Next)
4. **Next Planned Features** - From NEXT_SESSION.md
5. **User Requests** - What user explicitly asked for
6. **Technical Debt** - Cleanup and improvements

### Low Priority (Do Later)
7. **Nice-to-Haves** - Optional enhancements
8. **Exploration** - Research and experiments
9. **Documentation** - Non-critical docs

## Status Checking Commands

**Quick parallel status check:**

```bash
echo "=== Git Status ===" && git status --short && \
echo "=== Recent Work ===" && git log --oneline -5 && \
echo "=== Current Branch ===" && git branch --show-current
```

**Detailed status:**

```bash
cat NEXT_SESSION.md
ls -lt knowledge-base/changelogs/ | head -5
```

## Cross-Session Documentation

### Primary Files
- **NEXT_SESSION.md** - Current status & immediate tasks
- **START_HERE.md** - Session onboarding guide
- **SESSION_CHECKLIST.md** - Detailed workflow guide
- **CONTRIBUTING.md** - Contribution guidelines

### Knowledge Base
- **knowledge-base/changelogs/** - Daily progress logs
- **knowledge-base/audit-trail/** - Detailed work history
- **.process/COMMON_MISTAKES.md** - Lessons learned

## Communication Patterns

### Session Start

```
✅ Project Detected: Aperture
📋 Status: 🟢 Working - Upload functional, alignment in progress
🎯 Active Task: Implement client-side photo alignment
🚀 Ready to: Continue alignment implementation

Context: Upload and eye detection are working. Need to implement
Canvas-based alignment using detected eye coordinates.
```

### During Work

Keep user informed of:
- What you're doing
- Why you're doing it
- What's working
- Any issues encountered

### Session End

Remind user of:
- What was accomplished
- What's left to do
- Any new blockers
- Where to pick up next time

## Best Practices

### DO:
- ✅ Always read NEXT_SESSION.md first
- ✅ Check git status before starting
- ✅ Update documentation after tasks
- ✅ Communicate context clearly
- ✅ Ask when priorities unclear

### DON'T:
- ❌ Start coding without status check
- ❌ Assume previous work still works
- ❌ Skip documentation updates
- ❌ Work on low priority when blockers exist
- ❌ Forget to capture session progress

## Integration with Other Skills

**With aperture-router:**
- Use router to identify project
- Load correct documentation
- Understand project context

**With wizard-of-oz:**
- Check application status
- Understand feature state
- Know deployment status

**With development-workflow:**
- Know which commands to run
- Understand build state
- Check test status

## Additional Resources

See `session-checklist.md` in this skill directory for:
- Detailed startup procedures
- Task completion checklists
- Quality check guidelines
- Quick reference commands

## Success Criteria

A good session handoff means:
- ✅ Next session can start immediately
- ✅ No confusion about what to do
- ✅ Context is preserved
- ✅ Progress is documented
- ✅ Blockers are clear and actionable
