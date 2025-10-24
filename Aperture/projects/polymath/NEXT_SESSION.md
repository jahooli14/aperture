# Polymath - Next Session

> **Status**: 🟢 Killer Features Identified - Onboarding Redesign Priority
> **Last Updated**: 2025-10-24
> **Next**: Implement new onboarding flow + 3 killer features

---

## 🎉 Latest Session - Killer Features & Onboarding Strategy (2025-10-24)

### ✅ Research Completed: 2025 App Trends
- Deep research into PKM apps, investment trends, voice-first AI, creator tools
- Key findings: AI-powered personalization (265% valuation premium), voice-first adoption (8.4B users), personal AI memory systems breakthrough
- Validated user needs: instant value, zero learning curve, mobile-first, local-first privacy options

### ✅ 4 Killer Features Identified

**1. Creative Intelligence Engine - "What Can I Make From This?"**
- AI scans knowledge graph for creative project opportunities
- Surfaces patterns: "12 notes about X + skill Y learned 6mo ago = Project Z"
- Shows capability freshness tied to suggestions
- Auto-generates project scaffolding from user's own knowledge
- **Moat**: Only tool connecting temporal knowledge graph + creative projects

**2. Proactive Gap-Filling Prompts - "The Questions You Didn't Know to Ask"**
- AI detects valuable missing context in knowledge graph
- Surfaces prompts at optimal moments: "You mentioned quitting your 9-5 twice - what would make that possible?"
- Personalized to user's creative goals and side-hustle trajectory
- Fills gaps that unlock insights user wouldn't see otherwise
- **Target**: People with 9-5s building creative work on the side, aiming to go full-time
- **Moat**: Only tool that knows what you DON'T know about yourself

**3. Cognitive State Timeline - "Show Me When I Think Best"**
- Analyzes WHEN and HOW users capture thoughts
- Patterns: "Breakthrough insights Tuesday mornings" or "Best ideas after walks"
- Tracks thought velocity and emotional continuity over time
- Context windows with AI-generated narrative summaries
- **Moat**: No tool analyzes temporal patterns of knowledge capture

**4. Cross-Pollination Synthesis - "Combine Your Past Selves"**
- Multi-memory synthesis showing evolution of thinking
- Project archaeology: "Last 3 projects died at deployment - here's the pattern"
- Capability evolution tracking based on terminology shifts
- Memory collision detection: contradictions or growth?
- **Moat**: Graph-based memory across time + projects dimension

### ✅ Demo Strategy Defined

**60-Second Onboarding Flow:**
1. "What's a skill you learned in the past year?" (structured)
2. "Tell me about something you started but didn't finish" (structured)
3-5. Three freeform voice notes: "What's on your mind? Projects, ideas, frustrations"

**Immediate Payoff:**
- Show first graph with connections
- Display detected patterns/themes/capabilities
- First Creative Intelligence suggestion
- Optional: "Want to track projects too?" (lightweight for most, powerful for power users)

**Key Design Principle:**
- Don't force project tracking in onboarding
- Memory capture = primary experience for most users
- Projects = first-class citizen for power users (20+ creative pursuits)
- AI suggests "turn frustration into project" when relevant

---

## 🎉 Previous Session - Enhancement Design (2025-10-24)

### ✅ What Was Designed

**Major enhancement specs created for both core pillars:**

**Memory Storage Improvements:**
1. ✅ Context Windows - Time-based clustering with AI themes
2. ✅ Memory Decay Visualization - Strength heatmaps & alerts
3. ✅ Cross-Memory Synthesis Notes - Connect memories into meta-memories
4. ✅ Memory Export as Narrative - AI-generated summaries
5. ✅ Memory Collision Detection - Surface contradictory memories
6. ✅ Dead Memory Pruning - Archive with tombstones

**Project Tracking Improvements:**
1. ✅ Project Graveyard - Post-mortems for abandoned projects
2. ✅ Capability Decay Tracking - Skill freshness monitoring
3. ✅ Refresh Recipes - AI-generated micro-projects to restore skills
4. ✅ **Daily Actionable Queue** - "What should I work on today?"

**Cross-Pillar Improvements:**
1. ✅ Memory → Project Dependencies - Required context tracking
2. ✅ Project Completion → Auto-Memory - Capture learnings
3. ✅ Synthesis Constraints UI - User control over AI suggestions

**Database Migration:**
- ✅ `migration-enhancements.sql` created with all schema changes

**Documentation:**
- ✅ `MEMORY_ENHANCEMENTS.md` (6 improvements)
- ✅ `PROJECT_ENHANCEMENTS.md` (4 improvements)
- ✅ `DAILY_ACTIONABLE_QUEUE.md` (detailed spec)
- ✅ `CROSS_PILLAR_IMPROVEMENTS.md` (3 improvements)

