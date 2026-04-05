# Polymath V2: Creative Catalyst

**Vision**: What only you can do - AI finds the unique intersection of your capabilities and helps you 10x creative output.

---

## Quick Start (For New Chat Session)

**Command**: "Build the v2 of polymath, follow the plan. Commit when done."

**Working Directory**: `/Users/danielcroome-horgan/Aperture/projects/polymath`

**Implementation Order**: Follow Phase 1 → Phase 6 below. Use parallel agents where possible to maximize speed.

**Important**: When all work is complete, create clear git commits for each phase. DO NOT push without explicit user confirmation (see CLAUDE.md).

---

## North Star: Creative Catalyst

Not a productivity app. Not a task tracker. A creative catalyst that:
- Finds intersections between your scattered skills/interests
- Reshapes project ideas to align with what you're actually good at
- Prods you to act on ideas you'd otherwise put off
- Creates a positive feedback loop of original thought

**Core belief**: Original thought is the most powerful thing in the universe.

---

## Language (Plain English, No Jargon)

- ~~Tasks~~ → **What's next**
- ~~Projects/Suggestions~~ → **Project ideas** (if dormant) / **Projects** (if active)
- ~~Drawer~~ → **Saved ideas**
- ~~Priority~~ → **Working on now**
- ~~Suggestions~~ → **What ifs**

---

## Home Page Redesign

### New Structure (Top to Bottom)

1. **Netflix Hero Cards** (Dual side-by-side, swipeable)
   - **Left: "Keep going"**
     - Swipe through: priority + 2 recent active projects
     - Each card shows: title, last activity, what's next, "Start Power Hour" button
     - Use existing PROJECT_COLORS theming

   - **Right: "Try something new"**
     - Swipe through: top 3-5 reshaped saved ideas + intersection ideas
     - Sorted by "most ready to act on"
     - Link to "See all saved ideas" at bottom

2. **Evolution Feed** (below hero cards)
   - Shows 1 highlight: best intersection/breakthrough found
   - "X other projects evolving" link to full list
   - Occasionally surfaces exact past thought to trigger reflection
   - Shows AI actively working, not just results

3. **What You're Consuming**
   - Articles (via share sheet) + list items
   - Feeds AI reshaping in background

4. **Bedtime/Drift** (always visible at bottom)
   - Keep existing functionality

### Features to Remove

1. **RSS Reader** (entire feature)
   - Delete `SaveArticleDialog` component
   - Remove reading queue UI
   - Keep `/api/reading-queue` endpoint slot → repurpose for project evolution
   - Users add articles via share sheet instead

2. **Council of Advisors**
   - Delete `MultiPerspectiveSuggestions` component
   - Remove from HomePage and ProjectDetailPage

3. **Journey Milestones**
   - Delete `JourneyMilestones` component
   - Keep `useJourneyStore` for onboarding profile only
   - Remove Day 1-7 challenge system

4. **Reaper**
   - Delete `ReaperModal` component
   - Remove reaper API endpoints from `/api/projects.ts`
   - Projects never die, only evolve

5. **Analysis/Insights Pages**
   - Remove standalone pages
   - Keep insights that feed evolution

---

## Onboarding Redesign

### Flow

1. **5 Voice Questions** → Bookshelf → AI Analysis → Reveal
2. **Reveal Shows**:
   - Themes: "What keeps coming up"
   - Capabilities: "What you bring"
   - First insight (specific, connecting, surprising)
   - **"What only you can do"** - the unique intersection
   - 1 project suggestion

3. **Refinement Loop** ("Not quite right" button)
   - User gives voice feedback on why it's not right
   - AI reshapes suggestion
   - After 1st attempt, show message:
     ```
     "No worries - I'm still learning what makes you tick.
     The more you share, the better I get at finding what only you can build.

     What would make this idea better for you?"
     ```
   - After 3rd attempt if still not satisfied:
     ```
     "Let's save this and come back to it.
     As you add more thoughts and ideas, I'll reshape this into something perfect for you.
     That's the magic - ideas evolve here."
     ```
   - Max 3 refinement rounds

