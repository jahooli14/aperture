# Integration Plan: Quick Notes, Todos & Resonances
**Date:** November 2025
**Status:** Vision & Design Specification

---

## Executive Summary

This document outlines the integration of three new content types into Polymath:
1. **Quick Notes** - Lightweight thought capture
2. **Todos** - Actionable task management
3. **Resonances** - Beautiful phrases, quotes, and wisdom

All three integrate seamlessly with the existing knowledge graph through the Sparks connection system, enhancing both capture flexibility and AI-powered project synthesis.

---

## 🎨 The Integrated Vision

### Three New Content Types, Beautifully Intermeshed

#### 1. **Quick Notes** (Lightweight Thoughts)
- Extension of memories with `memory_type: 'quick-note'`
- **No AI processing** by default (instant save)
- Optional: "Expand this note" button to trigger full AI analysis
- Shows in Memories page with a filter toggle
- Perfect for fleeting observations, random ideas, shower thoughts

#### 2. **Todos** (Actionable Task Management)
- New first-class content type with its own table
- Individual tasks OR grouped lists
- Priority levels, due dates, completion tracking
- Shows in Daily Queue based on priority + available time
- Can link to projects, memories, articles, resonances

#### 3. **Resonances** (Beautiful Phrases & Wisdom)
- New first-class content type for quotes, phrases, your own writing
- Manual entry with source attribution
- Rich typography for display
- Vector embeddings for semantic connection
- Surfaces in context (relevant quotes for current project/mood)

---

## 🎯 The Capture Experience

### Enhanced FAB System
Press the FAB and see a radial menu:
```
     🎤 Voice Note
    📝 Quick Note
   ✅ Todo
  ✨ Resonance
```

### Context-Aware Intelligence
- **On ProjectDetail page**: FAB defaults to "Add todo for this project"
- **On Reader page**: FAB shows "Save quote"
- **On Memories page**: FAB shows voice/quick note split

### Command Palette (New Feature!)
- Press `Cmd+K` (or swipe gesture on mobile)
- Type-ahead search: "new todo", "save quote", "quick note"
- Lightning-fast creation from anywhere
- Also works for navigation: "go to projects", "find memories about..."

---

## 🔗 Knowledge Graph Integration

### How They Connect (via Sparks):

**Quick Notes →**
- Can spark project ideas (AI synthesis)
- Link to resonances ("This quote made me think...")
- Evolve into full memories (expand with AI)

**Todos →**
- Link to projects (project-specific tasks)
- Link to articles ("Read this paper")
- Link to memories ("Follow up on that conversation")
- Surface in Daily Queue with smart scheduling

**Resonances →**
- Inspire project suggestions ("These 5 quotes about craftsmanship → woodworking project?")
- Surface contextually ("You're working on Project X, here's a relevant quote")
- Connect to memories ("This thought relates to Rilke's phrase...")
- Daily widget: Random resonance on homepage for inspiration

### AI Synthesis Enhancement

When generating project suggestions, AI now considers:
- Your capabilities + interests (current)
- Recent memories + quick notes (new insights)
- **Resonances** (thematic inspiration)
- Incomplete todos (action readiness)

**Example:** *"You have 3 todos about learning guitar, saved 2 quotes about musical creativity, and mentioned wanting to try something new. Project idea: Start a beginner guitar journey with a 30-day chord challenge."*

---

## 📱 The UI Layout

### New Navigation Structure

```
Home
├─ Recent Activity (all types)
├─ Daily Queue (todos + recommended projects + relevant quote)
└─ Quick Capture Widget

Capture (new combined page)
├─ Voice Notes
├─ Quick Notes
└─ [All show in unified timeline with filters]

Projects
├─ Active / Upcoming / Completed
└─ Project-specific todos inline

Todos (new page)
├─ Today / Upcoming / Someday
├─ By Project (grouped view)
└─ Completed (archive)

Resonances (new page)
├─ Grid/card layout with beautiful typography
├─ Random shuffle
├─ Search by theme/feeling
└─ Daily resonance widget

Reading (existing)
└─ Enhanced: "Save as Resonance" on highlights

Timeline
└─ Shows ALL content types in unified chronological view

Search
└─ Tabs for: All / Memories / Projects / Todos / Resonances / Articles
```

---

## 🧠 Daily Queue Evolution

**Current daily queue:** Shows 3 projects based on time/energy/context

**Enhanced daily queue:**

