# Polymath: From Great to Groundbreaking

*February 2026 — A review through the lens of Oblique Strategies*

---

## The State of Play

Polymath has serious bones. Offline-first Dexie caching, Zustand stores as API gateways, Gemini-powered entity extraction, 768-dim embeddings, automatic bridge creation between memories. The infrastructure for a knowledge graph exists. But the graph itself is invisible. The AI does brilliant work behind the curtain and nobody sees it.

What follows is ordered by priority. Each suggestion is framed with an Oblique Strategy — not decoration, but genuine lateral provocation. The best changes here aren't incremental improvements. They're perspective shifts.

---

## P0 — The Invisible Made Visible

### 1. Ship the Knowledge Graph Visualization

> *"What would make this really useful?"*

The app creates embeddings, extracts entities, builds bridges between memories — and then hides all of it behind text lists on detail pages. The single highest-impact thing you can do is **show the graph**. An interactive node-link diagram where memories are nodes, bridges are edges, and clusters emerge from the data.

You already have Three.js and d3-force-3d in the bundle (250KB of graph vendor code). You already have the `connections` and `bridges` tables with strength scores. The data layer is done. The presentation layer is missing.

**What it looks like:**
- Nodes = memories (sized by connection count), projects (colored by status), articles
- Edges = bridges (opacity = strength score, color = bridge type)
- Clusters form naturally from force-directed layout
- Click a node to expand its connections
- Pinch to zoom, drag to pan
- Filter by time range, entity type, theme
- Search highlights nodes and dims everything else

**Why it's P0:** This is the product. Everything else is scaffolding for this moment — the moment a user sees the shape of their own thinking.

---

### 2. Make Semantic Search the Default

> *"Don't avoid what is easy."*

You generate 768-dimensional embeddings for every memory, project, and article. The search page does substring matching on title and body. The embeddings sit unused in the search flow.

The fix is almost embarrassingly simple: when a user searches, embed their query with the same `text-embedding-004` model, then do cosine similarity against stored vectors. Sort by similarity score instead of recency. Fall back to text search only if the embedding service is down.

**What changes:**
- Searching "web development" finds memories about "React frameworks" and "CSS architecture"
- Searching "that idea about combining music and code" actually works
- The search bar becomes a conversation with your past self
- Add a "Similar to this" button on every memory card — one-click semantic expansion

**Why it's P0:** Without semantic search, the knowledge graph is a write-only database. You can put things in but you can't meaningfully get them out.

---

### 3. Surface Connections Proactively

> *"Emphasize the flaws."*

Connections are created automatically but surfaced only on detail pages. The user has to go looking. Flip this: **push connections to the user**.

- After capturing a new memory, show a toast: "Connected to 3 related thoughts" with a tap-to-expand
- On the home page, show a "New Connections" card when bridges are created
- Weekly digest: "Here's what emerged this week" — theme clusters, new entity patterns, strengthening connections
- "You mentioned X in 3 different contexts this week" — pattern detection surfaced as insight cards

**Why it's P0:** The AI is doing work the user never benefits from. Every invisible connection is a missed "aha" moment.

---

## P1 — Fix the Feel

### 4. Kill the Loading Flicker

> *"Remove ambiguities and convert to specifics."*

