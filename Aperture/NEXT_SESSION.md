# Next Session - Quick Start Guide

> **🚨 IMPORTANT**: If starting a NEW session, read `START_HERE.md` FIRST, then come back here.
>
> **Purpose**: Current status and immediate next steps.
>
> **Updated**: 2025-10-13 (Documentation Restructure Complete)

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

### Priority 1: ✅ COMPLETE - Production Integration of Alignment (Session 8)

**Implementation Summary**:
- ✅ Created `/api/align-photo-v4.ts` with pure TypeScript/Sharp implementation
- ✅ Implemented coordinate scaling logic with input validation
- ✅ Converted from Python/OpenCV to TypeScript similarity transform
  - Created `api/lib/alignment.ts` with `calculateSimilarityTransform()`
  - Same mathematical correctness as OpenCV's `estimateAffinePartial2D`
  - Uses Sharp's `affine()` method for image transformation
- ✅ Successfully deployed to Vercel (no Python dependencies needed)
- ✅ Updated `detect-eyes.ts` to call v4 endpoint
- ✅ Cleaned up test scripts and artifacts
  - Deleted 9 test/debug scripts
  - Removed test-output/ directory (33 test images, ~1.5MB)
  - Organized utilities into `tools/` directory with README

**What's Ready**:
- Production API endpoint: `/api/align-photo-v4`
- Deployment URL: `https://aperture-p5ei57lxj-daniels-projects-ca7c7923.vercel.app`
- Status: ✅ **READY FOR TESTING** - All bugs fixed

**Bug Fixes Applied (Session 8)**:
- ✅ Fixed "photos stuck uploading" - Added auto-refresh polling (every 5s)
- ✅ Fixed "Bucket not found" error - Changed from 'photos' to 'originals' bucket
- ✅ Removed non-existent `processing_status` field from database updates

**User Experience Now**:
1. Upload photo → appears immediately with "⏳ Processing..." badge
2. Gallery auto-refreshes every 5 seconds while processing
3. When alignment completes → badge changes to "✓ Aligned"
4. Photo updates to show aligned version

**Next Action Required**: End-to-end testing with real photos

### Priority 2: Validation & Testing (Ready Now!)

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