```
┌─────────────────────────────────┐
│ ✨ Today's Resonance            │
│ "The obstacle is the way"       │
│ — Marcus Aurelius               │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ✅ Priority Todos (3)            │
│ □ Finish project proposal        │
│ □ Call Sarah about...            │
│ □ Review draft                   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🎯 Recommended Projects (3)      │
│ Hot Streak: Website redesign     │
│ Needs Attention: Photo essay     │
│ Fresh Energy: Learn watercolor   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 💭 Recent Thoughts (2)           │
│ "Idea about combining..."        │
│ "Note to self: try..."          │
└─────────────────────────────────┘
```

---

## 💾 Data Model Summary

### New/Modified Tables

#### `memories` (modified)
Add `memory_type: 'foundational' | 'event' | 'insight' | 'quick-note'`
- Quick notes skip heavy processing by default
- Can be "expanded" to full AI processing on demand

#### `todos` (new)
```typescript
{
  id: string
  user_id: string
  created_at: timestamp
  updated_at: timestamp
  title: string
  description?: string
  status: 'active' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date?: timestamp
  completed_at?: timestamp
  tags: string[]
  project_id?: string // optional link to project
  embedding?: vector // for semantic search
}
```

#### `resonances` (new)
```typescript
{
  id: string
  user_id: string
  created_at: timestamp
  text: string // the quote/phrase
  source_type: 'book' | 'article' | 'own' | 'other'
  source_title?: string
  source_author?: string
  source_url?: string
  page_number?: string
  context?: string // your note about why it resonated
  tags: string[]
  is_favorite: boolean
  embedding: vector // for semantic similarity
}
```

#### `connections` (existing, already supports all types)
Now includes `source_type/target_type: 'todo' | 'resonance'`
- Enables linking between all content types through Sparks

---

## 🎨 Beautiful UX Details

### Resonances Page
- Masonry grid layout (Pinterest-style)
- Each card: Large serif font for quote, small sans-serif for source
- Tap to expand with your context notes
- Long-press to share as image (beautiful typography export)
- Filter by source type, tags, favorites
- Shuffle button for serendipity

### Todos Page
- Today/Upcoming/Someday smart categorization
- Drag to reorder priorities
- Swipe right to complete (satisfying animation)
- Swipe left to reschedule
- Group by project toggle
- Calendar view option

### Quick Notes in Memories
- Subtle badge/icon to distinguish from voice notes
- "Expand with AI" button for lightweight → full processing
- Faster, simpler card design (no entities/themes clutter)

### Command Palette
- Fuzzy search across all content
- Recent commands at top
- Keyboard shortcuts for power users
- Mobile: Swipe down from top or long-press search icon

---

## 🚀 Implementation Phases

### Phase 1: Foundation
1. Add `memory_type: 'quick-note'` to memories schema
2. Create `todos` table with full schema
3. Create `resonances` table with full schema
4. Extend `connections` to support new types
5. Update TypeScript type definitions

**Database Migrations:**
```sql
-- Add memory_type if not exists
ALTER TABLE memories
ADD COLUMN IF NOT EXISTS memory_type TEXT
DEFAULT 'insight';

-- Create todos table
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  tags TEXT[],
  project_id UUID REFERENCES projects(id),
  embedding vector(1536)
);

-- Create resonances table
CREATE TABLE resonances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  text TEXT NOT NULL,
  source_type TEXT DEFAULT 'other',
  source_title TEXT,
  source_author TEXT,
  source_url TEXT,
  page_number TEXT,
  context TEXT,
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  embedding vector(1536)
);

-- Add indexes
CREATE INDEX idx_todos_user_status ON todos(user_id, status);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_resonances_user ON resonances(user_id);
CREATE INDEX idx_resonances_favorite ON resonances(user_id, is_favorite);
```

### Phase 2: Capture
1. Enhanced FAB with radial menu component
2. Quick note capture (text input dialog)
3. Todo creation dialog
4. Resonance entry dialog (with source fields)
5. Context-aware FAB behavior based on current page
6. API endpoints for creating each type

**New API Endpoints:**
- `POST /api/todos` - Create todo
- `PATCH /api/todos?id=xxx` - Update todo
- `DELETE /api/todos?id=xxx` - Delete todo
- `POST /api/resonances` - Create resonance
- `PATCH /api/resonances?id=xxx` - Update resonance
- `DELETE /api/resonances?id=xxx` - Delete resonance
- `POST /api/memories?type=quick-note` - Create quick note

### Phase 3: Display
1. Todos page (list view + completion tracking)
2. Resonances page (beautiful grid layout)
3. Filter quick notes in Memories page
4. Update Timeline to show all content types
5. Zustand stores for todos and resonances

