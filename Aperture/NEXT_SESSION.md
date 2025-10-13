# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Last Updated**: 2025-10-13 (Session 12 - Upload Issues Fixed)
>
> **Current Work**: ✅ Upload working end-to-end, ready to implement client-side alignment

---

## 🎯 Current Status

### Project State

**Wizard of Oz (Baby Photo Alignment App)**:
- **Status**: 🟢 FULLY WORKING - End-to-end upload with eye detection
- **Vercel URL**: (User has deployment URL)
- **Repository Path**: `Aperture/projects/wizard-of-oz`
- **Supabase URL**: `https://zaruvcwdqkqmyscwvxci.supabase.co`
- **Latest Changes**:
  - Fixed Supabase API key issue (truncated key causing all operations to fail)
  - Fixed photos stuck in "processing" state (aligned_url now set on upload)
  - Fixed detectingEyes state management (rotation now properly resets state)
  - Enhanced logging throughout upload flow for debugging
  - Migration fixed 1 photo stuck in database

### Infrastructure Status

**✅ Fully Operational**:
- Upload system working
- Eye detection working (Gemini AI)
- Database tables exist
- Storage buckets configured
- Environment variables set
- Observability system implemented (`/vercel-logs` available)

### Recent Improvements

**Upload Flow Fixes** (Session 12 - 2025-10-13):
- ✅ **Fixed Invalid Supabase API Key** - Local .env had truncated VITE_SUPABASE_ANON_KEY
  - Key was cut off mid-signature (ended with `...Cg-`)
  - Retrieved full key from Vercel environment variables
  - All Supabase operations now work (auth, database, storage)
- ✅ **Fixed Photos Stuck in "Processing"** - Root cause: alignment disabled but UI expects aligned_url
  - PhotoGallery polls every 5 seconds waiting for aligned_url to be set
  - Since alignment API disabled, aligned_url never got set
  - Solution: Set aligned_url = original_url on upload (usePhotoStore.ts:164)
  - Created migration script to fix existing stuck photos
- ✅ **Fixed detectingEyes State Management** - Button getting stuck on "Detecting..."
  - Rotation created new file but didn't reset eye detection state
  - Added state reset + 15-second timeout on rotation (UploadPhoto.tsx:84-90)
  - Added same timeout on initial file selection (UploadPhoto.tsx:123-125)
  - Ensures upload button always becomes enabled
- ✅ **Enhanced Logging** - Added detailed logs throughout upload flow
  - Component: handleUpload logs (UploadPhoto.tsx:157-163)
  - Store: uploadPhoto logs with [uploadPhoto] prefix
  - Store: fetchPhotos logs with [fetchPhotos] prefix
  - Makes debugging upload issues much easier

**Build Errors & Log Access** (Session 11 - 2025-10-13):
- ✅ **Fixed Vercel build error** - Removed Python function config from vercel.json
  - Error: Pattern `api/**/*.py` didn't match any files
  - Root cause: Deleted Python files when switching to MediaPipe
  - Solution: Removed Python config, simplified buildCommand
- ✅ **Fixed photos stuck processing** - Disabled obsolete detect-eyes API
  - Old Gemini-based API still being called (no webhook, likely edge function)
  - Tried to call non-existent align-photo-v4 endpoint (404)
  - Solution: Renamed detect-eyes.ts → detect-eyes.ts.disabled
- ✅ **Set up permanent log access** for debugging
  - Created .env file with VERCEL_TOKEN and PROJECT_ID
  - Updated .scripts/vercel-logs.sh to auto-load from .env
  - Can now check logs anytime without user intervention
  - Used logs to discover both build and runtime errors

**MediaPipe Eye Detection** (Session 10 - 2025-10-13):
- ✅ **Replaced unreliable AI with specialized computer vision library**
  - Gemini/Claude AI couldn't reliably detect eye coordinates (Y coords systematically wrong)
  - Researched alternatives: MediaPipe best for accuracy (98.6%), privacy, cost ($0)
  - Implemented MediaPipe Face Landmarker in React component
  - Client-side detection using WebAssembly (200-1000 FPS performance)
- ✅ **Optimized for baby photos**
  - Lower confidence thresholds (0.4 vs default 0.5)
  - Iris center landmarks (478 total) for precise eye position
  - Validation for baby-specific eye distances (0.12-0.35 of image width)
  - Handles pose variation, tilted heads, various angles
- ✅ **Privacy-first architecture**
  - All processing client-side in browser
  - Baby photos never sent to external APIs
  - Zero ongoing costs (no AI API usage)
- ✅ **Graceful degradation**
  - Clear UI feedback ("Detecting eyes..." / "Eyes detected successfully")
  - Can still upload without detection if it fails
  - Error messages guide user on what went wrong

