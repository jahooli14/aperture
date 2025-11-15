# Polymath Implementation Roadmap

> Phased approach to building the MemoryOS + Polymath unified creative intelligence system

## Overview

**Goal:** Extend MemoryOS with Polymath's creative synthesis capabilities
**Approach:** Incremental phases, each delivering usable value
**Timeline:** Flexible - build when energy aligns with work

## Phase 0: Foundation (Before Database Work)

**Status:** ✅ Complete

- [x] Clarify vision and design principles
- [x] Document unified architecture
- [x] Design database schema extensions
- [x] Design synthesis algorithms
- [x] Design rating UX
- [x] Create implementation roadmap

**Deliverables:**
- `CONCEPT.md` - Vision and mechanisms
- `ARCHITECTURE.md` - Technical design
- `RATING_UX.md` - Interaction design
- `ROADMAP.md` - This file

## Phase 1: Database Schema Extension

**Goal:** Add Polymath tables to existing MemoryOS Supabase instance

**Tasks:**
1. Write migration SQL
   - Create `projects` table
   - Create `capabilities` table
   - Create `project_suggestions` table
   - Create `suggestion_ratings` table
   - Create `node_strengths` table
   - Extend `entities` table with interest columns
   - Add vector embeddings columns for projects/capabilities

2. Set up RLS policies
   - User-scoped access (single user for now)
   - Same pattern as existing MemoryOS tables

3. Run migration on Supabase
   - Test locally first (if using local Supabase)
   - Deploy to production instance

**Validation:**
- Can insert/query new tables via Supabase client
- Existing MemoryOS functionality unaffected

**Time estimate:** 2-3 hours

## Phase 2: Basic Projects UI

**Goal:** Add `/projects` route to MemoryOS app with manual project CRUD

**Tasks:**
1. Create basic projects page
   - List view of projects
   - Create project form (title, description, type)
   - Edit project
   - Delete project

2. Add navigation
   - Update nav to include "Projects" link
   - Route: `/projects`

3. Basic API endpoints
   - `GET /api/projects` - List projects
   - `POST /api/projects` - Create project
   - `PATCH /api/projects/:id` - Update project
   - `DELETE /api/projects/:id` - Delete project

**Validation:**
- Can manually add personal projects (painting, music, etc.)
- Projects persist in database
- UI matches MemoryOS style

**Time estimate:** 3-4 hours

**Note:** This phase delivers immediate value - you can start tracking personal creative projects before AI synthesis is built.

## Phase 3: Capability Extraction

**Goal:** Scan Aperture codebase to identify technical capabilities

**Tasks:**
1. Create capability scanner script
   - Parse Aperture project directories
   - Identify key capabilities per project:
     - MemoryOS: voice-processing, embeddings, knowledge-graph, etc.
     - Wizard of Oz: face-alignment, image-processing, etc.
     - Autonomous Docs: documentation-generation, knowledge-updates, etc.
   - Extract descriptions from README files, code comments

2. Generate capability embeddings
   - Use OpenAI embeddings API
   - Store in `capability_embeddings` vector column

3. Populate capabilities table
   - Run script to insert capabilities
   - Link to source projects
   - Set initial strength = 1.0

4. Manual curation
   - Review auto-extracted capabilities
   - Add missing ones
   - Refine descriptions

**API endpoint:**
- `POST /api/capabilities/scan` - Trigger scan (cron or manual)

**Validation:**
- 10-20 capabilities extracted across Aperture projects
- Each has description and embedding
- Viewable in admin UI (optional)

**Time estimate:** 4-5 hours

## Phase 4: Interest Extraction from MemoryOS

**Goal:** Identify recurring themes from memories as "interests"

**Tasks:**
1. Extend entity extraction
   - When processing memory, calculate entity frequency
   - Calculate recency score
   - If frequency > 3 and recency > 0.5:
     - Mark `entities.is_interest = true`
     - Set `entities.interest_strength`

2. Create interests view
   - Route: `/interests` (or tab on `/projects`)
   - Show top interests with strength bars
   - "From MemoryOS: memory systems (5.4), creative tools (4.1)"

3. API endpoint
   - `GET /api/interests` - List interests with strengths