Both `useMemoryStore.fetchMemories` and `useReadingStore.fetchArticles` set `loading: true` before checking the Dexie cache. This causes a skeleton flash on every navigation, even when perfectly good cached data exists. The fix (documented in POLYMATH_REVIEW.md #4, #5) is to check cache first, only show loading if cache is empty.

Similarly, `ReadingPage` makes 3+ redundant fetch calls on mount because React Query and Zustand are both fetching. Pick one. The Zustand store is more capable. Remove `useReadingQueue`.

**Impact:** Eliminates the "flash of nothing" that makes the app feel unreliable.

---

### 5. Fix Voice UX: Show the Machine Listening

> *"Make a blank valuable by putting it in an exquisite frame."*

The voice capture flow works but feels broken. Users hold a button, release it, see "Processing..." and wait. No waveform. No streaming transcript. No confidence feedback. The 50ms start delay clips the first syllable.

**What to do:**
- Add a waveform visualization during recording (even a simple amplitude bar)
- Show words appearing as they're recognized (Web Speech API already provides interim results)
- Remove the start delay or add a brief "listening..." indicator before recording begins
- After processing, show what the AI extracted: "Found: 2 people, 3 topics, emotional tone: reflective" — make the magic visible

**Why it matters:** Voice is the primary input. If voice feels broken, the whole app feels broken.

---

### 6. Tame the Thundering Herd

> *"Only one element of each kind."*

On startup: 11 API calls from DataSynchronizer + per-page fetches + React Query invalidations. On mobile with limited bandwidth, this creates a traffic jam.

**Fix:**
- Startup: sync only the current route's data. Stagger everything else with `requestIdleCallback`
- DataSynchronizer: context-aware syncing (only sync what's visible)
- Remove `location.key` from ReadingPage effect dependencies (causes refetch on every back-navigation)
- Pull-to-refresh: move `pullDistance` and `isRefreshing` to refs so the effect doesn't re-register on every touchmove

---

## P2 — The Intelligence Layer

### 7. Add an AI Chat Interface to Your Own Knowledge

> *"Ask your body."*

The most groundbreaking feature you could build: let users have a conversation with their own knowledge graph. Not a general chatbot — a chatbot that only knows what you've told it.

- "What have I said about React over the last month?"
- "Connect my thoughts about music theory to my programming projects"
- "What am I forgetting about?"
- "Summarize my thinking on X"

**Implementation:** You already have Gemini chat (`gemini-chat.ts`). RAG is straightforward: embed the query, retrieve top-K similar memories, pass them as context to the generation model. The embeddings and the chat infra both exist. Wire them together.

**Why P2 not P0:** Because search + graph visualization gives users the tools to explore on their own. Chat is the luxury layer on top.

---

### 8. Build a Capability/Skill Map

> *"What are you really thinking about just now?"*

The `capabilities` table extracts skills from projects. The `capabilities-extraction.ts` module detects them from descriptions. But there's no UI for this. Users never see their own skill map.

**What it could be:**
- Radial chart of capabilities, sized by strength score
- Skills connected to projects that use them
- Trending skills (mentioned more this month than last)
- Skill gaps: "You mention machine learning but have no projects using it"
- Learning trajectory: "Your React skills have deepened over 6 months"

---

### 9. Proactive Pattern Detection

> *"Discover the recipes you are using and abandon them."*

The app captures thoughts but doesn't tell you what patterns are emerging. Build a weekly synthesis engine:

- Theme velocity: "Design thinking appeared in 8 memories this week, up from 2 last week"
- Entity clustering: "These 5 people keep appearing together — is this a team?"
- Temporal patterns: "You think about career goals every Sunday evening"
- Contradiction detection: "In January you said X, in February you said the opposite"
- Decay alerts: "You haven't thought about Y in 3 months — still relevant?"

---

## P3 — Trust and Portability

### 10. Add Data Export Immediately

> *"Be the first to not do what has never not been done before."*

Zero export functionality exists. For a knowledge app, this is a trust problem. Users won't pour their thoughts into a system they can't get them out of.

**Minimum viable export:**
- Settings > Export All Data > JSON download (memories, projects, articles, connections, capabilities)
- Settings > Export as Markdown > zip of `.md` files organized by theme
- Automatic weekly backup to user's email or cloud storage
- Delete my data (GDPR compliance)

---

### 11. Enable TypeScript Strict Mode

> *"Honor thy error as a hidden intention."*

`tsconfig.json` has `strict: false`. The codebase has `any` types scattered across stores, hooks, and utilities. There are zero test files. This combination means bugs hide until production.

**The path:**
1. Enable `strict: true` in tsconfig
2. Fix the ~50 type errors that surface (most are `any` casts in stores and the API client)
3. Add ESLint with the React Hooks plugin
4. Write tests for the Zustand stores first (highest ROI — they contain all business logic)

---

### 12. Consolidate the Three IndexedDB Databases

> *"Simple subtraction."*

Three separate databases: `RosetteDB` (Dexie), `OfflineQueue` (raw IndexedDB), and `aperture-offline` (service worker). The service worker writes to a different database than the app reads from, which means background sync silently fails.

Consolidate to one Dexie instance. Add the `operations` table to `RosetteDatabase`. Have the service worker import the same Dexie schema.

---

## P4 — Focus and Subtraction

### 13. Cut Features to Sharpen the Core

> *"What to increase? What to reduce? What to maintain?"*

Polymath has 16 pages. Bedtime prompts, Power Hour, RSS feeds, Timeline, Insights, Lists, Suggestions — each well-built but collectively diluting the core proposition. The app tries to be a knowledge graph AND a project manager AND an RSS reader AND a bedtime journal AND a focus timer.

**Consider demoting to secondary:**
- Bedtime prompts (nice but tangential)
- Power Hour (a different app's job)
- RSS feeds (integrate into reading, don't give it its own tab)
- Lists (useful but generic — any list app does this)

**Promote to primary:**
- Knowledge graph visualization (the differentiator)
- Semantic search (the retrieval mechanism)
- Voice capture (the input mechanism)
- Connection surfacing (the intelligence layer)

Four pillars. Everything else is settings.

---

### 14. Break Up the Monolith Pages

> *"Decorate, decorate."*

`ProjectDetailPage.tsx`: 1,178 lines. `HomePage.tsx`: 1,169 lines. `ReadingPage.tsx`: 1,082 lines. These aren't components, they're applications within an application.

Extract:
- `ReadingPage` → `ArticleListView`, `RSSUpdatesTab`, `ShareTargetHandler`, `ArticleRecoveryManager`
- `HomePage` → already has sub-components but the orchestration logic (617 lines of hooks/effects) needs splitting
- `ProjectDetailPage` → `ProjectHeader`, `ProjectTasks`, `ProjectConnections`, `ProjectTimeline`

---

### 15. Add Accessibility

> *"Go outside. Shut the door."*

The codebase has a comprehensive `accessibility.ts` utility file with focus traps, ARIA helpers, contrast checking, and touch target validation. Almost none of it is used. FloatingNav buttons lack `aria-label`. Click handlers have no keyboard equivalents. Modal focus trapping is theoretical.

Wire up what you already built. Every interactive element needs an `aria-label`. Every `onClick` needs an `onKeyDown`. Every modal needs focus trapping. The utilities exist — they just need to be called.

---

## The Oblique Summary

| Priority | Strategy | Change | Impact |
|----------|----------|--------|--------|
| P0 | *"What would make this really useful?"* | Ship the knowledge graph visualization | Defines the product |
| P0 | *"Don't avoid what is easy"* | Make semantic search the default | Unlocks retrieval |
| P0 | *"Emphasize the flaws"* | Surface connections proactively | Shows the AI's work |
| P1 | *"Remove ambiguities"* | Kill loading flicker | Feels reliable |
| P1 | *"Exquisite frame"* | Fix voice UX with waveforms/streaming | Primary input works |
| P1 | *"Only one element of each kind"* | Tame the thundering herd | Performance |
| P2 | *"Ask your body"* | AI chat with your knowledge | Conversational retrieval |
| P2 | *"What are you really thinking about?"* | Skill/capability map | Self-awareness |
| P2 | *"Discover your recipes"* | Proactive pattern detection | Emerging insights |
| P3 | *"Be the first to not do what..."* | Data export | Trust |
| P3 | *"Honor thy error"* | TypeScript strict + tests | Reliability |
| P3 | *"Simple subtraction"* | Consolidate IndexedDB databases | Correctness |
| P4 | *"What to increase?"* | Cut features, sharpen core | Focus |
| P4 | *"Decorate, decorate"* | Break up monolith pages | Maintainability |
| P4 | *"Go outside"* | Wire up accessibility utilities | Inclusion |

---

## The One Thing

If you do nothing else: **ship the graph visualization**. You've built a knowledge graph engine that nobody can see. The moment a user watches their thoughts form constellations on screen — connections they didn't know existed becoming visible — that's the moment Polymath stops being a note-taking app and becomes something that doesn't exist yet.

The infrastructure is done. The AI pipeline works. The embeddings are generated. The bridges are stored. You're one visualization away from groundbreaking.

> *"The most important thing is the thing most easily forgotten."*
