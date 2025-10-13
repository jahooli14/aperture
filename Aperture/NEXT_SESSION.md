# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Last Updated**: 2025-10-13 (Session 13 - Photo Alignment COMPLETE & WORKING)
>
> **Current Work**: ✅ Photo alignment fully working! All bugs fixed, ready for production use

---

## 📸 Session Checkpoints

> **Purpose**: Snapshot stable states before major changes for safe experimentation
>
> **When to create**: Before implementing significant features, refactors, or risky changes
>
> **How to use**: Document current working state, then proceed with changes knowing you can rollback

### How to Create a Checkpoint

**Before starting risky work**:
1. Ensure current state is stable (tests pass, builds work, deployed successfully)
2. Create checkpoint entry below with format:
   ```markdown
   ### Checkpoint [N] - [YYYY-MM-DD HH:MM] - [Brief Description]
   **What's working**: [List stable features]
   **About to change**: [What you'll modify]
   **Risk level**: [Low/Medium/High]
   **Rollback**: git log --oneline -10 # Find commit: [commit-hash]
   ```
3. Proceed with changes
4. If successful, mark checkpoint as ✅
5. If failed, use rollback command to restore

### Active Checkpoints

**None currently** - Create one before next major change

### Checkpoint History

_Recent checkpoints will be listed here as they're created_

---

## 🎯 Current Status

### Project State

**Wizard of Oz (Baby Photo Alignment App)**:
- **Status**: 🟢 FULLY WORKING - Auto-alignment with eye detection (PRODUCTION READY)
- **Vercel URL**: (User has deployment URL)
- **Repository Path**: `Aperture/projects/wizard-of-oz`
- **Supabase URL**: `https://zaruvcwdqkqmyscwvxci.supabase.co`
- **Latest Changes**:
  - ✅ Photo alignment fully implemented and debugged (Session 13)
  - ✅ Fixed infinite loop bug (hasAlignedRef tracking)
  - ✅ Fixed upside-down images (180° rotation)
  - Photos auto-align to standardized 1080x1350 format
  - Eyes positioned at 40% from top, horizontally centered
  - All processing client-side (privacy-first, zero server cost)
  - Ready for timelapse generation with consistently aligned frames

### Infrastructure Status

**✅ Fully Operational**:
- Upload system working
- Eye detection working (Gemini AI)
- Database tables exist
- Storage buckets configured
- Environment variables set
- Observability system implemented (`/vercel-logs` available)

### Recent Improvements

**Client-Side Photo Alignment** (Session 13 - 2025-10-13):
- ✅ **Implemented automatic photo alignment**
  - Created `alignPhoto()` function using Canvas API affine transformation
  - Calculates rotation, scale, and translation from eye coordinates
  - Outputs standardized 1080x1350 images with eyes at target positions
- ✅ **Integrated into upload workflow**
  - Alignment triggers automatically after eye detection
  - Visual progress: "Detecting..." → "Aligning..." → "Aligned!"
  - Graceful fallback to original if alignment fails
- ✅ **Debugged and fixed production issues**
  - Fixed infinite loop with hasAlignedRef tracking (prevents re-triggering)
  - Fixed upside-down images with 180° rotation after transformation
  - Upload button now works correctly without getting stuck
- ✅ **Technical implementation**
  - Target dimensions: 1080x1350 (4:5 aspect ratio for social media)
  - Target eye positions: Left (33%, 40%), Right (67%, 40%)
  - Transformation: translate → rotate → scale → rotate(180°) → draw
  - All processing client-side (privacy-first, zero cost)
  - Final bundle: 346.15 KB (1.89 KB increase for alignment logic)

**Ruthless Codebase Refactor** (Session 13 - 2025-10-13):
- ✅ **Deleted 850+ lines of dead code**
  - Removed MonitorDashboard.tsx (236 lines) - unused component
  - Removed SoundtrackGenerator.tsx (342 lines) - placeholder feature
  - Removed 5 unused API endpoints (analyze-music-mood, generate-timelapse-soundtrack, etc.)
  - Removed api/lib/ folder with unused utilities
  - Removed detect-eyes.ts.disabled (obsolete server-side detection)
- ✅ **Improved type safety**
  - Removed all `any` types from codebase
  - Fixed Supabase type issues
  - Replaced `any` with `unknown` in error handling
- ✅ **Code quality improvements**
  - Created lib/imageUtils.ts (extracted utilities from UploadPhoto)
  - Reduced UploadPhoto from 443 to 376 lines
  - Removed 48+ debug console.logs (kept only critical errors)
  - Simplified PhotoGallery polling logic (removed obsolete processing state)
- ✅ **Build verification** - All changes validated, build passes with no errors

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

### Priority 2: ✅ COMPLETE - Client-Side Photo Alignment (PRODUCTION READY)

**Status**: Deployed, tested, and fully working!

**Implementation**: Client-Side Alignment (Option A)
- ✅ Created `alignPhoto()` function in `lib/imageUtils.ts`
- ✅ Integrated into UploadPhoto component workflow
- ✅ Photos automatically align after eye detection
- ✅ All processing client-side using Canvas API
- ✅ Target dimensions: 1080x1350 with eyes at (33%, 40%) and (67%, 40%)
- ✅ Fixed infinite loop bug with hasAlignedRef tracking
- ✅ Fixed upside-down images with 180° rotation correction

**How It Works**:
1. User selects photo → MediaPipe detects eyes
2. `alignPhoto()` calculates transformation:
   - Rotation angle from eye positions
   - Scale factor to match target eye distance
   - Translation to center eyes at target positions
   - **180° rotation to correct orientation**
3. Canvas API applies affine transformation
4. Aligned photo (1080x1350) uploaded to Supabase
5. Gallery displays consistently aligned photos

**Transformation Sequence** (imageUtils.ts:167-183):
```typescript
ctx.translate(targetCenterX, targetCenterY); // Move to target
ctx.rotate(-angle);                          // Align eyes horizontally
ctx.scale(scale, scale);                     // Match eye distance
ctx.rotate(Math.PI);                         // Flip right-side up
ctx.drawImage(img, -sourceCenterX, -sourceCenterY); // Draw
```

**Files Modified** (3 commits):
- `src/lib/imageUtils.ts` - Added `alignPhoto()` function + orientation fix
- `src/components/UploadPhoto.tsx` - Added alignment workflow + loop prevention
- `src/stores/usePhotoStore.ts` - Updated comments for clarity

**Commits**:
- `9343178` - Initial alignment implementation
- `254c573` - Fixed infinite loop (hasAlignedRef)
- `1da49b8` - Fixed orientation attempt 1
- `0b7cfc0` - Fixed orientation with 180° rotation ✅

### Priority 3: 🎬 NEXT - Timelapse Generation

**Status**: Ready to implement (Session 14+)

**Now that photos are aligned**, we can generate smooth timelapses!

**Implementation Options**:

**Option A: Client-Side Video Generation (Recommended)**
- Use browser MediaRecorder API or FFmpeg.wasm
- Create video directly in browser
- Privacy-first (no server upload needed)
- Can preview before saving

**Option B: Server-Side with FFmpeg**
- Vercel serverless function
- Download all aligned photos
- Use FFmpeg to create MP4
- Return video URL

**Features to Consider**:
- [ ] Crossfade transitions between frames (2-3 seconds per photo)
- [ ] Duration control (total video length)
- [ ] Music/soundtrack overlay (from Session 7 planning)
- [ ] Export formats (MP4, WebM)
- [ ] Resolution options (1080p, 720p)

### Priority 4: 📊 ONGOING - Monitor Production Health

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
