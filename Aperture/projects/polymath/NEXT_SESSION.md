# Polymath - Next Session

> **Status**: Design phase COMPLETE ✅ | Ready for implementation when you wake up

## 🎉 What's Been Done (Autonomous Session)

### ✅ Complete Documentation Suite

**Vision & Design:**
- `CONCEPT.md` - Evolved vision (MemoryOS + Polymath unified system)
- `ARCHITECTURE.md` - Complete technical design with algorithms
- `RATING_UX.md` - Interaction design and UX flows
- `ROADMAP.md` - 10-phase implementation plan
- `UI_COMPONENTS.md` - React component structure

**Implementation Ready:**
- `migration.sql` - Database schema (6 new tables + extensions)
- `API_SPEC.md` - Complete API documentation
- `DEPENDENCIES.md` - NPM packages and environment variables
- `DEPLOYMENT.md` - Step-by-step deployment checklist

**Scripts (Ready to Run):**
- `scripts/capability-scanner.ts` - Scans Aperture codebase
- `scripts/synthesis.ts` - Weekly AI synthesis engine
- `scripts/strengthen-nodes.ts` - Git activity tracking

---

## 🧠 Quick Context Refresh

**Polymath evolved from:**
- Original: Personal creative project tracker (painting, music, etc.)
- **NOW**: Meta-creative synthesis engine that:
  - Scans Aperture codebase for technical capabilities
  - Extracts interests from MemoryOS memories
  - Generates novel project suggestions (capability + interest Venn overlaps)
  - Strengthens nodes based on activity (reinforcement learning)
  - Anti-echo-chamber diversity injection (wild cards)

**Key Decision:** Same app as MemoryOS (deeply integrated, not separate)

---

## ✨ What Polymath Does

### Two Modes

**Mode 1: Personal Projects**
- Track creative pursuits (painting, writing, music)
- Manual tracking with last_active timestamps

**Mode 2: Meta-Creative Synthesis** (The Big Innovation)
- Weekly AI generates 10 project suggestions
- Combines your capabilities × your interests
- Example: "Voice-annotated photo timeline" (MemoryOS voice + Wizard photos)
- Point allocation: Novelty (30%) + Feasibility (40%) + Interest (30%)
- Every 4th suggestion = wild card (prevents creative narrowing)

### The Feedback Loop

```
Work on project → Capability node strengthens → More suggestions involving that capability
Rate suggestion 👍 → Boost similar ideas | Rate 👎 → Prune (but keep in permanent list)
Build suggestion 💡 → Create project + strengthen nodes significantly
```

---

## 🚀 Next Steps (When You're Ready)

### Phase 1: Database Migration (30 min)

**You need to:**
1. Open Supabase SQL editor
2. Copy/paste `migration.sql`
3. Run it
4. Verify 6 new tables created

**Then you'll have:**
- `projects` - Personal & technical projects
- `capabilities` - Technical capabilities from codebase
- `project_suggestions` - AI-generated ideas
- `suggestion_ratings` - Your feedback
- `node_strengths` - Activity-based strengths
- `capability_combinations` - For novelty scoring

---

### Phase 2: Populate Capabilities (1 hour)

**You need to:**
1. Add NPM dependencies:
   ```bash
   cd projects/memory-os
   npm install @anthropic-ai/sdk openai react-router-dom
   npm install --save-dev @types/node tsx
   ```

