# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Last Updated**: 2025-10-13 (Session 9 - Eye Detection Debugging)
>
> **Current Work**: Debugging Gemini eye detection - Y coordinates too high

---

## 🎯 Current Status

### Project State

**Wizard of Oz (Baby Photo Alignment App)**:
- **Status**: 🟢 READY FOR WORK
- **Vercel URL**: (User has deployment URL)
- **Repository Path**: `Aperture/projects/wizard-of-oz`
- **Supabase URL**: `https://zaruvcwdqkqmyscwvxci.supabase.co`

### Infrastructure Status

**✅ Fully Operational**:
- Upload system working
- Eye detection working (Gemini AI)
- Database tables exist
- Storage buckets configured
- Environment variables set
- Observability system implemented (`/vercel-logs` available)

### Recent Improvements

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

### Priority 1: 🔴 BLOCKED - Fix Gemini Eye Detection (Session 9 - Continuation)

**Current Status**: 🔴 Gemini AI detecting eyes with incorrect Y coordinates

**What Happened** (Session 9 - 2025-10-13):
- Stripped out ALL transformation logic to debug input data (following META_DEBUGGING_PROTOCOL)
- Created visual debug mode: draws green dots on original image at detected positions
- **DISCOVERY**: Green dots appear WAY ABOVE baby's head, not on eyes at all
- Y coordinates are too high by significant margin (dots in background/blanket area)
- X coordinates appear roughly correct (horizontal positioning seems OK)

**Root Cause Identified**:
- ❌ **Gemini's Y coordinates are wrong** - detecting positions too high in image
- ✅ X coordinates appear reasonable
- ❌ Attempted fix: Swapped left/right eye labels (thinking mirror image) - didn't help
- Real problem: Y axis coordinates are systematically too high

**Session 9 Debug Progress**:

**What We Tried**:
1. ✅ Stripped transformation logic completely
2. ✅ Added visual debug mode (green dots on original image)
3. ✅ Added detailed coordinate logging (before/after scaling)
4. ❌ Swapped left/right eye labels (didn't fix Y coordinate problem)

**Current Implementation** (`align-photo-v4.py`):
- **Mode**: DEBUG ONLY - no transformation applied
- **Output**: Original image with green dots at Gemini's detected positions
- **Purpose**: Verify Gemini's detection accuracy before implementing transformation
- **Status**: Green dots NOT on eyes - too high in image

**What's Deployed**:
- File: `projects/wizard-of-oz/api/align-photo-v4.py`
- Endpoint: `/api/align-photo-v4` (Python serverless function)
- Mode: Debug visualization only
- Status: 🟢 Builds successfully, 🔴 Detection coordinates wrong

**Next Action Required**: Fix Gemini's Y coordinate detection

### Priority 2: Debug Gemini Detection - Get Logs

**Immediate Next Steps**:
1. [ ] User uploads test photo
2. [ ] Check Vercel runtime logs for actual coordinates:
   ```bash
   # Check Vercel dashboard OR
   /vercel-logs align-photo-v4 10
   ```
3. [ ] Analyze logs to understand:
   - What coordinates is Gemini actually returning?
   - What are the detection image dimensions vs actual dimensions?
   - What is the scale factor being applied?
   - Are scaled coordinates correct?

**Possible Root Causes to Investigate**:
1. **Gemini prompt issue**: Maybe prompt isn't clear about coordinate system
2. **Coordinate scaling bug**: Maybe we're scaling Y incorrectly
3. **Image orientation**: Maybe EXIF rotation is affecting coordinates
4. **Gemini sends normalized coords**: Maybe Gemini returns 0-1 normalized, not pixels
5. **Origin mismatch**: Maybe Gemini uses bottom-left origin, we assume top-left

### Priority 3: Fix Gemini Detection (after analyzing logs)

**Options to Try** (based on log analysis):
1. Update Gemini prompt to clarify coordinate system
2. Fix coordinate scaling if calculation is wrong
3. Handle EXIF orientation before detection
4. Convert coordinate system if Gemini uses different origin
5. Add offset/calibration factor if systematic error
6. Switch to different detection method (OpenCV Haar Cascade, face_recognition library)

### Priority 4: Re-implement Transformation (after detection works)

- [ ] Once green dots appear ON eyes, re-implement EyeLign transformation
- [ ] Test with 3-5 photos
- [ ] Verify eyes at target positions (720, 432) and (360, 432)
- [ ] Monitor production for first week

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