---

## 🚀 Implementation Priority (Phased Approach)

### 🔥 Phase 1: Daily Actionable Queue (HIGHEST PRIORITY)

**Why This First:**
- Solves core user need: "What should I work on today?"
- Immediate value without other features
- Foundation for all project enhancements
- Anti-overwhelm built-in (max 3 projects shown)

**What It Does:**
```
Opens app → sees max 3 projects:
1. 🔥 Hot Streak - Worked on yesterday, keep momentum
2. ⚠️ Needs Attention - 14 days idle, getting stale
3. ✨ Fresh Energy - New from suggestion, explore?

Each with:
- Clear reason WHY it's suggested
- Time estimate (45 min)
- Energy level (moderate)
- Next step (concrete action)
- [Continue] or [Skip Today] buttons
```

**Implementation Estimate:** 12-16 hours

**Tasks:**
1. Run `migration-enhancements.sql` on Supabase ✅
2. Create Daily Queue scoring API endpoint (4-5h)
   - 5 dimensions: momentum, staleness, freshness, alignment, unlock
   - Context matching: time/energy/location
3. Create User Context API (1-2h)
   - Store user's available time/energy/context
4. Build Queue Frontend UI (4-5h)
   - Context input dialog
   - Project cards with categories
   - Skip actions
5. Update Projects page with queue view (2-3h)
   - Toggle between "Today's Queue" and "All Projects"
6. Testing & polish (1-2h)

**Success Criteria:**
- User opens app → sees 3 actionable projects immediately
- Context changes → queue updates
- Skip project → removed from queue
- 70%+ of users work on queued project within 30 min

---

### Phase 2: Memory Decay & Collision Detection (8-10h)

**Why Second:**
- Prevents memory loss before it happens
- Novel feature (no PKM tool has collision detection)
- Uses existing memory data

**Features:**
1. **Memory Decay Visualization**
   - Strength score on each memory card
   - Alert for top 5 fading memories
   - Review button updates strength

2. **Memory Collision Detection**
   - AI detects contradictions when new memory created
   - "Your view on React changed: March vs June"
   - Resolution tracking (evolved, error, context-dependent)

**Implementation:**
- Backend: Decay calculation function, collision detection API
- Frontend: Strength indicators, collision alert modal

---

### Phase 3: Project Graveyard & Capability Freshness (10-12h)

**Why Third:**
- Embraces reality of abandoned projects
- Freshness alerts prevent skill decay
- Refresh recipes provide concrete actions

**Features:**
1. **Project Graveyard**
   - Mandatory post-mortem when abandoning
   - Pattern analysis: "You abandon at deployment 70% of time"
   - Graveyard view with insights

2. **Capability Freshness Alerts**
   - Track last usage per capability
   - Alert when rusty (45+ days)
   - AI generates refresh recipe (2-hour micro-project)

**Implementation:**
- Backend: Abandonment flow, freshness tracking, recipe generation
- Frontend: Post-mortem modal, freshness dashboard, recipe cards

---

### Phase 4: Cross-Pillar Features (6-8h)

**Why Fourth:**
- Closes feedback loops between memories & projects
- Requires other features as foundation

**Features:**
1. **Memory → Project Dependencies**
   - Link required memories to projects
   - "Review Design System memory before continuing"

2. **Project Completion → Auto-Memory**
   - Reflection prompt on completion
   - Creates memory with learnings

3. **Synthesis Constraints**
   - "Only projects under 1 week"
   - "Use stale capabilities"
   - Quick presets

---

### Phase 5: Context Windows & Synthesis Notes (8-10h)

**Why Last:**
- Nice-to-have vs. must-have
- More complex AI work
- Lower immediate impact

**Features:**
1. **Context Windows**
   - Auto-cluster memories by week/month
   - AI-generated theme summaries
   - Timeline view

2. **Cross-Memory Synthesis Notes**
   - Link 2-3 memories into new memory
   - Meta-insights from combinations

---

## 📊 Implementation Timeline

### Realistic Scope (50-60 hours total)

**Week 1-2: Daily Queue (Core Value)**
- Phase 1: Daily Actionable Queue (12-16h)
- Deploy to production
- Gather user feedback

**Week 3-4: Memory Intelligence**
- Phase 2: Memory Decay & Collision (8-10h)
- Deploy incremental updates

**Week 5-6: Project Intelligence**
- Phase 3: Project Graveyard & Freshness (10-12h)
- Deploy incremental updates

**Week 7-8: Integration & Polish**
- Phase 4: Cross-Pillar Features (6-8h)
- Phase 5: Context Windows (8-10h)
- Final testing & deployment

**OR: MVP Approach (16-20 hours)**
- Just Phase 1: Daily Queue
- Deploy & validate
- Build rest based on user feedback

