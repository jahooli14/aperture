# Polymath - Next Session

> **Status**: 🟢 Production - UI Consistency & Progress Tracking Complete
> **Last Updated**: 2025-10-22
> **Next**: Start Phase 1 - Memory Clusters as Lenses + Project DNA

---

## 🎉 Latest Session - UI Polish & Progress Tracking (2025-10-22)

### ✅ What Was Built

**1. Header Layout Fix** ✅
- Action buttons in dedicated top-right row above headers
- No overlap/squashing on all pages

**2. UI Consistency Standardization** ✅
- Edit/Delete: Icon-only ghost buttons (orange/red hover)
- Create Buttons: Identical orange rounded-full styling
- Filter Chips: Consistent pill design
- Full app review completed

**3. Project Progress Tracking** ✅
- Next Step: Prominent orange/amber gradient box
- Progress Bar: 0-100% with gradient orange bar
- Both optional, stored in `project.metadata`

**4. Mobile Compact View** ✅
- View toggle: Grid vs Compact modes
- Compact: 5-8 projects visible without scrolling
- ~60-80px height per card

**Commits**: 0d1c097, 76734d6, 1b03e6e, 2517a84, 124a5f6, 32b9a01

---

## 🚀 Priority Roadmap: 6 Insight Engine Features

### Why These Matter
Not just features - **insight engines** that:
- Analyze what you've ALREADY done vs forcing new work
- Surface invisible patterns in your behavior
- Turn your data into strategic advantage
- Prevent problems before they happen

---

## 📋 Phase 1: Foundation (14-18 hours)

### 1. Memory Clusters as Lenses (6-8h) 🎯 START HERE
**What**: Turn theme clusters into exploration filters
**Why**: Already have clustering ✅ - unlock cross-pollination
**How**:
- Add cluster filter UI (stackable chips)
- Filter suggestions by cluster combinations
- "Show suggestions through Finance + Parenting lens"
- Discover unexpected project spaces

**Implementation**:
```typescript
// Already have: ThemeCluster[] from /api/memories?themes=true
// Need: Filter suggestions by memory_ids in selected clusters
// UI: Multi-select cluster chips → filter suggestion list
```

**Database**: No changes needed (use existing memory_ids linking)

**Files to modify**:
- `src/pages/SuggestionsPage.tsx` - Add cluster filter UI
- `src/stores/useSuggestionStore.ts` - Add cluster filtering logic
- `src/components/memories/ThemeClusterCard.tsx` - Make selectable

**Success**: Click "Finance" + "Technology" clusters → see only suggestions using those memories

---

### 2. Project DNA & Lineage (8-10h)
**What**: Show which memories inspired each project
**Why**: Visualize creative evolution, reveal patterns
**How**:
- Link `project_suggestions.memory_ids` to display
- "This project came from 3 voice notes about automation + parenting"
- Show creation story on project detail page
- Visualize as tree/timeline

**Implementation**:
```typescript
// Already have: project_suggestions.memory_ids (array of UUIDs)
// Need: Fetch actual memory objects, display with timestamps
// UI: Expandable "Origins" section in project detail
```

**Database**: No changes needed (already linking memory_ids)

**Files to create/modify**:
- `src/components/projects/ProjectLineage.tsx` - NEW component
- `src/pages/ProjectsPage.tsx` - Add detail view/modal
- `src/stores/useProjectStore.ts` - Fetch related memories

**Success**: Open project → see "Inspired by memories: [memory cards with timestamps]"

---

## 📋 Phase 2: Intelligence Layer (22-27 hours)

### 3. Capability Decay Detection (10-12h)
**What**: Track skill usage over time, prevent atrophy
**Why**: "Your Python skills haven't been touched in 8 months"
**How**:
- Scan git commits (already have capability scanning ✅)
- Track `last_used_at` per capability
- Calculate decay score (6mo = yellow, 12mo = red)
- Generate micro-projects to maintain skills

**Database**:
```sql
ALTER TABLE capabilities ADD COLUMN last_used_at TIMESTAMPTZ;
ALTER TABLE capabilities ADD COLUMN decay_score FLOAT; -- 0-1

-- Function to update from git commits
CREATE FUNCTION update_capability_usage()...
```