**Proactive Log Monitoring** (Session 8 - 2025-10-13):
- ✅ **Automated production health checks** at session start
  - Created `.process/PROACTIVE_LOG_MONITORING.md` - Complete log review process
  - Added Step 4.5 to `.claude/startup.md` - Automatic for Aperture projects
  - 60-second health check (deployment status + critical API logs)
  - Report format: 🟢 Healthy / 🟡 Warning / 🔴 Critical
- ✅ **Catch issues before user reports them**
  - Check logs within 5 minutes of deployment
  - Review last 24 hours at session start
  - Fix production bugs proactively
- ✅ **Integration with existing process**
  - Added to DOCUMENTATION_INDEX.md
  - New intent: "I want to check production health"
  - Links to OBSERVABILITY.md for logging standards

**Documentation Restructure** (Session 7 - 2025-10-13):
- ✅ **Context Engineering Best Practices** implemented
  - Added "Current Tasks & Status" to CLAUDE-APERTURE.md
  - Task format now includes verification commands
  - Source citation pattern established
  - Code output standards documented
- ✅ **Documentation Audit & Cleanup** completed
  - **Phase 1**: Eliminated 360 lines of redundancy, resolved 4 conflicts
    - CLAUDE-APERTURE.md: 302 → 258 lines (15% reduction)
    - DEVELOPMENT.md: 769 → 592 lines (23% reduction)
    - Single sources of truth established
  - **Phase 2**: "Choose your own adventure" navigation
    - Added navigation to 8 major documentation files
    - Created DOCUMENTATION_INDEX.md (complete map)
    - Archived 7 orphaned files to `.archive/`
    - 21 active docs remaining (down from 31, 32% reduction)
- ✅ **Process Gap Fixed**: NEXT_SESSION.md progressive updates
  - Added enforcement to update during sessions, not just at end
  - Documented in COMMON_MISTAKES.md as case study

**Eye Detection Debugging** (Session 9 - 2025-10-13):
- ✅ **META_DEBUGGING_PROTOCOL applied**: Verified inputs before debugging transformation
  - Stripped ALL transformation logic to create visual debug mode
  - Draws green dots on original image at Gemini's detected positions
  - Discovered Y coordinates are systematically too high
- ❌ **Root cause found but not fixed yet**: Gemini detecting eyes too high in image
  - Green dots appear above baby's head, not on eyes
  - X coordinates appear roughly correct
  - Y coordinates need investigation (logs required)
- 🔄 **Next**: Get Vercel logs to analyze actual coordinates and scale factors

**Debugging Protocol & Photo Alignment** (Session 6):
- ✅ **BREAKTHROUGH**: Fixed catastrophic coordinate scaling bug
  - Root cause: Database stores coordinates for 768x1024 downscaled images
  - Must scale coordinates by (actualWidth / detectionWidth) before processing
  - Wasted 90 minutes debugging algorithm when input was wrong
- ✅ Implemented Python OpenCV alignment solution (`align_photo_opencv.py`)
  - Uses `cv2.estimateAffinePartial2D` for similarity transform
  - Successfully tested with real baby photos
  - Produces accurate alignment with target eye positions
- ✅ Created comprehensive debugging protocols
  - `META_DEBUGGING_PROTOCOL.md` - Universal input verification principles
  - `DEBUGGING_CHECKLIST.md` - Coordinate scaling case study
  - `projects/wizard-of-oz/DEBUGGING.md` - Project-specific guide
  - Added signposting in START_HERE.md, startup.md, README.md

**Observability System** (Session 5):
- ✅ `/vercel-logs` command for programmatic log access
- ✅ Comprehensive logging guidelines in `.process/OBSERVABILITY.md`
- ✅ Self-sufficient debugging capability

**Process Improvements** (Session 4):
- ✅ Automated pre-flight checks (`/verify-infra`, `/which-project`)
- ✅ Token budget monitoring (`/token-health`)
- ✅ Git hooks for conventional commits
- ✅ Streamlined documentation

---

## ⏭️ Next Steps

### Priority 1: ✅ COMPLETE - System Working End-to-End

**Current Functionality** (as of Session 12):
- ✅ MediaPipe eye detection works in browser
- ✅ Eye coordinates save to database
- ✅ Photos upload successfully (no more stuck in "processing")
- ✅ Upload button properly manages state (no more stuck on "Detecting...")
- ✅ No build errors
- ✅ No runtime errors (404s fixed)
- ✅ Log access working for debugging
- ✅ Supabase connection fully operational (API key fixed)

**What's NOT Working (Intentionally Disabled)**:
- ❌ Photo alignment - Set to original (no transformation applied)
- ❌ Timelapse generation - Feature planned but not implemented

**Current Behavior**:
- Photos display immediately after upload (aligned_url = original_url)
- Eye coordinates are saved but not used for transformation yet
- Ready to implement client-side alignment as next step

### Priority 2: 🎯 NEXT - Implement Client-Side Photo Alignment

**Status**: Ready to implement (Session 13+)

