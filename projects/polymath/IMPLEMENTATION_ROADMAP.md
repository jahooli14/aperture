# Polymath Implementation Roadmap

*Approved February 2026 — 22 changes, ordered by dependency and impact*

---

## Phase 1: Reliability (unblock everything else)

These are prerequisite fixes. Every subsequent feature feels better on a stable foundation.

### 1.1 Check Dexie cache before setting `loading: true`
- **Files:** `src/stores/useMemoryStore.ts:54`, `src/stores/useReadingStore.ts:86`
- **Change:** Check `await readingDb.articles.toArray()` BEFORE `set({ loading: true })`. Only show skeleton if cache is empty
- **Size:** S

### 1.2 Remove `useReadingQueue` React Query hook
- **Files:** `src/hooks/useReadingQueue.ts` (delete), `src/pages/ReadingPage.tsx` (remove import + usage)
- **Change:** Single fetching system. Zustand store is the source of truth
- **Size:** S

### 1.3 Fix pull-to-refresh effect dependencies
- **File:** `src/hooks/usePullToRefresh.ts:92`
- **Change:** Move `pullDistance` and `isRefreshing` to refs. Effect deps become `[onRefresh, threshold, resistance]` only
- **Size:** S

### 1.4 Stagger startup API calls
- **File:** `src/App.tsx:130-172`, `src/lib/sync/DataSynchronizer.ts`
- **Change:** On startup, sync current route only. After 3s idle, sync everything else via `requestIdleCallback`. DataSynchronizer becomes context-aware (only syncs visible section)
- **Size:** M

### 1.5 Consolidate three IndexedDB databases
- **Files:** `src/lib/db.ts`, `src/lib/offlineQueue.ts`, `src/sw.ts`
- **Change:** Add `operations` table to `RosetteDatabase`. Remove standalone `OfflineQueue` DB. Update service worker to use same Dexie schema
- **Size:** L

---

## Phase 2: Synthesis Engine Learns

### 2.1 Capability-pair weight tracking
- **New table:** `capability_pair_scores` — `user_id, cap_a, cap_b, spark_count, meh_count, built_count, weight`
- **File:** `api/_lib/synthesis.ts` — after suggestion rating, update pair scores
- **Change:** When user rates spark/meh/built, look up which capabilities were in that suggestion. Increment counts. Compute `weight = base + (spark - meh) * 0.05 + built * 0.1`
- **Size:** M

### 2.2 Use weights in synthesis generation
- **File:** `api/_lib/synthesis.ts` — idea generation prompt
- **Change:** Pass top-weighted pairs to Gemini: "This user particularly likes combinations of X+Y (weight: 0.8). Prioritize these intersections." Low-weight pairs get deprioritized
- **Size:** S (depends on 2.1)

### 2.3 Surface the learning
- **File:** `src/pages/SuggestionsPage.tsx` or `src/pages/HomePage.tsx`
- **Change:** After 20+ ratings, show card: "Your engine has learned you prefer projects combining [X] and [Y]". Pull from `capability_pair_scores` where weight > threshold
- **Size:** S (depends on 2.1)

### 2.4 Constraint-driven ideation modes
- **Files:** `api/_lib/synthesis.ts`, `src/pages/SuggestionsPage.tsx`
- **New modes added to synthesis prompt:**
  - "One skill only" — single capability constraint
  - "30 minutes or less" — time-boxed ideas
  - "Weakest + strongest" — stretch combinations
  - "No computer" — analog-only
  - "Opposite day" — contradict recent patterns
- **UI:** Mode selector on Suggestions page before triggering synthesis
- **Size:** M

---

## Phase 3: Bedtime Evolution

### 3.1 Morning follow-up prompt
- **New:** Morning notification/prompt: "Last night you thought about [X]. Did anything surface?"
- **File:** New component `src/components/bedtime/MorningFollowUp.tsx`, shown on HomePage between 6am-11am if bedtime prompt was completed previous night
- **Change:** Capture response as a memory with `source_reference` linking to the bedtime prompt
- **Size:** M

### 3.2 Wire breakthrough tracking into synthesis
- **Files:** `src/pages/BedtimePage.tsx`, `api/_lib/bedtime-ideas.ts`, `api/_lib/synthesis.ts`
- **Change:** When user marks a prompt as breakthrough, record which prompt_type and which inputs (article/project/memory) produced it. Feed into synthesis: "These input combinations produced breakthroughs — generate more like this"
- **Size:** M (depends on 3.1 data)

