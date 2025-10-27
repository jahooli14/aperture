# Next Session: Project Detail View Research & Implementation

**Last updated**: 2025-10-27
**Branch**: main
**Status**: ✅ Reading feature complete, moving to Projects

---

## ✅ Recently Completed (This Session)

### Reading Queue Feature - COMPLETE ✅

A production-ready article reading system with excellent UX, comparable to Pocket/Instapaper.

**Commits (in order):**
1. `fix(reading): simplify to use Jina AI exclusively` - Removed Readability/JSDOM for serverless
2. `fix(reading): move sanitization to client-side` - DOMPurify in ReaderPage
3. `fix(vercel): add client-side routing support` - Fixed 404s
4. `fix(reading): remove incorrect URL encoding in Jina AI call` - Fixed empty content
5. `fix(reading): add error boundary and defensive error handling` - Fixed blank screens
6. `fix(reading): add defensive date validation to prevent crashes` - Fixed invalid dates
7. `fix(reading): correct Jina AI response parsing to extract content` - Fixed JSON structure
8. `feat(reading): convert Jina AI markdown to HTML for better readability` - Added marked library
9. `feat(reading): rename 'All' to 'Queue' and exclude archived articles` - Better UX

**What Works:**
- ✅ Save articles by URL with Jina AI extraction
- ✅ Markdown-to-HTML conversion for clean rendering
- ✅ Reader view with progress tracking
- ✅ Offline caching with IndexedDB (Dexie.js)
- ✅ Image caching for offline reading
- ✅ Highlights and notes
- ✅ Reading progress restoration
- ✅ Three-tab filtering: Queue/Unread/Archived
- ✅ Error boundaries prevent crashes
- ✅ Defensive error handling throughout
- ✅ Dark mode support
- ✅ Typography controls (font size)

**Architecture:**
- **Extraction**: Jina AI Reader API (markdown output)
- **Conversion**: `marked` library for markdown → HTML
- **Sanitization**: DOMPurify client-side
- **Storage**: Supabase (articles, highlights) + IndexedDB (offline)
- **Components**: ReaderPage, ArticleCard, SaveArticleDialog
- **Error Handling**: ErrorBoundary + try-catch throughout

**Quality Bar:**
This is the standard for Polymath features - polished, thoughtful UX with proper error handling.

---

## 🎯 Next Task: Project Detail View

### Current State

**What exists:**
- Projects page with grid/list view
- Create/Edit/Delete projects
- Filtering by status
- Project cards show: title, description, type, status
- Rich metadata: tags, energy level, materials, next step, progress

**What's missing:**
- ❌ **Projects are not clickable** - no way to dive deeper
- ❌ **No detail view** - can't see full context
- ❌ **No activity stream** - can't see project history
- ❌ **No notes UI** - `project_notes` table exists but unused
- ❌ **No timeline view** - can't see how projects evolved

### Your Task

**Research + Implement a streamlined project detail view**

The user wants to make projects clickable, but **doesn't want ClickUp complexity**.
Goal: Keep it streamlined but powerful, like Linear.

---

## 📋 Start Here: Deep Research Prompt

```
Do deep research on best-in-class project tracking software UX, focusing on:

1. **Tools to Analyze:**
   - Linear (minimal, fast, beautiful)
   - Notion (flexible detail pages)
   - Height (autonomous, smart)
   - Things 3 (elegant simplicity)
   - Asana (task-focused)
   - ClickUp (feature-rich - what to AVOID)

2. **Research Questions:**
   - What makes project detail views feel good to use?
   - How do they organize information hierarchy?
   - Where do they place quick actions?
   - How do they handle activity streams/updates?
   - What note-taking patterns work best?
   - How do they visualize progress?
   - How do they highlight "next steps"?

3. **Focus Areas:**
   - Information architecture
   - Mobile-first design patterns
   - Quick update patterns (low friction)
   - Timeline/activity stream design
   - Status transition UX
   - Note-taking within projects

4. **What to Avoid:**
   - Feature bloat (ClickUp problem)
   - Cognitive overload
   - Too many nested views
   - Complex workflows
   - Heavy configuration

5. **Design Philosophy for Polymath:**
   - **Streamlined** - Not trying to be ClickUp
   - **Focused** - Surface right info at right time
   - **Fast** - Linear-like speed and elegance
   - **Effortless** - Make updates feel easy
   - **Mobile-first** - Touch-optimized

After research, propose a design for Polymath's project detail view that:
- Matches the quality of our reading feature
- Follows mobile-first principles
- Makes updating projects feel effortless
- Maintains clean, focused aesthetic
```