**Validation:**
- Memories mentioning "memory systems" multiple times → marked as interest
- Interest strength reflects frequency + recency
- Visible in UI

**Time estimate:** 3-4 hours

## Phase 5: Manual Synthesis (MVP)

**Goal:** AI-powered project suggestions, triggered manually (no cron yet)

**Tasks:**
1. Create synthesis script
   - Input: capabilities + interests
   - Use Claude Sonnet 4.5 to generate 5-10 project ideas
   - Calculate scores (novelty, feasibility, interest)
   - Allocate points
   - Store in `project_suggestions` table

2. Suggestions UI
   - Route: `/suggestions` or `/ideas`
   - Card-based layout
   - Show points, capabilities, inspired-by memories
   - Quick rating actions: 👍 👎 💡

3. Rating implementation
   - Click 👍/👎 → store in `suggestion_ratings`
   - Click 💡 → create project, link to suggestion
   - Update suggestion status

4. API endpoints
   - `POST /api/synthesis/run` - Trigger manual synthesis
   - `GET /api/suggestions` - List suggestions
   - `POST /api/suggestions/:id/rate` - Rate suggestion

**Validation:**
- Can manually trigger synthesis
- Get 5-10 novel project ideas
- Can rate and build suggestions
- Suggestions stored in permanent list

**Time estimate:** 6-8 hours

**Note:** This is the first usable version of Polymath! You can manually run synthesis when you want inspiration.

## Phase 6: Point Allocation Algorithm

**Goal:** Implement proper scoring (novelty + feasibility + interest)

**Tasks:**
1. Novelty calculation
   - Track capability combinations in `capability_combinations` table
   - `novelty = 1 - (times_suggested / total_suggestions)`

2. Feasibility calculation
   - Heuristics for code reuse (same tech stack, existing integrations)
   - Claude reasoning for complexity estimation
   - `feasibility = (reuse * 0.5) + ((1 - complexity) * 0.3) + (integrations * 0.2)`

3. Interest calculation
   - Vector similarity between project embedding and interest embeddings
   - `interest = max(cosine_similarity(project, interests))`

4. Weighted total
   - `total_points = (novelty * 0.3 + feasibility * 0.4 + interest * 0.3) * 100`

5. Update synthesis script
   - Replace simple scoring with proper algorithm
   - Store individual scores in database

**Validation:**
- Suggestions ranked by quality (high feasibility + interest score higher)
- Novel combinations get bonus
- Point allocations make intuitive sense

**Time estimate:** 4-5 hours

## Phase 7: Diversity Injection

**Goal:** Anti-echo-chamber wild cards

**Tasks:**
1. Wild card selection logic
   - Every 4th suggestion = wild card
   - Strategies: unpopular, novel-combo, inverted, random
   - Rotate strategies weekly

2. Update synthesis script
   - Generate 10 suggestions normally
   - Replace 3rd suggestion with wild card
   - Mark as wild card in UI (🎲 badge)

3. Track wild card success
   - Log which wild cards get 👍
   - Tune strategy based on feedback

**Validation:**
- Every synthesis includes 1-2 wild cards
- Wild cards are noticeably different from normal suggestions
- Occasionally one sparks interest (diversity working)

**Time estimate:** 3-4 hours

## Phase 8: Node Strengthening

**Goal:** Activity-based strengthening of capability nodes

**Tasks:**
1. Git activity tracker
   - Check recent commits in Aperture repo
   - Map files → projects → capabilities
   - Increment `node_strengths` for used capabilities

2. Project activity tracking
   - Update `projects.last_active` when git detects work
   - Increment project node strength

3. Strength decay (optional)
   - Nodes lose strength over time if unused
   - Exponential decay formula

4. Daily cron job
   - `POST /api/synthesis/strengthen-nodes`
   - Runs daily at 00:00 UTC

**Validation:**
- Work on MemoryOS → voice-processing strength increases
- Stronger nodes appear in more suggestions
- Dormant capabilities fade (unless diversity injection)

**Time estimate:** 4-5 hours

## Phase 9: Weekly Synthesis Automation

**Goal:** Automatic synthesis every Monday