**API**:
- `/api/capabilities/decay` - Get decaying skills
- `/api/capabilities/maintenance-projects` - AI generates micro-projects

**UI**:
- Dashboard widget: "⚠️ 3 skills weakening"
- Capability heatmap visualization
- "Maintain this skill" button → generates project

**Success**: See "Python: Last used 8mo ago → Here's a weekend project"

---

### 4. Project Archaeology (12-15h) 🔥 HIGH IMPACT
**What**: Analyze ALL projects, extract behavioral patterns
**Why**: "You abandon projects at 65% when they need deployment"
**How**:
- Analyze status, progress, timestamps across all projects
- Extract completion %, abandonment points, duration patterns
- ML-lite clustering: success/failure factors
- Insight dashboard showing meta-patterns

**Database**:
```sql
CREATE TABLE project_insights (
  user_id UUID REFERENCES auth.users,
  pattern_type TEXT, -- 'abandonment_point', 'completion_rate', 'duration_pattern'
  pattern_data JSONB, -- { threshold: 65, reason: 'deployment', confidence: 0.87 }
  detected_at TIMESTAMPTZ,
  insight_text TEXT -- Human-readable insight
);
```

**Analysis Logic**:
```typescript
// Analyze all projects for user
const patterns = analyzeProjects(projects)
// Returns: {
//   abandonmentPoints: [65, 72, 68], // avg 68%
//   completionRate: 0.23,
//   successFactors: ['started_on_weekend', 'had_mentor'],
//   timeToCompletion: { median: 21, avg: 34 } // days
// }
```

**UI**:
- Insights page: Cards showing each pattern
- "How to improve" suggestions
- Project detail: "Based on patterns, you'll likely abandon at deployment"

**Success**: Dashboard shows "You finish 78% of weekend projects vs 12% of weekday projects"

---

## 📋 Phase 3: Advanced Synthesis (14-18 hours)

### 5. Constraint-Based Synthesis (8-10h)
**What**: Filter suggestions by real-life constraints
**Why**: "Show only projects needing <3h/week with existing skills"
**How**:
- Store user constraints in preferences
- Re-rank suggestions by constraints
- Filter by: time/week, capabilities required, new tools needed, offline-capable

**Database**:
```sql
CREATE TABLE user_constraints (
  user_id UUID REFERENCES auth.users PRIMARY KEY,
  max_hours_per_week INT,
  only_existing_capabilities BOOLEAN DEFAULT false,
  no_new_frameworks BOOLEAN DEFAULT false,
  offline_only BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ
);
```

**UI**:
- Settings page: Configure constraints
- Suggestions page: "Filtered by your constraints" badge
- Quick toggles: "Weekend mode" (3h/week + no new tools)

**Success**: Toggle "Only existing skills" → suggestions update instantly

---

### 6. Suggestion Decay System (6-8h)
**What**: Auto-archive unrated suggestions after 7 days
**Why**: Prevents "suggestion debt" paralysis
**How**:
- Cron job archives `pending` suggestions older than 7 days
- Track ignored categories/types
- Meta-learning: "You ignored 15 blockchain suggestions"
- Suggest stopping certain suggestion types

**Database**:
```sql
ALTER TABLE project_suggestions ADD COLUMN archived_at TIMESTAMPTZ;
CREATE INDEX idx_suggestions_archived ON project_suggestions(archived_at);

CREATE TABLE suggestion_patterns (
  user_id UUID REFERENCES auth.users,
  ignored_categories JSONB, -- { 'blockchain': 15, 'mobile': 3 }
  should_stop_generating TEXT[], -- ['blockchain', 'crypto']
  updated_at TIMESTAMPTZ
);
```

**Cron**:
```typescript
// Daily at 00:00 UTC
// Archive pending suggestions older than 7 days
// Update ignored_categories count
// Suggest stopping categories if ignored > 10
```

**UI**:
- Settings: "You've ignored 15 blockchain suggestions - stop generating?"
- Archive view: See what you passed on
- Meta-stats: "Ignored 23% of all suggestions this month"

**Success**: Fresh suggestions every week, see "You consistently ignore ML projects"

---