4. **Project Goes to Saved Ideas**
   - Not created as active project
   - Added to drawer as "saved idea"
   - Will be reshaped as user adds more data
   - Appears in "Try something new" card on home

---

## Continuous Reshaping System

### Trigger: Hybrid Approach
- Small changes (add note, list item) → quick AI analysis
- Big reshapes (multiple inputs, overnight) → nightly batch via Gemini Flash

### What Gets Reshaped
- Saved ideas in drawer
- Title, description, suggested first steps
- Based on: demonstrated skills vs aspirational skills

### Project Lineage/Rollback
- Store: original version + last version user saw
- In project detail page: dropdown to select version to revert to
- No diff view, just "Revert to [date]" buttons

### API Endpoint
- Repurpose `/api/reading-queue` slot → `/api/evolve-projects`
- Stays within 12 API endpoint limit

---

## Power Hour as Suggested Sessions

### Concept
Power Hour becomes "suggested sessions" that appear everywhere:
- Home page Netflix cards
- Project detail page

### Implementation: Option 3 from Agent Analysis
Sessions are curated subsets of project tasks, not separate entities.

**Data Model**:
```typescript
project.metadata.suggested_sessions = [{
  id: string
  created_at: string
  duration_minutes: number
  task_sequence: [
    { task_id: string, phase: 'ignition' | 'core' | 'shutdown' }
  ]
  ai_reasoning: string
}]
```

### User Flow
1. Click "Start Power Hour" on Netflix card
2. Navigate to project detail page in focused mode
3. Show suggested session tasks
4. Task completion syncs to project task list

---

## Component Structure

### New Components to Build

1. **`NetflixHeroCards.tsx`**
   - Dual card layout, responsive
   - Swipe/carousel functionality
   - Integrates with `useProjectStore`
   - Framer Motion animations

2. **`EvolutionFeed.tsx`**
   - Shows 1 breakthrough highlight
   - "X others evolving" expandable
   - Occasional past thought surfacing

3. **`ProjectLineage.tsx`** (in project detail)
   - Version dropdown
   - Revert buttons

### Components to Delete

- `SaveArticleDialog.tsx`
- `MultiPerspectiveSuggestions.tsx`
- `JourneyMilestones.tsx`
- `ReaperModal.tsx`
- `GraveyardWalkthrough.tsx`
- Analysis/Insights page components

### Components to Update

- `HomePage.tsx` - new structure
- `OnboardingPage.tsx` / `RevealSequence.tsx` - refinement loop + messaging
- `ProjectDetailPage.tsx` - add lineage, update language
- `PowerHourHero.tsx` - convert to sessions model
- All task-related components - update language

---

## Visual Design Consistency

- Glass morphism style (existing)
- PROJECT_COLORS theming (existing)
- Brutalist shadows: `3px 3px 0 rgba(0,0,0,0.5)`
- Framer Motion animations
- No emojis
- Plain English everywhere

---

## Technical Implementation Plan

### Phase 1: Clean House
1. Remove RSS reader (all UI + API references)
2. Remove Council of Advisors (component + references)
3. Remove Journey Milestones (keep onboarding profile in store)
4. Remove Reaper (component + API endpoints)
5. Remove Analysis pages
6. Clean up broken imports

### Phase 2: Home Page
1. Build `NetflixHeroCards.tsx`
2. Build `EvolutionFeed.tsx`
3. Update `HomePage.tsx` structure
4. Update language throughout
5. Test swipe/carousel functionality

### Phase 3: Onboarding
1. Add "Not quite right" button to reveal
2. Add refinement loop with messaging
3. Add "What only you can do" to reveal
4. Route accepted ideas to saved ideas (not active)

### Phase 4: Continuous Reshaping
1. Create `/api/evolve-projects` (repurpose reading-queue slot)
2. Add project version storage (lineage)
3. Build `ProjectLineage.tsx` component
4. Implement hybrid trigger (immediate + nightly)
5. Gemini Flash integration