**Tasks:**
1. Set up Vercel cron
   - Add to `vercel.json`
   - Schedule: Every Monday 09:00 UTC
   - Endpoint: `/api/synthesis/weekly`

2. Update synthesis endpoint
   - Run full synthesis (scan interests, generate suggestions)
   - Store results
   - Send email notification (optional)

3. Email digest (optional)
   - Use Resend (already in MemoryOS stack)
   - "10 New Ideas This Week"
   - Top 3 suggestions with links

**Validation:**
- Every Monday, new suggestions appear
- No manual trigger needed
- Email arrives (if enabled)

**Time estimate:** 2-3 hours

## Phase 10: Polish & Enhancements

**Goal:** Make it feel great to use

**Tasks:**
1. "Why this?" detail view
   - Show scoring breakdown
   - Show capabilities combined
   - Show inspiring memories
   - Suggest similar ideas

2. Permanent ideas list
   - Route: `/ideas/all`
   - Filterable: New, Saved, Built, All
   - Sortable: Points, Recent, Rating

3. Creative graph visualization
   - Show strongest capabilities
   - Show emerging interests
   - Predict next suggestions

4. Mobile optimization
   - Responsive cards
   - Touch-friendly rating actions
   - Optional: swipe gestures

5. Performance optimization
   - Cache embeddings
   - Optimize vector search
   - Lazy load old suggestions

**Time estimate:** 6-10 hours (depending on scope)

## Future Phases (Post-MVP)

### Phase 11: Voice-Based Project Updates
- "Worked on painting today" via Audiopen
- Automatically update project last_active
- Strengthen relevant nodes

### Phase 12: Visual Project Cards
- Attach photos, screenshots, artifacts
- Gallery view
- Visual progress tracking

### Phase 13: Cross-Pollination
- Personal projects inspire technical ones
- "Color theory from painting → AI color assistant"
- Bidirectional inspiration flow

### Phase 14: Multi-User (If Needed)
- Proper user_id scoping
- Collaborative projects
- Shared capability pools

## Timeline Suggestions

**Weekend Sprint (2 days):**
- Phase 1: Database schema (3h)
- Phase 2: Basic projects UI (4h)
- Phase 5: Manual synthesis MVP (8h)
- **Total:** 15 hours → Usable Polymath!

**Full MVP (4 weekends):**
- Weekend 1: Phases 1-2 (database + projects UI)
- Weekend 2: Phases 3-4 (capability + interest extraction)
- Weekend 3: Phase 5-6 (synthesis + scoring)
- Weekend 4: Phases 7-8 (diversity + strengthening)

**Production-Ready (6 weekends):**
- Weekends 1-4: Full MVP
- Weekend 5: Phase 9 (automation)
- Weekend 6: Phase 10 (polish)

## Decision Points

**After Phase 2 (Basic Projects UI):**
- ❓ Does manual project tracking feel useful?
- ✅ If yes → continue to AI synthesis
- ❌ If no → rethink project tracking approach

**After Phase 5 (Manual Synthesis MVP):**
- ❓ Are suggestions interesting/valuable?
- ✅ If yes → automate and polish
- ❌ If no → tune synthesis algorithm, revisit scoring

**After Phase 9 (Weekly Automation):**
- ❓ Do you look forward to Monday suggestions?
- ✅ If yes → system is feeding energy ✨
- ❌ If no → reduce frequency or rethink nudging

## Success Criteria

**MVP success if:**
- You manually run synthesis 2+ times in first month
- At least 1 suggestion gets 👍
- At least 1 suggestion gets built (💡)
- You revisit ideas list to explore possibilities

**Production success if:**
- Weekly suggestions become anticipated (not dreaded)
- 60%+ of suggestions get rated
- 1 new project built per month from suggestions
- Creative range expands (wild cards occasionally win)

**Ultimate success if:**
- Polymath suggests a project you build and love
- The system helps you see creative possibilities you wouldn't have seen
- It truly "feeds energy and doesn't feel like work"

---

**Next Step:** Phase 1 - Database schema extension (when ready to touch Supabase)
**Current Status:** Phase 0 complete - design and planning done
**See also:** `ARCHITECTURE.md`, `CONCEPT.md`, `RATING_UX.md`