## 🗺️ Implementation Order

**Week 1: Foundation (Phase 1)**
1. Memory Clusters as Lenses (6-8h)
2. Project DNA & Lineage (8-10h)

**Week 2-3: Intelligence (Phase 2)**
3. Capability Decay Detection (10-12h)
4. Project Archaeology (12-15h)

**Week 4: Synthesis (Phase 3)**
5. Constraint-Based Synthesis (8-10h)
6. Suggestion Decay System (6-8h)

**Total: 50-63 hours (4 weeks of focused work)**

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

### Archived (Replaced by Better Features) 🗄️
| Feature | Reason |
|---------|--------|
| Memory Onboarding (10 prompts) | Replaced by Memory Clusters as Lenses |
| Node Strengthening (git commits) | Replaced by Capability Decay Detection |
| Dormant Resurfacing (time-based) | Replaced by Project Archaeology |
| Synthesis Transparency | Replaced by Project DNA & Lineage |

**Why archived**: New features analyze existing data vs forcing new work. They surface insights vs collecting more data.

---

## 🎯 Next Session: Start Here

### Immediate Action (Hour 1)
```bash
# 1. Review current theme clustering implementation
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath
cat src/pages/MemoriesPage.tsx # Line 370-393 (theme cluster grid)

# 2. Check suggestion data structure
cat src/types.ts # ProjectSuggestion interface, line 376

# 3. Verify memory_ids linking exists
# Open Supabase → project_suggestions table → check memory_ids column
```

### Build Memory Clusters as Lenses (Hours 2-8)
1. **UI Component** (2h):
   - Add multi-select cluster chips to SuggestionsPage
   - Selected clusters highlight in orange
   - Clear filters button

2. **Filtering Logic** (3h):
   - Fetch all suggestions with memory_ids
   - Filter: suggestions where ANY memory_id is in selected cluster memories
   - Re-render suggestion grid

3. **State Management** (1h):
   - Add `selectedClusters: ThemeCluster[]` to useSuggestionStore
   - Persist selection in localStorage

4. **Polish** (2h):
   - Empty state: "Select clusters to filter suggestions"
   - Count badge: "Showing 3 suggestions matching Finance + Technology"
   - Animation: Suggestions fade in/out on filter change

**Success Criteria**:
- Click "Finance" cluster → only suggestions using Finance memories
- Click "Finance" + "Parenting" → only suggestions using BOTH
- Click cluster again → unselect
- Persists across page refreshes

---

## 🔥 Why This Roadmap is Different

**Before**: Collecting more data (onboarding prompts, manual entries)
**After**: Mining existing data for insights

**Before**: Time-based heuristics (7 days dormant → nudge)
**After**: Behavioral pattern recognition (you abandon at deployment)

**Before**: Black-box synthesis (AI decides)
**After**: Transparent lineage (see exactly which memories → project)

**Before**: More suggestions = better
**After**: Right suggestions = better (decay unused, learn preferences)

**This is an insight engine, not a data collector.**

---

## 📁 Key Documentation

**Current Implementation**:
- `ARCHITECTURE.md` - System design
- `API_SPEC.md` - Endpoint reference
- `CONCEPT.md` - Original vision

**Archived (Reference Only)**:
- `MEMORY_ONBOARDING_SPEC.md` - Replaced by new roadmap
- `IMPLEMENTATION_READY.md` - Superseded
- `migration-memory-onboarding.sql` - Keep project_notes table only

---

## 🏁 Session Handoff

**What's Stable**:
- All UI consistency work deployed ✅
- Progress tracking working ✅
- Mobile compact view functional ✅
- No bugs or deployment issues ✅

**What's Next**:
- Start Phase 1: Memory Clusters as Lenses (6-8h)
- Foundation for all other features
- No database changes needed
- Uses existing theme clustering

**Live App**: https://polymath-gfvgwb3qx-daniels-projects-ca7c7923.vercel.app

---

**Status**: 🟢 Production + Clear 4-week roadmap
**Priority**: Phase 1 (Memory Clusters) unlocks everything else
**Estimated delivery**: 4 weeks of focused work (50-63 hours)

**Let's build insight engines, not data collectors!** 🔥
