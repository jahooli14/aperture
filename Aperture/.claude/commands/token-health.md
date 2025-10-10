# Token Health Check Command

**Purpose**: Quick visual check of current context window health.

**Usage**: `/token-health`

---

## What This Command Does

Displays current token usage status with actionable recommendations based on your context health.

---

## Output Format

```
🔍 Context Window Health Check
===============================

Current Token Usage: [ACTUAL_TOKEN_COUNT]K / 200K

Status: [HEALTH_INDICATOR]

[VISUAL_BAR]

Recommendation: [ACTION_TO_TAKE]
```

---

## Health Indicators

### ✅ Healthy (< 50K tokens)
```
Status: ✅ HEALTHY

████░░░░░░░░░░░░░░░░ 25%

Recommendation: Continue normally
- Good performance
- Full context available
- No action needed
```

### ⚠️ Warning Zone (50-100K tokens)
```
Status: ⚠️ WARNING ZONE

█████████░░░░░░░░░░░ 60%

Recommendation: Finish current task, then start fresh
- Can I complete current work in < 50K more tokens?
- If YES → continue carefully
- If NO → start fresh session NOW

Action:
1. Update NEXT_SESSION.md with current state
2. Commit all changes
3. Start new session
```

### 🛑 Critical (> 100K tokens)
```
Status: 🛑 CRITICAL - MANDATORY FRESH SESSION

███████████████████░ 110%

Recommendation: STOP - Start fresh immediately
- Performance is degraded
- Response quality suffering
- Higher token costs

Action NOW:
1. Update NEXT_SESSION.md
2. Commit all changes
3. Close this session
4. Start fresh session

DON'T start new work at this level!
```

---

## How to Interpret

### Token Bar
- Each `█` = 5% of 200K budget
- `░` = unused capacity
- Shows visual progress toward limits

### Decision Framework

| Tokens | Status | Continue? | Action |
|--------|--------|-----------|--------|
| 0-50K | ✅ Healthy | YES | Normal work |
| 50-75K | ⚠️ Warning | MAYBE | Finish current task only |
| 75-100K | ⚠️ High | NO | Start fresh after commit |
| 100K+ | 🛑 Critical | NO | Stop immediately |

---

## When to Check

**Mandatory checks**:
- Start of every session (in SESSION_CHECKLIST.md step 0)
- Before starting new feature/task
- When noticing slow/confused responses

**Optional checks**:
- After completing major feature
- Every hour during long sessions
- When feeling unsure about continuing

---

## Integration with Workflow

### SESSION_CHECKLIST.md Step 0
```markdown
### 0. Token Budget Health Check (< 1 min)
- [ ] Run /token-health
- [ ] Follow recommendation (continue/finish/stop)
```

### Before Starting New Work
```markdown
1. Check: /token-health
2. If < 50K → proceed
3. If 50-100K → finish current only
4. If > 100K → fresh session
```

---

## Performance Indicators

**Beyond token count, watch for**:

### Response Quality
- ✅ Clear, accurate answers
- ⚠️ Occasional confusion or missing context
- 🛑 Frequent errors, contradictions, or forgetting earlier discussion

### Response Time
- ✅ Fast (< 10s for normal queries)
- ⚠️ Slower (10-30s)
- 🛑 Very slow (> 30s)

### Reasoning Quality
- ✅ Thoughtful, considers context
- ⚠️ Sometimes misses obvious things
- 🛑 Makes illogical suggestions

**If any indicator is 🛑**, start fresh even if token count looks okay.

---

## Benefits

1. **Visual feedback**: Easier to judge at a glance
2. **Clear thresholds**: No guessing about "too much"
3. **Actionable**: Tells you exactly what to do
4. **Prevents waste**: Stop before quality degrades
5. **Faster development**: Fresh context = better responses

---

## Anti-Patterns

### ❌ Ignoring the Warning
"I'm at 80K but let me just finish this one more thing..."
- Leads to 120K+ sessions with degraded quality
- Better to commit and start fresh

### ❌ Trying to "Save Context"
"But I need all this history..."
- Documents (NEXT_SESSION.md, plan.md) preserve state better
- Fresh context reads docs faster than parsing 100K chat history

### ❌ Working Past 100K
"I'll just finish this debugging..."
- Performance at 100K+ is significantly worse
- You'll debug faster in fresh session

---

## Success Metrics

**Ideal session profile**:
- 80% of sessions: < 50K tokens (healthy completion)
- 15% of sessions: 50-75K tokens (finished current work)
- 5% of sessions: 75-100K tokens (rare edge cases)
- 0% of sessions: > 100K tokens (never let it get here)

**If you're regularly hitting 100K+**: Tasks are too large or not well-scoped. Break work into smaller chunks.

---

**Integration**: Add to start of every session workflow in SESSION_CHECKLIST.md and START_HERE.md