### 3.3 Score prompt types per user
- **New table:** `prompt_type_scores` — `user_id, prompt_type (connection/divergent/revisit/transform), shown_count, breakthrough_count, score`
- **File:** `api/_lib/bedtime-ideas.ts`
- **Change:** Track hit rate per type. Shift distribution: if Connection prompts produce 3x more breakthroughs than Divergent, generate 3x more Connection prompts. Floor of 10% per type to maintain diversity
- **Size:** M

---

## Phase 4: Semantic Search + Surfacing

### 4.1 Embedding-based search
- **Files:** `api/memories.ts` (search handler), new endpoint or extend existing
- **Change:** On search query, call `generateEmbedding(query)`, then `SELECT *, 1 - (embedding <=> $1) AS similarity FROM memories WHERE user_id = $2 ORDER BY similarity DESC LIMIT 20`. pgvector supports `<=>` cosine distance operator
- **Size:** M

### 4.2 "Similar to this" button
- **Files:** Memory/project/article card components
- **Change:** Button that takes item's existing embedding, runs similarity query, shows results in a sheet/modal
- **Size:** S (depends on 4.1 infrastructure)

### 4.3 Connection toast after memory creation
- **File:** `src/stores/useMemoryStore.ts` (after createMemory succeeds)
- **Change:** After `processMemory` completes and bridges are created, show toast: "Connected to N related thoughts" with tap-to-expand showing the bridge targets
- **Size:** S

### 4.4 Weekly collision report on home page
- **Files:** New component `src/components/home/CollisionReport.tsx`, `api/projects.ts` or new endpoint
- **Change:** Weekly job (or on-demand): find highest-strength new bridges created this week. Show top 1-3 as cards: "Your reading about [X] collided with your project [Y]" with one-sentence AI explanation
- **Size:** M

---

## Phase 5: Active Reading + Contradictions

### 5.1 Reading queue provocation
- **Files:** `src/pages/ReadingPage.tsx`, `api/_lib/connection-logic.ts`
- **Change:** For each unread article with an embedding, check similarity against active projects. If similarity > 0.7 and article content contradicts/challenges project approach, surface: "This article challenges your approach in [Project]"
- **Size:** M

### 5.2 Feed reading tensions into bedtime
- **File:** `api/_lib/bedtime-ideas.ts`
- **Change:** New prompt type: "Tonight, sit with the tension between what [Article] argues and what you believe about [Topic]". Triggered when article-project similarity is high but sentiment/stance diverges
- **Size:** S (depends on 5.1 analysis)

### 5.3 Contradiction resolution prompts
- **Files:** `src/pages/InsightsPage.tsx`, new API endpoint
- **Change:** When Insights detects contradictory memories (already does observation), add action button: "Resolve this". Generates prompt: "You said [X]. Then you said [Y]. What's the deeper truth?" User's resolution is stored as a new memory of type `insight` with `source_reference` linking both originals
- **Size:** M

---

## Phase 6: Show the AI's Work

### 6.1 Post-processing extraction summary
- **File:** `src/stores/useMemoryStore.ts` (after processMemory returns), memory creation dialog/flow
- **Change:** After AI processing completes, briefly show: "Found: 3 topics, 2 people, tone: reflective, 2 connections created". Animated reveal, auto-dismiss after 4s or tap to explore
- **Size:** S

---

## Dependency Graph

```
Phase 1 (reliability) ──→ everything else
Phase 2.1 (pair tracking) ──→ 2.2 (weights in synthesis) ──→ 2.3 (surface learning)
Phase 3.1 (morning follow-up) ──→ 3.2 (breakthrough → synthesis)
Phase 4.1 (semantic search) ──→ 4.2 (similar-to button)
Phase 5.1 (reading provocation) ──→ 5.2 (reading → bedtime)
```

All other items are independent and can be parallelized.

---

## Size Estimates

| Size | Items | Description |
|------|-------|-------------|
| **S** | 1.1, 1.2, 1.3, 2.2, 2.3, 4.2, 4.3, 5.2, 6.1 | Targeted edits to existing files |
| **M** | 1.4, 2.1, 2.4, 3.1, 3.2, 3.3, 4.1, 4.4, 5.1, 5.3 | New tables/endpoints + UI |
| **L** | 1.5 | Cross-cutting refactor (3 databases → 1) |

---

## Skipped (explicitly not approved)

- ~~7. Bedtime as onboarding entry point~~
- ~~20. Streaming transcript during recording~~
- ~~22. JSON/Markdown data export~~
- ~~23. TypeScript strict mode~~
- ~~24. Fold RSS into reading page~~
- ~~25. Cut Lists feature~~