### Phase 5: Power Hour Sessions
1. Update data model (sessions vs tasks)
2. Refactor `PowerHourHero` to session model
3. Add session UI to project detail
4. Implement focused mode navigation

### Phase 6: Polish
1. Remove all "task" language remnants
2. Ensure consistent plain English
3. Test all flows
4. Fix any broken references

---

## Data Model Changes

### Project Schema Updates

```typescript
// Add to project metadata
metadata: {
  tasks: Task[]  // existing
  suggested_sessions: [{
    id: string
    created_at: string
    duration_minutes: number
    task_sequence: { task_id: string, phase: string }[]
    ai_reasoning: string
  }]
  versions: [{
    version_id: string
    created_at: string
    title: string
    description: string
    snapshot: object  // full project state
  }]
}
```

### Evolution Feed Schema

```typescript
// New table or cache structure
evolution_events: {
  id: string
  user_id: string
  event_type: 'intersection' | 'reshape' | 'reflection'
  project_id?: string
  highlight: boolean  // true for 1 featured event
  description: string
  created_at: string
}
```

---

## API Endpoints (Stay Within 12 Limit)

### Current Slots (Keep)
1. `/api/projects` - CRUD
2. `/api/memories` - CRUD
3. `/api/analytics` - insights
4. `/api/utilities` - onboarding analysis
5. `/api/brainstorm` - project chat
6. `/api/power-hour` - session generation
7. `/api/fix-queue` - annoyance fixes
8. (others as documented)

### Repurpose
- `/api/reading-queue` → `/api/evolve-projects`
  - POST: Trigger evolution for project(s)
  - GET: Fetch evolution events for feed

---

## Lists Integration

Lists stay but feed AI in background:
- Parse list items as context for reshaping
- Surface list items in "What you're consuming"
- Use to identify interests/patterns

---

## Voice Notes Flow

1. User records voice note
2. Goes to memories (as now)
3. Triggers AI analysis
4. Feeds continuous reshaping system
5. May appear in evolution feed if significant

---

## Demo Scenario (Critical)

**Setup**: New user, quick onboarding over beers

**Flow**:
1. 5 voice questions (casual, slurred OK)
2. Bookshelf (quick)
3. Reveal shows:
   - "You care about: woodworking, parenting, coding"
   - "You bring: problem-solving, attention to detail"
   - "What only you can do: combine hands-on craft with technical thinking"
   - Suggestion: "Interactive wooden puzzle that teaches programming concepts"
4. User: "Not quite right, my daughter is only 3"
5. AI reshapes: "Wooden shape-sorter with audio feedback using Arduino"
6. User accepts → saved to ideas
7. Add 2-3 more thoughts
8. AI surfaces: "Your shape-sorter idea just evolved - what if it tracked which shapes she tries first to understand her learning style?"
9. "Holy shit, I'd never have thought of that"

---

## Key Principles

1. **Show AI thinking in real-time** - not just results
2. **Lead with the magic** - intersections and evolution, not task management
3. **Plain English always** - warm, no jargon
4. **Focus on what only you can do** - the unique intersection
5. **Creative catalyst, not productivity app**

---

## Success Metrics (Post-Build)

- User says "I'd never have thought of that" during demo
- Ideas in saved ideas section actually get built
- Users add more data because they see it improve suggestions
- The app feels like a creative partner, not a database

---

## Notes

- Model: Keep using `gemini-2.0-flash-lite` for all AI (cost effective)
- No changes to authentication or Supabase schema beyond metadata
- Maintain offline-first with IndexedDB caching
- Keep existing mobile-responsive design patterns

---

## Next Steps After Build

1. Test onboarding with 3-5 new users
2. Validate "not quite right" loop works
3. Ensure reshaping actually makes ideas more actionable
4. Monitor which intersections lead to completed projects
5. Iterate on "what's ready to act on" scoring algorithm