**New Components:**
- `TodosPage.tsx`
- `TodoCard.tsx`
- `TodoDialog.tsx`
- `ResonancesPage.tsx`
- `ResonanceCard.tsx`
- `ResonanceDialog.tsx`
- `EnhancedFAB.tsx` (replaces existing FAB)
- `CommandPalette.tsx`

**New Stores:**
- `useTodoStore.ts`
- `useResonanceStore.ts`

### Phase 4: Intelligence
1. Daily Queue enhancement (todos section + resonance widget)
2. Update AI synthesis to include todos + resonances
3. Contextual resonance surfacing ("related quotes" section)
4. Semantic search across all types (use embeddings)
5. "Expand quick note" feature (trigger full AI processing)

**AI Integration Points:**
- Modify `/api/cron/jobs.ts` synthesis to include resonances and todos
- Add todo completion patterns to capability extraction
- Surface resonances in project detail pages (theme matching)
- Generate embeddings for todos and resonances on creation

### Phase 5: Polish
1. Command palette UI/UX (keyboard shortcuts + mobile gestures)
2. Share resonances as beautiful images (canvas generation)
3. Drag-and-drop todo prioritization
4. Expand quick note → full memory transition
5. Batch operations (complete multiple todos, bulk tag resonances)
6. Offline support for new content types
7. Export features (todos as markdown checklist, resonances as PDF)

---

## 🎯 Key Design Principles

1. **Unified but Distinct**: Everything connects through Sparks, but each type has its own character and purpose

2. **Context-Aware Capture**: The app knows where you are and adapts the capture interface accordingly

3. **Inspiration Meets Action**: Resonances inspire, todos execute, notes connect - they work together

4. **No Friction**: Capture should be faster than opening a separate app

5. **Beautiful Display**: Especially resonances - worthy of the wisdom they contain

6. **Semantic Intelligence**: Use vector embeddings to surface relevant content based on meaning, not just keywords

7. **Progressive Enhancement**: Quick notes can become full memories, todos can become projects, quotes can inspire entire creative journeys

---

## 📊 Success Metrics

### Adoption Metrics
- % of users creating quick notes vs voice notes
- Average todos created per week
- Average resonances saved per month
- Command palette usage rate

### Engagement Metrics
- Todo completion rate
- Quick note → full memory expansion rate
- Resonances shared as images
- Connections created between new content types

### Intelligence Metrics
- Project suggestions influenced by resonances (%)
- Todos appearing in daily queue
- Semantic search usage (todos/resonances)
- Cross-content-type Sparks created

---

## 🚧 Open Questions & Future Considerations

### Capture UX
- Should FAB menu be radial or vertical list?
- Mobile gesture for command palette (swipe down vs long-press)?
- Voice capture for resonances ("Save this quote from...")

### Data Model
- Should todos support subtasks/checklists?
- Recurring todos (daily/weekly)?
- Todo lists vs individual todos - one table or two?

### Intelligence
- How aggressive should AI be in suggesting connections?
- Should quick notes auto-expand after certain criteria (age, links, etc.)?
- Notification for "forgotten" todos?

### Visual Design
- Typography choices for resonances (serif font selection)
- Color coding for todo priorities
- Icons for quick notes vs voice notes

### Performance
- Lazy loading for large resonance grids
- Pagination for todos (100+ items)
- Embedding generation queue (batch processing)

---

## 🔗 Related Documents

- `AI-ANALYSIS-NOV-2025.md` - Comprehensive app structure analysis
- `/src/types.ts` - TypeScript type definitions
- `/api/*` - Existing API patterns to follow

---

## 💡 Inspiration & References

**Design Inspiration:**
- Resonances: Readwise highlights, Notion quotes database
- Todos: Things 3, Todoist contextual views
- Command Palette: Linear, Notion quick actions
- FAB: Material Design radial menus

**Technical Patterns:**
- Follow existing Polymath patterns (Zustand, optimistic updates, offline-first)
- Supabase RLS policies for all new tables
- Gemini AI for embedding generation
- Maintain TypeScript strict mode

---

## ✅ Next Steps

1. **Review & Refine**: Get feedback on this vision
2. **Prioritize**: Which phase to start with?
3. **Design Mockups**: Visual design for new pages/components
4. **Schema Review**: Finalize database structure
5. **Prototype**: Build Phase 1 foundation

---

*This is a living document. Update as the vision evolves.*
