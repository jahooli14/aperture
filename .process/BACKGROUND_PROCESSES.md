# Background Process Management

> **Purpose**: Guidelines for running long operations without blocking progress
>
> **Benefit**: Better time utilization, more work per session

---

## When to Use Background Processes

**Long-running operations that don't block other work**:
- 🏗️ **Build processes** - `npm run build` (2-5 minutes)
- 🧪 **Test suites** - `npm test` (1-3 minutes)
- 📦 **Large file operations** - Processing, compression, uploads
- 🌐 **Server monitoring** - Watching logs, health checks
- 📥 **Data fetches** - Large API calls, database exports

**DON'T use for**:
- Quick commands (< 10 seconds) - just run normally
- Operations that block next steps - wait for completion
- Interactive commands - require user input

---

## Pattern

### Starting Background Work

**Communication pattern**:
```
I'm starting [operation] in the background - this will take ~[estimated time].

While that runs, I'll:
1. [Other task 1]
2. [Other task 2]
3. [Other task 3]
```

**Implementation**:
```javascript
// Use Bash tool with run_in_background: true
{
  command: "npm run build",
  description: "Build project for production",
  run_in_background: true
}
```

### Checking Progress

**Use BashOutput tool periodically**:
```javascript
{
  bash_id: "shell-123",  // From background process
  filter: "error|warning"  // Optional regex filter
}
```

### Example: Build While Testing

```
I'm starting production build in background (takes 2-3 minutes).

While that runs, I'll:
1. Run unit tests locally
2. Update test coverage reports
3. Review deployment checklist

[Execute: Bash with run_in_background: true]
[Continue with test work]
[Later: BashOutput to check build results]

Build complete - checking results now...
✅ Build succeeded with 0 errors
```

---

## Common Use Cases

### 1. Build + Documentation Update

```
Background: npm run build
Foreground: Update DEPLOYMENT.md with new features
Check back: Verify build succeeded before pushing
```

### 2. Test Suite + Code Review

```
Background: npm test
Foreground: Review code changes for commit message
Check back: Verify tests pass before committing
```

### 3. Log Monitoring + Development

```
Background: Watch production logs (.scripts/vercel-logs.sh)
Foreground: Implement new feature
Check back: Ensure no errors from recent deployment
```

### 4. Multiple Parallel Builds

```
Background 1: npm run build (project A)
Background 2: npm run build (project B)
Foreground: Update shared documentation
Check back: Verify both builds succeeded
```

---

## Best Practices

### DO ✅

1. **Estimate completion time** - Let user know how long
2. **Announce what you'll do meanwhile** - Show continued progress
3. **Check results before proceeding** - Don't assume success
4. **Filter output when checking** - Use regex to find errors/warnings
5. **Keep user informed** - Report when checking background process

### DON'T ❌

1. **Start background then forget** - Always check results
2. **Run interactive commands** - They'll hang waiting for input
3. **Start too many processes** - 2-3 max to avoid confusion
4. **Use for quick tasks** - < 10 sec just run normally
5. **Block on background work** - Defeats the purpose

---

## Error Handling

### If Background Process Fails

```
Checked build results - found errors:
[Show relevant error lines]

I'm going to:
1. Stop current work
2. Fix build errors first
3. Re-run build
4. Continue with original task once stable
```

### If Background Process Hangs

```
Build process appears stuck (no output for 5+ minutes).

Options:
1. Kill process and investigate: KillShell tool
2. Let it continue if expected (large build)
3. Check if interactive input needed (common mistake)

Recommendation: [chosen action]
```

---

## Integration with Other Patterns

### With Parallel Execution

```
I'm running these in parallel:
1. Background: npm run build
2. Read: src/components/*.tsx (3 files)
3. Grep: Search for TODO comments

[Single message with Bash (background) + 3 Read + Grep]
```

### With Subagents

```
I'm launching research agent to investigate best practices (background).

Meanwhile, I'll:
1. Analyze current implementation
2. Identify areas for improvement
3. Review agent findings when ready

[Task tool + Continue with analysis work]
```

### With Checkpoints

```
Creating checkpoint before this change.

Starting:
1. Background: npm test (verify current state)
2. Foreground: Implement new feature

If tests fail after change:
- Rollback instructions available in checkpoint
```

---

## Shell Management Commands

### View Active Shells

```bash
/bashes  # Lists all background shells with IDs
```

### Check Shell Output

```javascript
BashOutput({
  bash_id: "shell-123",
  filter: "error|warning|failed"  // Optional
})
```

### Kill Hanging Shell

```javascript
KillShell({
  shell_id: "shell-123"
})
```

---

## Metrics

**Track efficiency gains**:
- ⏱️ Time saved per session
- 📊 Tasks completed in parallel
- 🎯 Successful background operations

**Example**:
```
Session without background processes:
- Build: 3 min (blocked)
- Tests: 2 min (blocked)
- Total: 5 min sequential = 5 min

Session with background processes:
- Build: 3 min (background)
- Tests: 2 min (foreground during build)
- Total: 3 min parallel = 2 min saved (40% faster)
```

---

## Quick Reference

| Operation | Estimated Time | Good for Background? |
|-----------|---------------|---------------------|
| `npm run build` | 2-5 min | ✅ Yes |
| `npm test` | 1-3 min | ✅ Yes |
| `npm install` | 30-120 sec | ⚠️ Maybe (if large) |
| `git status` | < 1 sec | ❌ No (too fast) |
| Log monitoring | Continuous | ✅ Yes |
| File reads | < 1 sec | ❌ No (too fast) |
| Large grep | 10-30 sec | ⚠️ Maybe |

---

## Success Criteria

**This pattern is working when**:
- ✅ Long operations don't block progress
- ✅ Multiple tasks completed in same timeframe
- ✅ Background processes always checked before proceeding
- ✅ User sees continued progress while waiting

**This pattern is failing when**:
- ❌ Background processes forgotten/not checked
- ❌ Using for quick operations unnecessarily
- ❌ Too many processes causing confusion
- ❌ Interactive commands hung in background

---

---

## 🧭 Navigation

**Where to go next**:
- If starting session → `.claude/startup.md` Step 5 (auto-enforces parallel execution)
- If implementing feature → Apply patterns from this guide during work
- If checking patterns → `CLAUDE-APERTURE.md` Communication Patterns section

**Related documentation**:
- `.claude/startup.md` Step 5 - Parallel execution, subagents, checkpoints
- `CLAUDE-APERTURE.md` - Communication patterns for transparency
- `DOCUMENTATION_INDEX.md` - Find this file under "Process & Learning"

**Referenced by**:
- `.claude/startup.md` Step 5 - Development Patterns mentions background processes
- `CLAUDE-APERTURE.md` - Communication patterns reference this guide
- `DOCUMENTATION_INDEX.md` - Listed in Process & Learning category
