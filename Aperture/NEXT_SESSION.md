# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Updated**: 2025-10-12 (Clean Slate)

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

**Debugging Protocol & Photo Alignment** (Current Session):
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

### Priority 1: Production Integration of OpenCV Alignment

**Current State**:
- ✅ Working Python OpenCV script (`align_photo_opencv.py`)
- ✅ Coordinate scaling fix identified and tested
- ✅ Successful local validation with real photos
- ❌ Not yet integrated into production Vercel API

**What's Needed**:

#### Step 1: Create Production Node.js Wrapper (30 min)

- [ ] Create new API endpoint `/api/align-photo-v4.ts`
- [ ] Implement coordinate scaling logic:
  ```typescript
  const scaleFactor = actualImageWidth / detectionImageWidth;
  const scaledCoords = {
    leftEye: {
      x: dbCoords.leftEye.x * scaleFactor,
      y: dbCoords.leftEye.y * scaleFactor
    },
    rightEye: {
      x: dbCoords.rightEye.x * scaleFactor,
      y: dbCoords.rightEye.y * scaleFactor
    }
  };
  ```
- [ ] Add input validation (verify dimensions match assumptions)
- [ ] Spawn Python subprocess to call `align_photo_opencv.py`
- [ ] Handle errors and edge cases
- [ ] Add production logging (processing time, success/failure)

#### Step 2: Deploy and Test (30 min)

- [ ] Install Python + opencv-python-headless in Vercel environment
- [ ] Deploy to Vercel
- [ ] Upload 3-5 test photos via UI
- [ ] Wait for processing and check logs
- [ ] Download aligned results and verify eye positions
- [ ] Measure accuracy: eyes within ±5px of targets?

#### Step 3: Cleanup (20 min)

- [ ] Remove old alignment implementations (v2, v3)
- [ ] Delete test scripts from `projects/wizard-of-oz/`:
  - `test-opencv-alignment.cjs`
  - `test-hybrid-alignment.cjs`
  - `debug-coordinates.cjs`
  - Other debugging scripts
- [ ] Keep `align_photo_opencv.py` (production dependency)
- [ ] Clean up `test-output/` directory
- [ ] Update database: mark old failed photos for reprocessing if needed

#### Step 4: Validation & Documentation (15 min)

- [ ] Verify success criteria:
  - Processing time < 10 seconds per photo
  - Eye positions within ±5px of targets
  - No errors in production logs
- [ ] Document the solution in code comments
- [ ] Update NEXT_SESSION.md with final status

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

**🚨 MANDATORY: Read this FIRST before debugging any issue**

If anything isn't working as expected:

1. **STOP** - Don't debug the algorithm yet
2. **READ** `META_DEBUGGING_PROTOCOL.md` (5 minutes)
3. **VERIFY** inputs match your assumptions (2 minutes)
4. **ONLY THEN** debug the logic

**Why?** 80% of bugs are input issues, not algorithm issues. Verifying inputs first saves hours of wasted debugging time.

**Quick rule**: If debugging takes >15 minutes, you're probably debugging the wrong thing. Go verify inputs again.

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

**Last Updated**: 2025-10-12 (Post-Alignment-Breakthrough)
**Status**: OpenCV solution working locally, needs production integration
**Token Budget**: Healthy (~48K tokens used)
