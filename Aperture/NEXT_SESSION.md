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

### Priority 1: Complete Rebuild of Photo Alignment Process

**Goal**: Rebuild alignment pipeline from scratch with empirical validation at each step

**Philosophy**: Test with real-world evidence, not theoretical assumptions. Validate every step before proceeding to the next.

---

#### Phase 1: Evidence Gathering & Current State Analysis (30 min)

**Step 1.1: Understand Current Implementation**
- [ ] Read existing alignment code (`align-photo-v2.ts`, `align-photo-v3.ts` if exists)
- [ ] Document current algorithm approach and target coordinates
- [ ] Identify what's already been tried

**Step 1.2: Collect Real-World Data**
- [ ] Use `/vercel-logs` to fetch recent alignment attempts
- [ ] Download 3-4 aligned photos from storage bucket
- [ ] Download corresponding original photos
- [ ] Extract actual eye coordinates from database for these photos

**Step 1.3: Visual Analysis**
- [ ] Manually stack aligned photos in image editor
- [ ] Measure actual eye position drift (horizontal, vertical, rotation)
- [ ] Document drift pattern with specific measurements
- [ ] Compare with target coordinates from algorithm

**Step 1.4: Root Cause Hypothesis**
- [ ] Based on evidence, formulate specific hypothesis
- [ ] Identify which component is failing (detection, rotation, scaling, cropping)
- [ ] Create testable prediction for next phase

---

#### Phase 2: Build Test Harness (45 min)

**Step 2.1: Create Validation Tools**
- [ ] Build script to visualize eye positions on images
- [ ] Create overlay tool to compare detected vs. target positions
- [ ] Add debug output mode that saves intermediate images (rotated, scaled, cropped)

**Step 2.2: Establish Ground Truth**
- [ ] Select 3 test photos with clear, front-facing eyes
- [ ] Manually verify Gemini detection accuracy on test set
- [ ] Document "known good" coordinates for validation

**Step 2.3: Create Measurement System**
- [ ] Script to measure eye positions in final aligned images
- [ ] Automated comparison: expected vs. actual positions
- [ ] Define success criteria (e.g., ≤5px error acceptable)

---

#### Phase 3: Algorithm Rebuild - Incremental with Validation (2-3 hours)

**Step 3.1: Eye Detection Validation**
- [ ] Test: Run detect-eyes on test photos
- [ ] Verify: Visual overlay of detected points on originals
- [ ] Measure: Are detections consistent? (run 3x on same photo)
- [ ] Decision: If inconsistent, need to add averaging or switch detection method
- [ ] ✅ GATE: Don't proceed until detection is reliable

**Step 3.2: Rotation Transform**
- [ ] Implement: Rotate image to level eyes
- [ ] Test: Save rotated intermediate image
- [ ] Verify: Eyes are horizontal (measure angle)
- [ ] Measure: Do eye coordinates transform correctly?
- [ ] ✅ GATE: Eyes must be within 1° of horizontal

**Step 3.3: Scaling Transform**
- [ ] Implement: Scale to target inter-eye distance (360px)
- [ ] Test: Measure distance between eyes in scaled image
- [ ] Verify: Distance = 360px ±2px
- [ ] Measure: Are eye coordinates still accurate after scaling?
- [ ] ✅ GATE: Inter-eye distance must match target

**Step 3.4: Crop/Position Transform**
- [ ] Implement: Extract 1080×1080 region with eyes at targets
- [ ] Test: Overlay target points on cropped image
- [ ] Verify: Left eye at (720, 432), Right eye at (360, 432)
- [ ] Measure: Actual position vs. target (should be ≤5px error)
- [ ] ✅ GATE: Eye positions must be within tolerance

**Step 3.5: Edge Case Handling**
- [ ] Test: Photo where eyes are at image edge
- [ ] Test: Photo requiring canvas extension
- [ ] Test: Extreme rotation (baby tilted 30°+)
- [ ] Verify: All cases produce valid 1080×1080 output
- [ ] ✅ GATE: No crashes, all outputs have eyes in target positions

---

#### Phase 4: Integration & End-to-End Testing (1 hour)

**Step 4.1: Deploy New Algorithm**
- [ ] Deploy to Vercel
- [ ] Verify deployment successful
- [ ] Check logs for any initialization errors

**Step 4.2: Real Upload Test**
- [ ] Upload 5 diverse test photos (different angles, lighting, positions)
- [ ] Wait for processing
- [ ] Download all 5 aligned images

**Step 4.3: Empirical Validation**
- [ ] Stack all 5 aligned images in editor
- [ ] Measure eye position variance across stack
- [ ] Compare to success criteria (≤5px drift)
- [ ] Visual inspection: Do they look properly aligned?

**Step 4.4: Performance Testing**
- [ ] Check processing times (should be <10 seconds per photo)
- [ ] Verify storage usage is reasonable
- [ ] Check for memory issues in logs

---

#### Phase 5: Cleanup & Documentation (30 min)

**Step 5.1: Remove Old Code**
- [ ] Delete deprecated alignment implementations
- [ ] Remove excessive debug logging
- [ ] Clean up test files/scripts

**Step 5.2: Add Production Logging**
- [ ] Keep key metrics: processing time, error measurements
- [ ] Remove verbose coordinate dumps
- [ ] Add success/failure indicators

**Step 5.3: Document Algorithm**
- [ ] Update code comments with algorithm explanation
- [ ] Document coordinate system and transforms
- [ ] Add troubleshooting guide for future issues

---

### Success Criteria

**Must achieve before considering complete**:
1. ✅ 5 diverse test photos stack with ≤5px eye position variance
2. ✅ Visual inspection confirms proper alignment
3. ✅ Processing completes in <10 seconds per photo
4. ✅ No errors in production logs
5. ✅ Algorithm documented with clear comments

**Evidence required**:
- Screenshots of stacked images showing alignment
- Measurement data from test harness
- Production logs showing successful processing
- Database records with populated aligned_url

---

### Key Principles for This Rebuild

1. **Evidence-Based**: Every decision backed by measurements, not theory
2. **Incremental Validation**: Don't build step N+1 until step N is proven
3. **Save Intermediate Outputs**: Inspect rotated, scaled, cropped images separately
4. **Measure Everything**: Track actual coordinates at every transform
5. **Gate at Each Phase**: Clear go/no-go criteria before proceeding
6. **No Assumptions**: Test even "obvious" things with real data

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

**Last Updated**: 2025-10-12
**Status**: Clean slate, ready for next task
**Token Budget**: Healthy
