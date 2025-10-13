# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Last Updated**: 2025-10-13 23:30 (Session 9 - Photo Alignment Debugging)
>
> **Current Work**: Fixing photo alignment algorithm - rotation works, translation broken

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

### Priority 1: 🔄 IN PROGRESS - Fix Photo Alignment Algorithm (Session 9 - Continuation)

**Current Status**: 🟡 Alignment algorithm being rebuilt step-by-step

**What Happened**:
- Session 8 TypeScript/Sharp implementation did NOT work in production
- Reverted to Python approach: `/api/align-photo-v4.py` (NOT `.ts`)
- Discovered rotation works but translation is completely broken
- Eyes end up far from predicted positions (forehead centered instead of eyes)

**Root Causes Identified**:
1. ❌ Coordinate tracking through transformations is unreliable with warpAffine
2. ❌ Every attempted translation causes massive position errors
3. ❌ Tried scipy.ndimage.rotate → exceeded 250MB Vercel limit
4. ✅ Using cv2.warpAffine for rotation (working)
5. ❌ Translation via array cropping not working yet

**Session 9 Progress** (2025-10-13):

**Research Completed**:
- ✅ Investigated AgeLapse (Flutter app) - uses Scale → Rotate → Translate order
- ✅ Investigated EyeLign (Python CLI) - uses face_recognition library
- ✅ Decision: Continue with current approach (simpler than theirs)
- ✅ Documented Vercel build log access in `.process/OBSERVABILITY.md`
  - How to fetch deployment events API
  - Critical: text is in `payload.text` not top-level `text`
  - Common build errors documented

**Technical Fixes Applied**:
- ✅ Removed scipy dependency (caused 250MB limit error)
- ✅ Switched rotation from scipy to cv2.warpAffine with rotation matrix
- ✅ Implemented array-based cropping for translation (not yet verified)
- ✅ Added comprehensive debug logging with visual markers

**Current Implementation** (`align-photo-v4.py`):
1. ✅ **Rotation**: Using cv2.warpAffine around image center - WORKING
2. 🔄 **Translation**: Array slicing to crop centered on eye midpoint - NEEDS TESTING
3. ❌ **Scaling**: Not implemented yet (will add after translation works)

**What's Deployed**:
- File: `projects/wizard-of-oz/api/align-photo-v4.py`
- Endpoint: `/api/align-photo-v4` (Python serverless function)
- Dependencies: opencv-python-headless, numpy (no scipy)
- Status: 🟢 Builds successfully, 🟡 Translation needs verification

**Next Action Required**: User needs to test current translation fix

### Priority 2: Verify Translation Works

**Testing Plan**:
- [ ] Upload 3-5 test photos via Wizard of Oz UI
- [ ] Monitor Vercel logs during processing:
  ```bash
  /vercel-logs align-photo-v4 20
  ```
- [ ] Verify success criteria:
  - Processing time < 10 seconds per photo
  - Eye positions within ±5px of targets (720, 432) and (360, 432)
  - No errors in production logs
  - Aligned photos look visually correct
- [ ] Download aligned results and verify eye positions manually
- [ ] If any issues: Check logs, adjust algorithm, redeploy

**Expected Results**:
- Coordinate scaling bug fixed (90-minute debugging waste prevented)
- Accurate eye alignment using similarity transform
- Fast processing (Sharp is optimized for serverless)

### Priority 3: Post-Validation Tasks (if testing succeeds)

- [ ] Mark old failed photos for reprocessing (if needed)
- [ ] Monitor production usage for first week
- [ ] Document any edge cases discovered
- [ ] Consider adding alignment accuracy metrics to database

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
