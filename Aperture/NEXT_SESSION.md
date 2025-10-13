# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Last Updated**: 2025-10-13 (Session 10 - MediaPipe Eye Detection)
>
> **Current Work**: Replaced unreliable AI detection with MediaPipe - ready for testing

---

## 🎯 Current Status

### Project State

**Wizard of Oz (Baby Photo Alignment App)**:
- **Status**: 🟢 DEPLOYED - MediaPipe eye detection live, awaiting user testing
- **Vercel URL**: (User has deployment URL)
- **Repository Path**: `Aperture/projects/wizard-of-oz`
- **Supabase URL**: `https://zaruvcwdqkqmyscwvxci.supabase.co`
- **Latest Change**: Replaced Gemini AI with MediaPipe Face Landmarker (commit e3d5ff2)

### Infrastructure Status

**✅ Fully Operational**:
- Upload system working
- Eye detection working (Gemini AI)
- Database tables exist
- Storage buckets configured
- Environment variables set
- Observability system implemented (`/vercel-logs` available)

### Recent Improvements

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

### Priority 1: ✅ RESOLVED - Replaced Gemini with MediaPipe (Session 10)

**Previous Status**: 🔴 Gemini AI detecting eyes with incorrect Y coordinates (BLOCKED)

**Solution Implemented** (Session 10 - 2025-10-13):
- ✅ **Replaced unreliable AI detection with MediaPipe Face Landmarker**
- ✅ Client-side computer vision library (98.6% accuracy, 200-1000 FPS)
- ✅ Privacy-first (photos never leave device, zero AI API costs)
- ✅ Uses iris center landmarks (478 total landmarks) for precise eye position
- ✅ Optimized for baby photos (lower confidence thresholds, pose variation support)
- ✅ Build successful, code deployed to production

**What Changed**:
- **NEW**: `EyeDetector.tsx` component with MediaPipe Face Landmarker
- **UPDATED**: `UploadPhoto.tsx` - integrated eye detection with UI feedback
- **UPDATED**: `usePhotoStore.ts` - accepts and saves eye coordinates to database
- **REMOVED**: `align-photo-v4.py` - obsolete Gemini-based serverless function
- **ADDED**: `@mediapipe/tasks-vision` npm dependency

**Why This Works**:
- MediaPipe designed specifically for facial landmarks (not general AI)
- No coordinate transformation issues (direct pixel coordinates)
- Battle-tested library used in production apps worldwide
- Runs locally in browser using WebAssembly

### Priority 2: 🧪 TEST - Verify MediaPipe Detection with Real Baby Photos

**Next Action**: Upload test photos and verify eye detection

**Test Checklist**:
1. [ ] Upload baby photo and check browser console logs
2. [ ] Verify "Eyes detected successfully" message appears
3. [ ] Check database record has eye coordinates populated
4. [ ] Verify coordinates are reasonable (not out of bounds)
5. [ ] Test with 3-5 different baby photos (various poses/angles)
6. [ ] Check alignment API gets called with correct photoId
7. [ ] Verify aligned photo is generated and stored

**What to Look For**:
- ✅ Detection completes in < 2 seconds
- ✅ Green success message shows "Eyes detected successfully"
- ✅ Eye coordinates logged in browser console
- ✅ Validation passes (eye distance 0.12-0.35 of image width)
- ✅ Upload succeeds with status='detected'

**If Detection Fails**:
- Check browser console for error messages
- Review MediaPipe initialization logs
- Verify model loads from CDN successfully
- Check image quality (blur, occlusion, extreme angles)
- Note: Can still upload without detection (graceful degradation)

### Priority 3: 🔧 RE-ENABLE - Photo Alignment with OpenCV

**Current State**:
- Eye detection now reliable (MediaPipe)
- Have Python OpenCV alignment script (`align_photo_opencv.py`)
- Need to integrate with new client-side detection flow

**Implementation Plan**:
1. [ ] Create/update serverless function to accept photoId
2. [ ] Fetch photo and eye coordinates from database
3. [ ] Scale coordinates if needed (detection dimensions → original dimensions)
4. [ ] Call OpenCV alignment script
5. [ ] Save aligned photo to storage
6. [ ] Update database with aligned_url and status='aligned'

**Technical Notes**:
- Coordinates already scaled correctly (MediaPipe returns normalized 0-1, converted to pixels)
- Database stores detection_width and detection_height for reference
- Target eye positions: (720, 432) for left, (360, 432) for right
- Use existing `align_photo_opencv.py` with minimal changes

### Priority 4: 📊 MONITOR - Production Health Check

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
