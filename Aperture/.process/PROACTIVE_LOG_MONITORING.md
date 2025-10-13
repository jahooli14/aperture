# Proactive Log Monitoring Process

> **Purpose**: Enable Claude to proactively review Vercel logs and catch production issues early.
>
> **Goal**: Shift from reactive debugging to proactive issue detection.

---

## 🎯 When to Review Logs Proactively

### Automatic Triggers (Add to startup.md)

Claude should check logs automatically in these scenarios:

1. **After any deployment** - Check logs within 5 minutes of deployment
2. **At session start** - Review last 24 hours of logs for errors
3. **Before starting new work** - Ensure production is healthy
4. **After user mentions issues** - Even vague mentions like "something seems off"

### Manual Triggers (User Requests)

- User says: "check the logs"
- User says: "anything wrong in production?"
- User pastes error from logs (like you did)

---

## 📋 Standard Log Review Process

### Step 1: Check Recent Deployments (30 seconds)

```bash
# Get last 3 deployments with status
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=$PROJECT_ID&limit=3" \
  | jq '.deployments[] | {commit: .meta.githubCommitSha[0:7], state: .state, error: .errorMessage}'
```

**Look for**:
- Any `ERROR` states
- Build failures
- Recent deployment time

### Step 2: Check Function Logs by Type (2-3 minutes)

**Priority order** (most critical first):

1. **Alignment Pipeline** - `/api/align-photo-v4`
   ```bash
   /vercel-logs align-photo-v4 20
   ```
   **Look for**: Storage errors, timeout, transformation failures

2. **Eye Detection** - `/api/detect-eyes`
   ```bash
   /vercel-logs detect-eyes 20
   ```
   **Look for**: Low confidence, validation errors, API failures

3. **Upload/Delete** - `/api/delete-photo`
   ```bash
   /vercel-logs delete-photo 10
   ```
   **Look for**: Permission errors, cascade failures

**Red Flags** (immediate attention):
- ❌ `Error:` or `❌` - Unhandled exceptions
- ⚠️ Stack traces - Something crashed
- 🔴 HTTP 500 responses - Server errors
- 🟡 HTTP 422 responses - Validation failures (expected, but monitor frequency)
- ⏱️ Timeouts - Performance issues
- 🗄️ Database errors - Data integrity issues

**Green Flags** (healthy):
- ✅ `success: true`
- 🎯 Expected validation rejections (low confidence, etc.)
- 📊 Processing times < 10s

### Step 3: Analyze Error Patterns (1-2 minutes)

**Questions to answer**:
1. Is this a one-off or pattern?
2. What percentage of requests fail?
3. When did it start? (correlate with deployment)
4. Does it affect all users or specific cases?

### Step 4: Report Findings (1 minute)

**Template**:
```markdown
## 🔍 Log Review - [Date]

**Scope**: Last [24h/1h/since deployment]

**Status**: 🟢 Healthy / 🟡 Warning / 🔴 Critical

**Findings**:
- align-photo-v4: [X successful, Y failed] - [issue if any]
- detect-eyes: [X successful, Y failed] - [issue if any]
- delete-photo: [status]

**Issues Detected**:
1. [Issue description]
   - Frequency: X/Y requests (Z%)
   - Started: [deployment/time]
   - Impact: [user-facing/background]
   - Action: [fix needed/monitoring/expected]

**Action Required**: [yes/no]
```

---

## 🔧 Integration with Startup Process

### Proposed Addition to `.claude/startup.md`

Add new **Step 4.5: Production Health Check (IF APERTURE)**:

```markdown
### Step 4.5: Production Health Check (AUTOMATIC for Aperture)

**For Aperture projects only** - Check production logs for errors.

**Quick check** (60 seconds):
1. Get last deployment status:
   ```bash
   curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
     "https://api.vercel.com/v6/deployments?projectId=prj_rkI3NQOI5SfBle7lflFkwFkj0eYd&limit=1" \
     | jq '{state: .deployments[0].state, error: .deployments[0].errorMessage}'
   ```

2. Check alignment pipeline logs:
   ```bash
   /vercel-logs align-photo-v4 10
   ```

3. Check eye detection logs:
   ```bash
   /vercel-logs detect-eyes 10
   ```

**Report**:
- 🟢 All healthy
- 🟡 Minor issues (expected validation failures)
- 🔴 Critical issues (errors, crashes)

**If 🔴 Critical**:
- Document in `.process/INCIDENT_LOG.md`
- Fix before starting new work
- Update NEXT_SESSION.md with status
```

---

## 📊 Log Patterns to Recognize

### Normal/Expected Patterns

```
✅ Eye detection successful
✅ Alignment complete: {processingTime: "1234ms"}
🟡 Low confidence eye detection (confidence: 0.72)
🟡 Invalid eye detection (distance too far apart)
```

**Action**: None - system working as designed

### Warning Patterns

```
⚠️ Processing time > 8s (getting slow)
⚠️ Multiple validation failures in a row (>5)
⚠️ Retrying align-photo (attempt 2/3)
```

**Action**: Monitor, may need optimization

### Critical Patterns

```
❌ Alignment failed: [any error]
❌ Database error: [any error]
❌ Storage error: [any error]
Error: [stack trace]
TypeError: [any type error]
```

**Action**: Immediate fix required

---

## 🎯 Success Metrics

**Goal**: Catch issues before user reports them

**Measure**:
- Time to detect: < 5 minutes from error occurrence
- Coverage: Review logs in 100% of sessions
- False positive rate: < 10% (don't over-alert)

**Review cadence**:
- Session start: Last 24 hours
- After deployment: Next 10 minutes
- Mid-session: If user uploads photo (optional)

---

## 🧭 Navigation

**Where to go next**:
- If errors found → Follow debugging protocol in `META_DEBUGGING_PROTOCOL.md`
- If deployment failed → Check build logs in Vercel dashboard
- If healthy → Document in session notes, proceed with work

**Related documentation**:
- `.process/OBSERVABILITY.md` - Logging standards
- `META_DEBUGGING_PROTOCOL.md` - Debugging workflow
- `.claude/startup.md` - Session initialization

**This process helps**:
- Catch production issues proactively
- Build trust through consistent monitoring
- Learn from error patterns
- Prevent user-reported bugs