2. Add environment variables to Vercel:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...
   USER_ID=<your-supabase-user-id>
   ```

3. Run capability scanner:
   ```bash
   npx tsx ../polymath/scripts/capability-scanner.ts
   ```

**Then you'll have:**
- 20+ capabilities extracted (voice-processing, embeddings, face-alignment, etc.)
- Each with description, strength, source project
- Embeddings for semantic search

---

### Phase 3: Manual Synthesis MVP (Weekend)

**Build these API endpoints:**
- `api/projects.ts` - Projects CRUD
- `api/suggestions.ts` - List suggestions
- `api/suggestions/[id]/rate.ts` - Rating
- `api/synthesis/run.ts` - Manual synthesis

**Build these UI components:**
- `SuggestionCard.tsx` - Card with rating actions
- `SuggestionsPage.tsx` - Weekly digest view
- `ProjectsPage.tsx` - Projects list

**Then you can:**
- Manually trigger synthesis
- Get 10 novel project ideas
- Rate them (👍 👎 💡)
- Build interesting ones
- See permanent ideas list

---

## 📋 Quick Decision Guide

**"Should I start building now?"**
- ✅ Yes, if you're excited and have 2-4 hours
- ❌ No, if you want to sleep first (docs are all ready)

**"What's the fastest path to usable Polymath?"**
→ Weekend sprint (15h total):
  - Phase 1: Database (3h)
  - Phase 2: Capabilities (4h)
  - Phase 3: Manual synthesis MVP (8h)
  - Result: Working Polymath you can use!

**"What if I just want to test the concept?"**
→ Just do Phase 1 + 2, then manually run synthesis script:
  ```bash
  npx tsx scripts/polymath/synthesis.ts
  ```
  Check Supabase to see suggestions generated

---

## 🎯 Key Files to Read When You Start

**Before database work:**
1. `migration.sql` - Understand schema
2. `DEPLOYMENT.md` - Follow checklist

**Before building UI:**
1. `UI_COMPONENTS.md` - Component structure
2. `API_SPEC.md` - Endpoint contracts

**Before synthesis:**
1. `ARCHITECTURE.md` - Algorithms explained
2. `scripts/synthesis.ts` - Implementation

---

## 🔥 What Makes This Special

**Not just another project tracker:**
- Generates ideas you wouldn't think of yourself
- Strengthens based on what you actually do (git commits)
- Prevents creative echo chambers (wild cards)
- Permanent ideas list (even dismissed ones stay for diversity)
- Feeds off MemoryOS (your interests fuel suggestions)

**The "Holy Shit" moment:**
- AI suggests combining two capabilities you never thought to combine
- The combination aligns perfectly with recent MemoryOS thoughts
- You build it and it becomes your favorite project

---

## ❓ Open Questions (For You to Decide)

### Architecture (Answered ✅)
- **Decision:** Same app as MemoryOS, deeply integrated

### First-Time UX (You decide)
- Empty state? Import interests? Onboarding flow?

### Suggestion Frequency (You decide)
- Weekly synthesis? Manual only? Daily?

### Wild Card Strategy (You decide)
- Every 4th? Every 5th? Weekly "weird idea" day?

---

## 🛠️ Everything You Have Ready

**Documentation (9 files):**
1. `CONCEPT.md` - Vision
2. `ARCHITECTURE.md` - Technical design
3. `RATING_UX.md` - UX flows
4. `ROADMAP.md` - Implementation plan
5. `UI_COMPONENTS.md` - React structure
6. `API_SPEC.md` - API contracts
7. `DEPENDENCIES.md` - NPM packages
8. `DEPLOYMENT.md` - Deployment guide
9. `NEXT_SESSION.md` - This file

**Code (4 files):**
1. `migration.sql` - Database schema
2. `scripts/capability-scanner.ts` - Codebase scanner
3. `scripts/synthesis.ts` - AI synthesis engine
4. `scripts/strengthen-nodes.ts` - Git activity tracker

**Total work done:** ~3 hours of autonomous documentation and implementation planning

---

## 💡 Recommended Next Action

**When you wake up:**

**Option A: Quick Review (15 min)**
1. Read `CONCEPT.md` to see evolved vision
2. Skim `ROADMAP.md` for implementation plan
3. Decide when to start Phase 1 (database)

**Option B: Start Building (2-4 hours)**
1. Run database migration (`migration.sql`)
2. Install dependencies
3. Run capability scanner
4. See what happens!

**Option C: Test Drive (30 min)**
1. Run database migration
2. Manually run synthesis script
3. Check Supabase for generated suggestions
4. Decide if it's interesting enough to build UI

---

## 🎨 The Vision (Reminder)

**"Must feed off energy and not feel like work"**

Polymath should make you:
- ✅ Excited about possibilities
- ✅ Curious about combinations
- ✅ Energized to create

Not:
- ❌ Obligated to finish
- ❌ Pressured by notifications
- ❌ Guilty about dismissals

---

## 📊 Success Criteria

**MVP success:**
- At least 1 suggestion makes you go "whoa, interesting"
- At least 1 suggestion gets built
- You come back to check ideas list (not obligated, genuinely curious)

**Long-term success:**
- Weekly suggestions become anticipated
- Your creative range expands (wild cards occasionally win)
- You build 1+ project per month from suggestions
- The system truly "feeds energy, not work"

---

## 🚦 Current Status

- **Design:** ✅ Complete
- **Documentation:** ✅ Complete
- **Database Schema:** ✅ Ready to run
- **Scripts:** ✅ Ready to run
- **API Specs:** ✅ Documented
- **UI Components:** ✅ Designed
- **Deployment Plan:** ✅ Documented

**Waiting on you:**
- [ ] Run database migration
- [ ] Add environment variables
- [ ] Install dependencies
- [ ] Scan capabilities
- [ ] Build UI (optional for testing)
- [ ] Run first synthesis

---

## 🎁 Bonus: What You Can Do While Sleeping

**Nothing! Everything that could be done autonomously is done.**

The rest requires:
- Supabase access (database migration)
- API keys (Anthropic, OpenAI)
- Deployment (Vercel)
- Manual decisions (does it feel good?)

---

**The foundation is rock solid. When you're ready to build, everything is waiting for you. Sleep well! 🌙**

---

**See also:**
- `CONCEPT.md` - Full vision
- `ROADMAP.md` - Detailed implementation plan
- `DEPLOYMENT.md` - Step-by-step deployment
