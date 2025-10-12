# Debugging Guide - Wizard of Oz Project

## 🚨 BEFORE DEBUGGING ANYTHING IN THIS PROJECT

**MANDATORY: Follow this exact sequence when something doesn't work**

---

## The Debugging Sequence

### 1. Read the Meta Protocol (5 minutes)

**File**: `/META_DEBUGGING_PROTOCOL.md` (in repo root)

**Why**: 80% of bugs are input issues, not algorithm issues. This protocol prevents wasting hours debugging the wrong thing.

**Key principle**: Verify inputs match your assumptions BEFORE debugging transformation logic.

---

### 2. Check Infrastructure (2 minutes)

Run the infrastructure check:
```bash
/verify-infra wizard-of-oz
```

**Common issues caught**:
- Storage buckets don't exist
- Database tables missing
- Environment variables not set
- Vercel Deployment Protection blocking API calls

**If infrastructure check fails**: Fix infrastructure before debugging code.

---

### 3. Check Production Logs (3 minutes)

Fetch recent logs to see actual errors:
```bash
# Get logs for specific function
/vercel-logs detect-eyes 20

# Get logs for align-photo function
/vercel-logs align-photo 20

# Get all recent logs
/vercel-logs
```

**Look for**:
- Error messages with stack traces
- Input validation failures
- Processing timeouts
- API call failures

---

### 4. Verify Database State (2 minutes)

Use the query script:
```bash
cd projects/wizard-of-oz
bash ../../.scripts/query-logs.sh [function-name] [limit]
```

**Check**:
- Are photos being created?
- Do photos have eye_coordinates populated?
- Are aligned_url fields being set?
- What do the log messages say?

---

### 5. ONLY NOW: Debug Code Logic

**If all above checks pass**, then debug the algorithm/code logic.

**Apply the input verification protocol** from META_DEBUGGING_PROTOCOL.md:

```javascript
// ✅ ALWAYS START DEBUGGING WITH THIS
console.log('═══ INPUT VERIFICATION ═══');
console.log('Input:', JSON.stringify(input, null, 2));
console.log('Expected:', expectedFormat);
console.log('Match:', verify(input, expectedFormat));
```

---

## Project-Specific Debugging Tips

### Photo Alignment Issues

**Common root causes** (in order of likelihood):

1. **Coordinate scaling mismatch** (90-minute waste if missed!)
   - Database stores coordinates for downscaled images (e.g., 768x1024)
   - Must scale coordinates to match actual image dimensions
   - See `DEBUGGING_CHECKLIST.md` for detailed case study

2. **Eye detection confidence too low**
   - Check `eye_coordinates.confidence` in database
   - Threshold: 0.75 for open eyes, 0.65 for closed eyes
   - Adjust lighting or wait for better photo

3. **Inter-eye distance validation failing**
   - Expected: 10-50% of image width
   - Check actual distance vs. image dimensions
   - May indicate wrong face or multiple faces

4. **Image processing timeout**
   - Sharp processing should complete in < 10 seconds
   - Check Vercel function timeout settings
   - Check image dimensions (very large images?)

### Upload Issues

**Check in order**:

1. Storage bucket exists and is public
2. User is authenticated (check auth token)
3. File size is reasonable (< 10MB recommended)
4. Image format is supported (JPEG, PNG)

### Eye Detection Issues

**Check in order**:

1. Gemini API key is set (`GEMINI_API_KEY`)
2. Image is accessible (URL returns 200)
3. Image shows a clear face (not rotated 90°)
4. Eyes are visible (open or closed)

---

## Red Flags That Mean "Check Inputs First"

🚩 **"It worked before"** → Something about the input changed
🚩 **"The math is perfect"** → Probably applying perfect math to wrong input
🚩 **"The algorithm is simple"** → Simple algorithms don't fail mysteriously
🚩 **"I tested the function in isolation"** → Real input differs from test input
🚩 **"The logs show it should work"** → Logs might be showing wrong data
🚩 **"It's only off by a constant factor"** → Scaling/unit conversion issue
🚩 **"It's off by exactly 2x/4x/etc"** → Almost always a scaling mismatch

When you see these red flags: **STOP. Go verify inputs. Read META_DEBUGGING_PROTOCOL.md.**

---

## Quick Reference

| Issue | First Check |
|-------|-------------|
| Upload fails | Storage bucket exists? User authenticated? |
| Eye detection fails | Gemini API key set? Image accessible? |
| Alignment wrong | **COORDINATES SCALED?** (Read META_DEBUGGING_PROTOCOL.md) |
| Processing hangs | Vercel logs (/vercel-logs) |
| No database record | Database tables exist? (/verify-infra) |

---

## Success Metrics

**Good debugging session** (< 30 min to fix):
- ✅ Followed the sequence above
- ✅ Read META_DEBUGGING_PROTOCOL.md first
- ✅ Checked infrastructure before code
- ✅ Verified inputs before debugging algorithm

**Bad debugging session** (> 90 min wasted):
- ❌ Started debugging algorithm immediately
- ❌ Assumed inputs were correct
- ❌ Didn't check logs or infrastructure
- ❌ Ignored red flags

---

**Last Updated**: 2025-01-12
**See Also**:
- `/META_DEBUGGING_PROTOCOL.md` - Universal debugging principles
- `/DEBUGGING_CHECKLIST.md` - Coordinate scaling case study
- `.process/OBSERVABILITY.md` - Logging best practices
