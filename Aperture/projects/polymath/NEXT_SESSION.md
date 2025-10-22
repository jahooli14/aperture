# Polymath - Next Session

> **Status**: 🟢 Memory Onboarding System - Foundation Complete, Ready to Build
> **Last Updated**: 2025-10-22
> **Next**: Run database migrations and start implementing UI/API

---

## 🎉 Latest Session - Memory Onboarding System Designed (2025-10-22)

### ✅ What Was Built

**1. Complete Specification** ✅
- File: `MEMORY_ONBOARDING_SPEC.md`
- 40 memory prompts (10 required, 30 optional)
- AI gap detection with Gemini Flash 2.5
- Node strengthening algorithm
- Dormant project resurfacing
- Synthesis transparency ("Why this matches you")
- Mobile-first UX flows

**2. Database Schema** ✅
- File: `migration-memory-onboarding.sql`
- New tables:
  - `memory_prompts` - 40 template prompts
  - `memory_responses` - User's 3+ bullet responses
  - `user_prompt_status` - Completion tracking per user
  - `project_notes` - Project journal entries
- Extended tables:
  - `projects.days_dormant` - Auto-computed dormancy
  - `project_suggestions.source_analysis` - Synthesis transparency
- Helper functions:
  - `get_memory_progress(user_id)` - Check completion percentage
  - `has_unlocked_projects(user_id)` - Gate at 10 memories

**3. Seed Data** ✅
- File: `scripts/seed-memory-prompts.sql`
- 40 prompts organized by category
- Categories: Core Identity, Relationships, Places, Career, Interests, Life Events, Daily Life, Aspirations, Creative/Professional

**4. TypeScript Types** ✅
- File: `src/types.ts` (enhanced)
- All interfaces for memory system
- Project enhancements (notes, dormancy)
- Synthesis transparency types
- Node strengthening types
- API response types

**5. Implementation Guide** ✅
- File: `IMPLEMENTATION_READY.md`
- Phase-by-phase build plan
- API endpoint code examples
- Component specifications
- Testing checklist
- Success criteria

---

## 🚀 Immediate Next Steps

### **Step 1: Database Setup** (30 mins)

```bash
# 1. Open Supabase SQL Editor
# 2. Run migration-memory-onboarding.sql
# 3. Run scripts/seed-memory-prompts.sql

# 4. Verify
SELECT COUNT(*) FROM memory_prompts WHERE is_required = true;
-- Should return: 10

SELECT COUNT(*) FROM memory_prompts;
-- Should return: 40

# 5. Test helper functions
SELECT * FROM get_memory_progress('your-user-id');
SELECT has_unlocked_projects('your-user-id');
```

### **Step 2: Choose Implementation Track**

**Track A: API-First** (Backend)
1. `api/memory-prompts.ts` - Get prompts with user status
2. `api/memory-responses.ts` - Submit responses with validation
3. `api/projects/nudges.ts` - Dormant project detection
4. `api/projects/[id]/notes.ts` - Add journal entries
5. `api/projects/[id]/quick-update.ts` - Quick status changes
6. `api/synthesis/active-skills.ts` - Strengthened nodes

**Track B: UI-First** (Frontend)
1. `FoundationalPrompts.tsx` - Show 10 required prompts
2. `PromptModal.tsx` - Full-screen mobile prompt entry
3. `ProgressBar.tsx` - Visual completion tracking
4. `SuggestedPrompts.tsx` - AI-generated follow-ups
5. `DormantProjectNudge.tsx` - Sticky resurrection nudges
6. `SynthesisTransparency.tsx` - "Why this matches" section

---

## 📋 System Overview

### User Flow

```
New User
  ↓
10 Foundational Prompts (3+ bullets each)
  ↓
AI Gap Detection (Gemini Flash 2.5 analyzes ALL memories)
  ↓
Projects Section Unlocks
  ↓
[Ongoing] AI suggests follow-up prompts
[Ongoing] User adds ad-hoc memories
[Weekly] Synthesis uses memories for project suggestions
```

### Key Mechanisms

**Memory Onboarding:**
- 10 required prompts before projects unlock
- 3+ bullet minimum per response
- AI validates quality (Gemini Flash 2.5)
- Gap detection suggests 0-2 follow-ups per submission

**Node Strengthening:**
- Git commits scanned daily (00:00 UTC)
- Files mapped to capabilities
- Strength boost: +0.10 to +0.30 per commit
- Higher strength = more appearances in suggestions

**Dormant Project Resurfacing:**
- 7 days: Gentle reminder
- 30 days: Strong nudge
- 90 days: Archive suggestion
- AI learns dormancy patterns over time

**Synthesis Transparency:**
- Every suggestion shows sources
- "You have: [capabilities]"
- "You love: [interests from memories]"
- Shows strength boost if built (+0.30)

---

## 🎯 Design Principles

1. **3-bullet constraint** - Forces clarity, prevents vague responses
2. **Mobile-first** - Thumb zones, bottom CTAs, swipe gestures
3. **AI everywhere** - Gap detection, quality validation, synthesis
4. **Visual feedback** - Progress bars, strength changes, node boosts
5. **Low friction** - Quick updates, offline drafts, haptic feedback
6. **Transparency** - Show exact sources for every suggestion

---

## 📊 Implementation Estimate

| Phase | Time | Status |
|-------|------|--------|
| Database setup | 30 mins | ⏳ Next |
| API endpoints | 6 hours | ⏳ Pending |
| UI components | 12 hours | ⏳ Pending |
| Helper functions | 3 hours | ⏳ Pending |
| Zustand stores | 2 hours | ⏳ Pending |
| Testing & polish | 3 hours | ⏳ Pending |
| **Total** | **~27 hours** | **0% complete** |

