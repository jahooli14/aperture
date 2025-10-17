# Session Management Checklist

A quick reference for starting and ending Claude Code sessions.

## 🚀 Starting a New Session

### Immediate Actions (30 seconds)
```bash
# 1. Detect project
./.claude/skills/aperture-router/detect-project.sh

# 2. Check status
cat NEXT_SESSION.md | head -50

# 3. Git status
git status
```

### Context Loading (60 seconds)
- [ ] Read NEXT_SESSION.md completely
- [ ] Identify current status (🟢/🟡/🔴)
- [ ] Note any blockers
- [ ] Understand next steps
- [ ] Review recent git history

### Readiness Verification (30 seconds)
- [ ] Know which project (Aperture/NUDJ)
- [ ] Know current state (working/broken/deployed)
- [ ] Know priority task
- [ ] Know blockers (if any)
- [ ] Have sufficient context

### Communication
```
✅ Project: [Aperture]
📋 Status: [Status badge and description]
🎯 Task: [What you'll work on]
🚀 Ready: [Confirmation you can proceed]
```

---

## 🛠️ During Active Work

### Before Starting Each Task
- [ ] Understand the goal
- [ ] Know success criteria
- [ ] Identify dependencies
- [ ] Plan verification steps

### While Working
- [ ] Test incrementally
- [ ] Commit logical chunks
- [ ] Update user on progress
- [ ] Document tricky decisions

### Task Completion Checklist
- [ ] Feature works as intended
- [ ] Tests pass (if applicable)
- [ ] Code builds without errors
- [ ] Changes committed with clear message
- [ ] Documentation updated (if needed)

---

## 📝 Ending a Session

### Immediate Capture (Before losing context)
Update NEXT_SESSION.md with:
- [ ] Current status badge (🟢/🟡/🔴)
- [ ] What was accomplished
- [ ] What's still in progress
- [ ] Any new blockers
- [ ] Next steps (prioritized)

### Git Cleanup
- [ ] All work committed OR
- [ ] Clear WIP state documented
- [ ] Branch state clear
- [ ] No unexpected changes

### Documentation Updates
- [ ] NEXT_SESSION.md reflects current state
- [ ] Any lessons learned captured in .process/COMMON_MISTAKES.md
- [ ] Changelog updated (if significant work)
- [ ] Session notes in knowledge-base/ (optional)

### Handoff Communication
```
✅ Session Summary:
   - Completed: [What was finished]
   - In Progress: [What's partially done]
   - Next: [What to do next time]
   - Blockers: [Any issues]
```

---

## 🔄 Context Switching

### When Switching Tasks
- [ ] Commit current work
- [ ] Update NEXT_SESSION.md with task status
- [ ] Clear mental context
- [ ] Load new task context from docs

### When Switching Projects
- [ ] Commit all changes
- [ ] Update current project documentation
- [ ] Run project detection for new project
- [ ] Load new project context

---

## 🎯 Priority Management

### High Priority (Do First)
1. **Blockers** - Things preventing progress
2. **Production Issues** - Things breaking live features
3. **In-Progress Work** - Don't leave things half-done

### Medium Priority (Do Next)
4. **Next Planned Features** - From NEXT_SESSION.md
5. **User Requests** - What user specifically asked for
6. **Technical Debt** - Cleanup and improvements

### Low Priority (Do Later)
7. **Nice-to-Haves** - Optional enhancements
8. **Exploration** - Research and experiments
9. **Documentation** - Nice-to-have docs (required docs are high priority)

---

## 🚨 When Things Go Wrong

### If You're Blocked
1. Document the blocker in NEXT_SESSION.md
2. Include what you tried
3. Note what information is needed
4. Switch to unblocked task
5. Ask user for help/input

### If Tests Are Failing
1. Don't commit broken code
2. Document what's failing
3. Try to isolate the issue
4. Consider reverting recent changes
5. Capture repro steps

### If Build Is Broken
1. Check TypeScript errors first
2. Check for missing dependencies
3. Verify environment variables
4. Try clean install
5. Document the error state

---

## 📊 Quality Checks

### Before Committing
- [ ] Code builds successfully
- [ ] No TypeScript errors
- [ ] Linting passes (or justified)
- [ ] Tests pass (if applicable)
- [ ] Changes match intention

### Before Ending Session
- [ ] Documentation reflects reality
- [ ] Next steps are actionable
- [ ] Context is captured
- [ ] No loose ends (or documented WIP)

### Before Deployment
- [ ] Local build succeeds
- [ ] Manual testing completed
- [ ] Breaking changes documented
- [ ] Environment vars configured
- [ ] Rollback plan exists

---

## 💡 Tips for Better Sessions

### Optimize for Handoffs
- Write documentation for "future you"
- Assume zero context in next session
- Make next steps explicit and actionable
- Capture "why" not just "what"

### Maintain Momentum
- Keep tasks small and completable
- Commit early and often
- Test incrementally
- Don't leave things half-done

### Communicate Clearly
- Update user frequently
- Explain your reasoning
- Ask when uncertain
- Confirm before major changes

### Preserve Context
- Document tricky decisions
- Capture failed approaches
- Note surprising behavior
- Link to relevant resources

---

## 🔗 Related Resources

- **NEXT_SESSION.md** - Current status and tasks
- **START_HERE.md** - New session onboarding
- **.process/COMMON_MISTAKES.md** - Lessons learned
- **CLAUDE-APERTURE.md** - Project documentation
- **.claude/skills/** - All available skills