---

## 🎯 Next Session: Start Here

### 🔥 NEW PRIORITY: Killer Features Implementation

**Phase 1: New Onboarding Flow (8-12h)**
1. Build 5-question onboarding UI
   - 2 structured questions (skill learned, abandoned project)
   - 3 freeform voice capture slots
2. Create `/api/onboarding/analyze` endpoint
   - Extract capabilities, themes, patterns from 5 inputs
   - Generate first knowledge graph
   - Return Creative Intelligence suggestion
3. Build results screen
   - Visual graph display
   - Pattern/theme/capability summary
   - First project suggestion
   - Optional "track projects?" branch

**Phase 2: Proactive Gap-Filling Prompts (8-12h)**
1. `/api/prompts/gap-analysis` endpoint
   - Detect missing context in knowledge graph
   - Identify patterns around 9-5 → full-time creative transition
   - Generate personalized follow-up questions
   - Smart timing: surface when user is capturing related thoughts
2. UI for prompt delivery
   - Contextual notification: "Got 30 seconds? I have a question"
   - Show reasoning: "You mentioned X twice but never said Y"
   - One-tap voice response
   - Dismissable without guilt

**Phase 3: Creative Intelligence Engine (12-16h)**
1. `/api/intelligence/opportunities` endpoint
   - Scan knowledge graph for project patterns
   - Match capabilities with frustrations/ideas
   - Calculate capability freshness
   - Generate project scaffolds from user's own memories
   - Side-hustle → full-time revenue path suggestions
2. UI for project suggestions
   - Card-based suggestions with reasoning
   - "Why this project fits you" breakdown
   - "Path to $X/month" if user has mentioned income goals
   - One-click create project from suggestion

**Phase 4: Cognitive State Timeline (10-14h)**
1. `/api/timeline/patterns` endpoint
   - Analyze capture timestamps for patterns
   - Track thought velocity (captures per week/month)
   - Detect emotional tone shifts
   - Context window generation with themes
   - Evening/weekend patterns (side-hustle work times)
2. Timeline visualization
   - Calendar heatmap of captures
   - "Your best thinking times" insights (e.g., "Most ideas: Sundays 9am")
   - Emotional continuity tracking
   - Weekly/monthly narrative summaries
   - "Side project hours this month" tracking

**Phase 5: Cross-Pollination Synthesis (8-12h)**
1. `/api/synthesis/evolution` endpoint
   - Multi-memory synthesis across time
   - Project abandonment pattern detection
   - Memory collision detection
   - Capability evolution tracking
2. Synthesis UI
   - "How your thinking evolved" cards
   - Project graveyard with pattern analysis
   - Contradiction/growth highlights

**Total Estimate: 46-66 hours for all 4 killer features + daily queue**

**Key User Insight:** Target is people with 9-5s doing creative work on the side, aiming to go full-time. Gap-filling prompts should detect and nurture this transition journey.

---

### Option A (ORIGINAL): MVP (Daily Queue Only)

**Hour 1:**
```bash
# 1. Run migration (NEEDS TO BE DONE - see .env.local for SUPABASE_URL)
# Extract the connection string from .env.local and run:
# psql "postgresql://..." < migrations/003-daily-queue.sql
# OR use Supabase Dashboard SQL Editor (recommended)

# 2. Review current project schema
cat src/types.ts # Line 298-344 (Project interface)

# 3. Check existing project API
cat api/projects.ts
```

**Hours 2-5: Backend**
- Create `/api/projects/daily-queue` endpoint
- Implement scoring algorithm (5 dimensions)
- Create `/api/projects/daily-context` for user preferences

**Hours 6-10: Frontend**
- Build `DailyQueuePage.tsx` component
- Context input dialog
- Project cards with categories
- Skip actions

**Hours 11-12: Testing**
- Seed test data
- Verify scoring
- Test context matching

**Hours 13-16: Polish & Deploy**
- Mobile optimization
- Empty states
- Deploy to Vercel
- Update routing

---

### Option B: Full Implementation (All Phases)

Follow phased approach above, implementing each phase sequentially with incremental deploys.

---

## 🔥 Key Design Principles (Anti-Overwhelm)

**Max 3 Rule:**
- Daily queue shows MAX 3 projects
- Fading memories alert MAX 5
- Pruning suggestions MAX 10

**Skip Options:**
- Every card has "Skip Today" button
- No guilt, no nagging
- Queue resets daily

**Collapsed by Default:**
- "Also Available" section collapsed
- Full project list separate view
- Don't show everything at once

**Optional Everything:**
- All features can be disabled
- Core app works without enhancements
- Progressive disclosure

---

## ��� New Documentation