---

## 📁 Files Created This Session

```
projects/polymath/
├── MEMORY_ONBOARDING_SPEC.md              ← Full specification
├── IMPLEMENTATION_READY.md                ← Build guide
├── migration-memory-onboarding.sql        ← Database schema
├── scripts/
│   └── seed-memory-prompts.sql            ← 40 prompts
└── src/
    └── types.ts                           ← Enhanced (memory types added)
```

---

## 🧪 Testing Checklist

### Database
- [ ] Run migration-memory-onboarding.sql
- [ ] Run seed-memory-prompts.sql
- [ ] Verify 40 prompts inserted
- [ ] Test `get_memory_progress` function
- [ ] Test `has_unlocked_projects` function
- [ ] Verify RLS policies work

### API
- [ ] GET /api/memory-prompts returns correct structure
- [ ] POST /api/memory-responses validates 3+ bullets
- [ ] AI quality check rejects poor responses
- [ ] Gap detection generates 0-2 follow-ups
- [ ] Progress unlocks projects at 10 memories
- [ ] Dormant nudges appear at correct thresholds

### UI
- [ ] FoundationalPrompts shows 10 in order
- [ ] PromptModal enforces 3+ bullets
- [ ] Progress bar updates accurately
- [ ] Projects unlock message appears
- [ ] Dormant nudges sticky at top
- [ ] Quick update increments progress
- [ ] Synthesis transparency shows sources
- [ ] Active skills widget filters suggestions

### Mobile
- [ ] All components render on 360px width
- [ ] FAB positioned bottom-right (thumb zone)
- [ ] Bottom sheets slide up smoothly
- [ ] Swipe gestures work (left/right/up)
- [ ] Haptic feedback triggers
- [ ] Offline drafts saved locally

---

## 🎯 Success Criteria

When complete, we should see:

- [ ] New user completes 10 prompts in <30 minutes
- [ ] AI generates 0-2 relevant follow-up prompts per submission
- [ ] Project suggestions unlock after 10 memories
- [ ] Dormant projects resurface within 24 hours
- [ ] Mobile UX is one-handed friendly
- [ ] Node strengthening reflects git activity (±7 days)
- [ ] Synthesis shows "Why this matches you" with exact quotes

---

## 💡 Key Insights from Design

1. **3-bullet constraint** - Brilliant forcing function, prevents vagueness
2. **Gap detection is the secret sauce** - Keeps users engaged, feels magical
3. **Dormant project resurrection** - Unlike other PM tools, we bring projects back
4. **Node strengthening feedback loop** - Build more → capability strengthens → more suggestions
5. **Transparency builds trust** - Showing exact sources makes AI feel less black-box

---

## 📚 Documentation

**Read These First:**
- `MEMORY_ONBOARDING_SPEC.md` - Full system design
- `IMPLEMENTATION_READY.md` - Step-by-step build guide

**Reference:**
- `CONCEPT.md` - Original vision
- `ARCHITECTURE.md` - Technical design
- `API_SPEC.md` - API reference
- `UI_COMPONENTS.md` - Component specs

---

## 🚨 Important Reminders

1. **Always use Gemini Flash 2.5** - Million token context = send ALL memories every time
2. **Mobile-first** - Test on 360px width, thumb zones matter
3. **3+ bullets enforced** - Hard requirement, AI validates quality
4. **Projects locked until 10 memories** - No bypass, no exceptions
5. **Synthesis transparency required** - Every suggestion must show exact sources

---

## 🎬 Next Session Start Here

1. Open Supabase SQL Editor
2. Run `migration-memory-onboarding.sql`
3. Run `scripts/seed-memory-prompts.sql`
4. Verify: `SELECT COUNT(*) FROM memory_prompts` → 40
5. Choose track: API-first or UI-first
6. See `IMPLEMENTATION_READY.md` for detailed guide

---

## 🏁 Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Memory Onboarding** | 🟡 Designed | Foundation complete, needs implementation |
| **Voice Capture** | ✅ Working | Audiopen webhook → Memory storage |
| **Memory Browsing** | ✅ Working | Resurfacing with spaced repetition |
| **Entity Extraction** | ✅ Working | AI-powered metadata |
| **Bridge Discovery** | ✅ Working | Connection finding |
| **Tech Synthesis** | ✅ Working | Capability combinations |
| **Creative Synthesis** | ✅ Working | Interest combinations |
| **Project Management** | ✅ Working | Full CRUD |
| **Capability Scanning** | ✅ Working | Git-based extraction |
| **Node Strengthening** | 🟡 Designed | Algorithm ready, needs implementation |
| **Dormant Resurfacing** | 🟡 Designed | Logic ready, needs implementation |
| **Synthesis Transparency** | 🟡 Designed | Structure ready, needs UI |

---

## 🎨 What This System Enables

### For Users
- **Structured memory capture** instead of scattered voice notes
- **AI-guided exploration** via follow-up prompts
- **Progressive unlocking** (10 memories → projects)
- **Project resurrection** (dormant nudges)
- **Transparent AI** ("Here's why I suggested this")
- **Mobile-optimized** (thumb-friendly, swipe gestures)

### For System
- **Rich knowledge graph** from 3-bullet responses
- **Better synthesis** from structured memories
- **Feedback loops** via node strengthening
- **Pattern recognition** from dormancy tracking
- **Quality enforcement** via AI validation

---

**Status**: 🟢 Foundation complete, ready for 27 hours of implementation
**Difficulty**: Medium (well-specified, clear path forward)
**Estimated completion**: 3-4 focused work days

**Let's ship this!** 🚀