**Decision Made**: Option A - Client-Side Alignment
- Faster user experience (no server round-trip)
- Consistent with client-side eye detection (privacy-first)
- Can build on existing `rotateImage()` function
- Simpler architecture (no async processing state)

**Option A: Client-Side Alignment (Recommended)**
- Use browser Canvas API to rotate/crop photos
- Fastest (no server round-trip)
- Works offline
- No Python dependencies
- Reference: Existing `rotateImage` function in UploadPhoto.tsx

**Option B: Server-Side Alignment (More Complex)**
- Create new Vercel serverless function
- Use Sharp library (already in package.json)
- Fetch photo + coordinates from database
- Process and save aligned version
- Update database with aligned_url

**Implementation Plan (Option B)**:
1. [ ] Create `api/align-photo.ts` with Sharp
2. [ ] Fetch photo record with eye_coordinates from database
3. [ ] Download original from storage
4. [ ] Calculate rotation angle from eye positions
5. [ ] Rotate, translate, crop using Sharp
6. [ ] Upload aligned photo to `aligned/` bucket
7. [ ] Update database: aligned_url, status='aligned'

**Technical Details**:
```typescript
// Eye coordinates stored in database as JSONB:
{
  leftEye: { x: 450, y: 320 },
  rightEye: { x: 550, y: 315 },
  confidence: 0.8,
  imageWidth: 1000,
  imageHeight: 750
}

// Target positions for alignment:
const TARGET_LEFT_EYE = { x: 720, y: 432 };
const TARGET_RIGHT_EYE = { x: 360, y: 432 };
```

### Priority 3: 📊 ONGOING - Monitor Production Health

**After Testing Completes**:
1. [ ] Check Vercel logs for MediaPipe errors
2. [ ] Monitor detection success rate
3. [ ] Track alignment API performance
4. [ ] Verify no bundle size issues (MediaPipe loaded from CDN)
5. [ ] Check for any TypeScript errors in production

**Success Metrics**:
- Detection success rate > 80% (baby photos can be tricky)
- Detection time < 3 seconds on mobile
- Zero browser crashes or memory leaks
- Alignment produces correctly positioned eyes

---

### Key Technical Details

**Python Dependencies** (for Vercel):
```bash
python3 -m pip install opencv-python-headless==4.12.0
```

**Critical Implementation Notes**:
1. **ALWAYS scale coordinates** before passing to OpenCV script
2. **Verify input dimensions** match expected detection dimensions
3. **Log both expected and actual** dimensions for debugging
4. See `META_DEBUGGING_PROTOCOL.md` for input verification checklist

**Files to Reference**:
- `align_photo_opencv.py` - Working Python implementation
- `DEBUGGING_CHECKLIST.md` - Case study of coordinate scaling bug
- `META_DEBUGGING_PROTOCOL.md` - Universal debugging principles

---

## ⚠️ BEFORE DEBUGGING ANYTHING

> **📍 Full protocol → `META_DEBUGGING_PROTOCOL.md` (5 min read)**

**Quick checklist**:
1. STOP - Don't debug the algorithm yet
2. READ `META_DEBUGGING_PROTOCOL.md`
3. VERIFY inputs match assumptions
4. ONLY THEN debug logic

**Why?** 80% of bugs are input issues. Verifying inputs first saves 90+ minutes.

---

## 🔑 Key Resources

### Quick Commands

```bash
# Navigate to project
cd /Users/dancroome-horgan/Documents/GitHub/Aperture

# Check git status
git status

# Token health check
/token-health

# Infrastructure verification
/verify-infra wizard-of-oz

# Fetch Vercel logs
/vercel-logs [function-name] [limit]
```

### Important Files

**Documentation**:
- `DOCUMENTATION_INDEX.md` - Complete documentation map (START HERE)
- `START_HERE.md` - Session startup guide
- `CLAUDE-APERTURE.md` - Project patterns & conventions
- `.process/OBSERVABILITY.md` - Logging & debugging guide
- `.process/DEVELOPMENT.md` - Development workflow

**Wizard of Oz Project**:
- `projects/wizard-of-oz/api/` - Serverless functions
- `projects/wizard-of-oz/src/` - Frontend React app
- `projects/wizard-of-oz/plan.md` - Project plan & architecture

### Environment Variables (Vercel)

- ✅ `VITE_SUPABASE_URL`
- ✅ `SUPABASE_SERVICE_ROLE_KEY`
- ✅ `GEMINI_API_KEY`

---

## 📊 Available Tools

**Slash Commands**:
- `/vercel-logs` - Fetch production logs
- `/verify-infra` - Check infrastructure health
- `/which-project` - Auto-detect project type
- `/token-health` - Context window usage

**Git Hooks**:
- Conventional Commits enforced
- Commit message validation

---

**Last Updated**: 2025-10-13 (Documentation restructure complete)
**Status**: Ready to integrate OpenCV alignment into production
**Token Budget**: Healthy (~30K tokens used in current session)