**Enhancement Specs:**
- `MEMORY_ENHANCEMENTS.md` - 6 improvements with full implementation details
- `PROJECT_ENHANCEMENTS.md` - 4 improvements + Daily Queue system
- `DAILY_ACTIONABLE_QUEUE.md` - Complete spec with scoring algorithm
- `CROSS_PILLAR_IMPROVEMENTS.md` - 3 improvements connecting memories & projects

**Database:**
- `migration-enhancements.sql` - All schema changes in one file
  - New tables: context_windows, memory_collisions, memory_tombstones, capability_freshness, refresh_recipes, user_daily_context, project_memory_dependencies, synthesis_constraints
  - Extended tables: memories, projects
  - RLS policies, triggers, helper functions

**Key Files to Review:**
- Read each enhancement spec for implementation details
- Database migration is ready to run
- All types defined in specs
- API endpoints documented

---

## 🏁 Decision Point

**Before starting implementation, decide:**

1. **MVP vs. Full?**
   - MVP: Just Daily Queue (16-20h, immediate value)
   - Full: All phases (50-60h, complete vision)

2. **Deployment Strategy?**
   - Incremental: Deploy each phase as completed
   - Big Bang: Deploy all together at end

3. **Priority Adjustments?**
   - Is Daily Queue actually highest priority?
   - Any features to skip entirely?
   - Any features to fast-track?

**Recommendation:** Start with MVP (Daily Queue only), validate user value, then build rest based on real usage patterns.

---

## 📊 Current System Status

### Working Features ✅
| Feature | Status |
|---------|--------|
| Voice Capture | ✅ Audiopen webhook |
| Memory Browsing | ✅ Theme clustering, resurfacing |
| Entity Extraction | ✅ AI-powered |
| Synthesis | ✅ Tech + Creative |
| Project Management | ✅ Full CRUD with progress |
| Capability Scanning | ✅ Git-based |
| UI Consistency | ✅ Standardized |
| Progress Tracking | ✅ Next step + % |
| Mobile Compact View | ✅ See all projects |

### Ready to Implement 🟡
| Enhancement | Priority | Estimate |
|-------------|----------|----------|
| Daily Actionable Queue | 🔥 Highest | 12-16h |
| Memory Decay Viz | High | 4-5h |
| Memory Collision Detection | High | 4-5h |
| Project Graveyard | Medium | 6-8h |
| Capability Freshness | Medium | 4-6h |
| Cross-Pillar Features | Medium | 6-8h |
| Context Windows | Low | 4-5h |
| Synthesis Notes | Low | 4-5h |

---

## 🎯 Immediate Next Action

**Choose your path:**

### Path 1: MVP (Recommended)
```bash
# Start Daily Queue implementation
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath

# 1. Review Daily Queue spec
cat DAILY_ACTIONABLE_QUEUE.md

# 2. Run migration
# Open Supabase dashboard → SQL Editor → Run migration-enhancements.sql

# 3. Start building backend
# Create api/projects/daily-queue.ts
# Create api/projects/daily-context.ts

# 4. Build frontend
# Create src/pages/DailyQueuePage.tsx
# Create src/components/queue/ directory
```

### Path 2: Full Implementation
```bash
# Follow phased approach
# Week 1-2: Daily Queue
# Week 3-4: Memory enhancements
# Week 5-6: Project enhancements
# Week 7-8: Cross-pillar & polish
```

---

**Status**: 🟢 Killer Features Identified - Ready for Implementation
**Priority**: New onboarding flow → 4 killer features (Gap-Filling Prompts, Creative Intelligence, Cognitive Timeline, Cross-Pollination)
**Original Plan**: 16-20 hours (Daily Queue only) - NOW SUPERSEDED
**New Plan**: 46-66 hours (all 4 killer features + daily queue)

**Key Insight:** The moat isn't project management—it's the unique combination of temporal knowledge graph + creative project tracking + AI synthesis. Build the features that leverage this unfair advantage.

**Business Model**: $12/mo subscription (market validated: AudioPen $6/mo, Capacities $10/mo, Notion AI $15/mo)
- Free: 50 voice captures/mo
- Creator ($12/mo): Unlimited captures + Creative Intelligence + basic synthesis
- Architect ($20/mo): All features + local-first + graph memory + API

**Target User:** Side-hustlers with 9-5s aiming to go full-time creative. App nurtures this transition.

**Next Steps:**
1. Implement new onboarding (5 questions → immediate graph)
2. Build Proactive Gap-Filling Prompts (asks the questions they didn't know to ask)
3. Build Creative Intelligence Engine (project opportunities + revenue paths)
4. Add Cognitive Timeline (when you think best, side-project hours tracking)
5. Add Cross-Pollination Synthesis (evolution tracking + abandonment patterns)
6. Keep projects as first-class citizen for power users, lightweight for everyone else
