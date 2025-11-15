# Vercel Logs Command

**Purpose**: Fetch Vercel runtime logs for self-sufficient debugging without user intervention.

**Usage**: `/vercel-logs [function-name] [limit]`

---

## What This Command Does

Fetches runtime logs from the latest Vercel deployment programmatically, enabling Claude to debug autonomously without asking users to check the dashboard.

---

## Arguments

### function-name (optional)
Filter logs to show only entries matching this function name.

**Examples**:
- `align-photo-v2`
- `detect-eyes`
- `upload`

### limit (optional, default: 100)
Number of log entries to fetch.

**Examples**:
- `50` - Last 50 entries
- `200` - Last 200 entries
- `1000` - Maximum entries (may be slow)

---

## Examples

### Fetch all recent logs
```bash
/vercel-logs
```

### Fetch logs for specific function
```bash
/vercel-logs align-photo-v2
```

### Fetch more logs for thorough debugging
```bash
/vercel-logs detect-eyes 200
```

### Quick check (last 20 logs)
```bash
/vercel-logs "" 20
```

---

## Output Format

```
🔍 Fetching Vercel Logs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project ID: prj_rkI3NQOI5SfBle7lflFkwFkj0eYd
Function: align-photo-v2
Limit: 100 entries

→ Getting latest deployment...
✅ Deployment ID: dpl_abc123...

→ Fetching runtime logs...

HH:MM:SS [stdout] === ALIGNMENT V2 START ===
HH:MM:SS [stdout] Photo ID: photo_123
HH:MM:SS [stdout] Input dimensions: 3024 x 4032
HH:MM:SS [stdout] PREDICTED final eye positions: {...}
HH:MM:SS [stderr] ❌ Alignment V2 error: ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Logs fetched successfully
Total entries: 150
Matching 'align-photo-v2': 12
```

**Color Coding**:
- 🔴 Red: Errors, stderr, failures
- 🟢 Green: Success, completion
- 🟡 Yellow: Warnings
- ⚪ White: Info, regular logs

---

## When to Use

### Always Use When:
- 🐛 **Debugging issues** - User reports feature not working
- 🧪 **After deployment** - Verify feature is running correctly
- 🔍 **Investigating errors** - Understand what went wrong
- 📊 **Performance analysis** - Check timing and bottlenecks

### Before Using:
- ✅ User has triggered the feature (uploaded photo, clicked button, etc.)
- ✅ Feature should have generated logs (check that comprehensive logging is in place)
- ✅ Issue is recent (< 1 hour on Hobby plan, < 1 day on Pro plan)

---

## Common Workflows

### Workflow 1: Debugging User-Reported Issue
```
User: "I uploaded a photo but it's not aligned"

1. /vercel-logs align-photo-v2 200
2. Analyze logs for errors or unexpected values
3. Identify root cause
4. Fix code
5. Deploy
6. User retests
```

### Workflow 2: Verifying Deployment
```
After deploying new feature:

1. User triggers feature once
2. /vercel-logs new-feature 50
3. Verify logs show expected behavior
4. Look for errors or warnings
5. Fix if needed, otherwise mark as UAT ready
```

### Workflow 3: Investigating Algorithm Behavior
```
User: "Eyes aren't aligning correctly"

1. /vercel-logs align-photo-v2 100
2. Look for "PREDICTED final eye positions"
3. Look for "ERROR (should be ~0)"
4. If ERROR > 5px → algorithm issue
5. If ERROR < 2px → detection inconsistency
6. Fix accordingly
```

---

## Troubleshooting

### No Logs Found
**Symptom**: "Total entries: 0" or "Matching 'function-name': 0"

**Possible Causes**:
1. Function hasn't been called recently (logs expired)
2. Function name misspelled or incorrect
3. Function didn't execute (early exit, error before logging)
4. Logs older than retention period (1 hour on Hobby, 1 day on Pro)

**Solutions**:
- Ask user to trigger the feature again
- Check function name spelling
- Verify function exists in deployment
- If logs expired, ask user to reproduce issue

### Authentication Error
**Symptom**: "❌ Error: VERCEL_TOKEN not set" or 403 response

**Solutions**:
```bash
# Check token is set
echo $VERCEL_TOKEN

# If not set, add to environment
export VERCEL_TOKEN=your_token_here

# Make permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export VERCEL_TOKEN=your_token_here' >> ~/.bashrc
```

### Invalid Project ID
**Symptom**: "❌ Error: VERCEL_PROJECT_ID not set" or "Failed to get deployment ID"

**Solutions**:
```bash
# Check project ID
echo $VERCEL_PROJECT_ID

# Set correct project ID
export VERCEL_PROJECT_ID=prj_rkI3NQOI5SfBle7lflFkwFkj0eYd
```

---

## Log Retention Periods

| Plan | Retention | Use Case |
|------|-----------|----------|
| Hobby | 1 hour | Real-time debugging only |
| Pro | 1 day | Recent issues, async debugging |
| Pro + Observability Plus | 30 days | Historical analysis |
| Enterprise | 3 days | Production debugging |
| Enterprise + Observability Plus | 30 days | Long-term monitoring |

**Note**: For issues older than retention period, comprehensive in-code logging (Path B) is the only option. Consider upgrading to Pro if async debugging is frequent.

---

## Integration with Observability Process

This command implements **Path A** of the observability strategy:

**Path A (Programmatic Access)** → `/vercel-logs` command ← **You are here**
- Fetches logs via Vercel API
- Enables self-sufficient debugging
- Works for real-time debugging (within retention period)

**Path B (Comprehensive Logging)** → See `.process/OBSERVABILITY.md`
- Ensures logs contain debugging information
- Mandatory for all new features
- Foundation that makes Path A useful

**Both paths are required**:
- Path B without Path A = Great logs that require manual copy/paste
- Path A without Path B = Easy access to insufficient logs
- Path A + Path B = True self-sufficient debugging ✅

---

## Behind the Scenes

The command calls `.scripts/vercel-logs.sh` which:

1. Authenticates with Vercel API using bearer token
2. Fetches latest deployment ID for project
3. Retrieves runtime logs from deployment
4. Filters by function name (if specified)
5. Formats and color-codes output
6. Shows summary statistics

**API Endpoint Used**:
```
GET https://api.vercel.com/v3/deployments/{deploymentId}/events
Authorization: Bearer {VERCEL_TOKEN}
```

---

## Future Enhancements

**Potential additions**:
- Time-range filtering (last N minutes/hours)
- Multiple function filtering (OR logic)
- Export logs to file
- Log analysis (pattern detection, error aggregation)
- Real-time streaming (follow mode like `tail -f`)
- Integration with alert systems

**When to implement**: If any of these become needed frequently (use judgment - Start Minimal principle applies)

---

## Success Metrics

**How to know it's working**:
- ✅ Claude never asks "Can you check the Vercel logs?"
- ✅ Debugging cycles are faster (no context switching)
- ✅ Issues are identified from logs alone
- ✅ Root causes are found without user providing data

**If these aren't true**: Path B (comprehensive logging) may be insufficient. Add more detailed logging to the feature being debugged.

---

**Created**: 2025-10-12
**Part of**: Self-Sufficient Debugging Process (Observability Requirements)
**Related**: `.process/OBSERVABILITY.md`, `SESSION_CHECKLIST.md`