---

## 📊 What to Build (After Research)

### Route
`/projects/:id` - Full detail page (like `/reading/:id`)

### Core Information to Display
1. **Header**
   - Title, description
   - Type badge (personal/technical/meta)
   - Status (active/on-hold/maintaining/completed)
   - Quick actions (edit, status change, delete)

2. **Timeline**
   - Created date
   - Last active
   - Days since last update (if dormant)

3. **Context & Requirements**
   - Next step (prominent!)
   - Progress bar (if tracked)
   - Estimated time
   - Energy level required
   - Materials needed
   - Context requirements (desk, tools, etc.)
   - Tags

4. **Activity Stream** (if applicable)
   - Project notes chronologically
   - Status changes
   - Updates with timestamps

5. **Related Data** (if applicable)
   - Capabilities used
   - From suggestion ID (if built from AI suggestion)

### Key Features
- Click project card → navigate to detail
- Quick update dialog (add note without friction)
- Inline status changes
- Back button to projects list
- Keyboard shortcuts
- Error boundaries
- Mobile-optimized

### Reference Implementations
- `src/pages/ReaderPage.tsx` - Our quality bar for detail views
- `src/components/ErrorBoundary.tsx` - Error handling pattern
- `src/pages/ReadingPage.tsx` - List view with good filtering

---

## 📁 Files to Review

**Project Implementation:**
- `src/pages/ProjectsPage.tsx` - Main list view
- `src/components/projects/ProjectCard.tsx` - Card component
- `src/stores/useProjectStore.ts` - State management
- `src/types.ts` (lines 386-411) - Project interface

**Database:**
- Check `supabase/migrations/` for schema
- `project_notes` table exists but unused
- May need to add API endpoints for notes

**Design Patterns:**
- `src/pages/ReaderPage.tsx` - How we do detail views
- `src/pages/ReadingPage.tsx` - How we do list→detail navigation
- `src/components/ui/` - Existing UI components

---

## ✅ Acceptance Criteria

After research and implementation:

- ✅ Research report with insights from 3+ best-in-class tools
- ✅ Design proposal that fits Polymath philosophy
- ✅ Clickable project cards
- ✅ `/projects/:id` detail page
- ✅ All relevant project info displayed
- ✅ Quick update functionality (low friction)
- ✅ Activity/notes stream (if applicable)
- ✅ Mobile-responsive design
- ✅ Error boundaries and loading states
- ✅ Matches quality bar set by reading feature
- ✅ Fast and lightweight (no feature bloat)

---

## 💡 Design Considerations

### Information Hierarchy
- **Primary**: Next step, current status
- **Secondary**: Progress, timeline, energy level
- **Tertiary**: Tags, capabilities, metadata

### Quick Actions
- Add note/update (should feel effortless)
- Change status (inline, no modal)
- Edit details (when needed)
- Archive/complete

### Mobile-First
- Touch targets 44px minimum
- Thumb-friendly action placement
- Swipe gestures (consider)
- Compact but readable

### Performance
- Optimistic updates
- Fast page transitions
- Minimal API calls
- Local state caching

---

## 🎨 Maintain Polymath Aesthetic

Our design language:
- Clean, spacious layouts
- Orange accent color (#ea580c)
- Neutral grays for text
- Gradient backgrounds (subtle)
- Rounded corners (corners-lg, rounded-xl)
- Cards with hover effects
- Smooth transitions
- Glass-morphism effects (backdrop-blur)

---

## 🚀 Previous Session Achievements (Context)

### Voice & Memory System
- Voice recording with MediaRecorder API
- Offline queue management
- Pull-to-refresh
- Semantic tag normalization (80 seed tags)

All previous features are stable and production-ready.

---

## 📚 Key Documentation

- `READING_DEBUG.md` - Reading feature debugging guide
- `CANONICAL_TAGS_SYSTEM.md` - Tag system architecture
- `src/types.ts` - All TypeScript interfaces

---

**Status**: Ready to begin research and implementation of project detail view
**Goal**: Match the polish and UX quality of our reading feature
**Philosophy**: Streamlined, not bloated. Linear-like, not ClickUp-like.
