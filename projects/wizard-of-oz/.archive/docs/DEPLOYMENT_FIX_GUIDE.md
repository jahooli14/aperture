# Deployment Fix Guide - Alignment Pipeline

> **Goal**: Fix photo alignment pipeline that was failing due to Vercel Deployment Protection and Sharp configuration issues.

---

## What Was Fixed

### Issue 1: Vercel Deployment Protection
**Problem**: detect-eyes → align-photo API calls were blocked by Vercel's Deployment Protection, returning 401/403 errors.

**Solution**: Added support for `VERCEL_AUTOMATION_BYPASS_SECRET` header to bypass protection for server-to-server calls.

### Issue 2: Sharp Binary Compatibility
**Problem**: Sharp image processing library may use wrong platform binary (darwin-arm64 from Mac instead of linux-x64 for Vercel).

**Solution**: Updated `vercel.json` to force linux-x64 Sharp binary installation during build.

### Issue 3: Improved Error Handling
**Problem**: Silent failures made debugging difficult.

**Solution**: Added comprehensive logging, timeout handling, and specific error detection.

---

## Required Vercel Environment Variables

### Current Variables (Already Set)
- ✅ `VITE_SUPABASE_URL` - Supabase project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Admin key for server operations
- ✅ `GEMINI_API_KEY` - Google AI API key

### NEW Variable Required (Add This)

**`VERCEL_AUTOMATION_BYPASS_SECRET`**

#### How to Get This Secret:

1. Go to your Vercel project settings: https://vercel.com/[your-team]/[your-project]/settings
2. Navigate to **"Deployment Protection"** tab
3. Scroll to **"Protection Bypass for Automation"**
4. Click **"Enable"** or **"Manage"**
5. Copy the generated secret (looks like: `bypass_abc123xyz...`)
6. Add as environment variable in **Settings → Environment Variables**:
   - Name: `VERCEL_AUTOMATION_BYPASS_SECRET`
   - Value: `bypass_abc123xyz...` (the secret you copied)
   - Environments: ✅ Production, ✅ Preview, ✅ Development

**Important**: After adding the variable, you MUST **redeploy** for it to take effect.

---

## Testing the Fix

### Step 1: Verify Sharp Works

After deployment, visit:
```
https://your-deployment.vercel.app/api/test-sharp
```

**Expected Response** (success):
```json
{
  "success": true,
  "message": "Sharp is working correctly",
  "sharpVersion": { ... },
  "platform": "linux",
  "arch": "x64",
  "testImageSize": 2156
}
```

**If Failed**: Check build logs for Sharp installation errors.

### Step 2: Test Complete Upload Flow

1. Upload a baby photo via the app
2. Wait 15-20 seconds
3. Check Vercel logs for:
   ```
   ✅ Alignment triggered successfully
   ```
4. Refresh the gallery
5. Photo should show **"✓ Aligned"** status

### Step 3: Check Vercel Logs

Navigate to: **Vercel Dashboard → Project → Logs**

**Look for these indicators**:

#### Success Pattern:
```
Eye detection successful: { confidence: 0.89, eyesOpen: true, ... }
Calling align-photo API: { baseUrl: "https://...", hasProtectionBypass: true }
Align-photo response: { status: 200, ok: true, ... }
✅ Alignment triggered successfully
Processing alignment for photo: abc-123-xyz
✅ Alignment complete
```

#### Deployment Protection Issue (if bypass not set):
```
❌ Authentication failed - Deployment Protection may be blocking
Align-photo response: { status: 401, ... }
```
**Fix**: Add `VERCEL_AUTOMATION_BYPASS_SECRET` environment variable

#### Sharp Issue:
```
❌ Align-photo internal error: Could not load the 'sharp' module
```
**Fix**: Build command should reinstall Sharp for linux-x64 (check vercel.json)

---

## What Changed

### Files Modified

1. **`api/detect-eyes.ts`**
   - Added Deployment Protection bypass headers
   - Improved URL construction with fallbacks
   - Added timeout handling (55s)
   - Enhanced error logging with specific detection
   - Added AbortController for request timeouts

2. **`vercel.json`**
   - Added `memory: 1024` for Sharp processing
   - Added `buildCommand` to force linux-x64 Sharp binary

### Files Created

1. **`api/test-sharp.ts`**
   - New endpoint to verify Sharp works in production
   - Useful for debugging image processing issues

2. **`DEPLOYMENT_FIX_GUIDE.md`** (this file)
   - Complete deployment and troubleshooting guide

---

## Troubleshooting

### Photos Still Stuck in "Processing"

**Check 1: Deployment Protection Bypass**
```bash
# In Vercel logs, look for:
Calling align-photo API: { hasProtectionBypass: true }

# If false, the environment variable is not set
```

**Check 2: Sharp Test**
```bash
curl https://your-deployment.vercel.app/api/test-sharp

# Should return success: true
```

**Check 3: Supabase Storage**
1. Go to Supabase → Storage → `aligned` bucket
2. Check if new files are appearing
3. If empty, check align-photo logs for storage errors

**Check 4: Database**
```sql
SELECT id, aligned_url, eye_coordinates
FROM photos
ORDER BY created_at DESC
LIMIT 5;

-- aligned_url should be populated
-- eye_coordinates should contain leftEye/rightEye data
```

### Vercel Build Fails

If build fails with Sharp errors:

1. Check `vercel.json` has the `buildCommand`
2. Verify npm version compatibility
3. Try clearing Vercel build cache:
   - Settings → General → Clear Build Cache

### Local Development Issues

If testing locally:
1. Alignment calls will go to `http://localhost:5175`
2. Deployment Protection bypass is not needed
3. Sharp should work with your native binary (darwin-arm64)

---

## Monitoring Recommendations

### Add to Health Check

The existing `/api/health` endpoint could be enhanced to check:
- Deployment Protection bypass secret exists
- Sharp can create test images
- align-photo endpoint is reachable

### Add Sentry/Error Tracking (Future)

For production monitoring:
```bash
npm install @sentry/node @sentry/vercel
```

Track:
- Alignment failures
- Sharp processing errors
- API timeout rates
- Storage upload failures

---

## Next Steps After Fix Works

Once alignment is working consistently:

1. **Clean up debug logging** - Remove excessive console.logs
2. **Re-enable daily upload limit** - In `usePhotoStore.ts` and database
3. **Add real-time updates** - Use Supabase Realtime to auto-refresh gallery
4. **Optimize image downloads** - Cache image buffer between detect-eyes and align-photo
5. **Add retry mechanism** - Queue failed alignments for retry

---

## Summary

**Critical Action Required**:
1. Add `VERCEL_AUTOMATION_BYPASS_SECRET` to Vercel environment variables
2. Redeploy the app
3. Test with `/api/test-sharp`
4. Upload a photo and verify alignment completes

**Expected Result**: Photos should now complete full pipeline:
- Upload → Eye Detection → Image Alignment → Gallery Display

---

**Last Updated**: 2025-10-10
**Claude Session**: Autonomous Wizard of Oz Enhancement
