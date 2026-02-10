# Polymath: From Great to Groundbreaking

*February 2026 — A review through the lens of Oblique Strategies*

---

## The State of Play

Polymath's real DNA isn't in the knowledge graph. Every "second brain" app ships a force-directed node visualization and nobody uses it after the first week. The graph is a solved problem. What Polymath actually does that nothing else does:

1. **Sleep-time synthesis** — Bedtime prompts that cross-pollinate articles, projects, and memories, designed to prime the subconscious overnight
2. **Energy-matched work sessions** — Power Hour doesn't just list tasks, it shapes a session arc (ignition → core work → shutdown) calibrated to your energy and available time
3. **Automated cross-pollination** — A film about Rothko in your lists quietly connects to your paint-pouring project via 768-dim embeddings, surfaced in the sidebar when you least expect it
4. **Capability extraction** — Max-min diversity algorithm selects the 15 most dissimilar projects to build a dynamic skill profile that grows as you do

The infrastructure is remarkable. The synthesis pipeline works. The problem is: **the best features are the quietest ones**, and the scoring model doesn't actually learn from you yet.

---

## P0 — Make the Synthesis Engine Learn

### 1. Close the Feedback Loop

> *"Repetition is a form of change."*

The suggestion scoring model is static. `novelty_score` is semi-random (0.7-1.0). `feasibility_score` is hardcoded (0.9 creative, 0.6 technical). `interest_score` is embedding similarity to previous work. User feedback (spark/meh/built) only tells the next synthesis run "don't repeat this" — it never adjusts the weights.

This means Polymath doesn't learn what YOU specifically like. It only learns what NOT to repeat.

**What to build:**
- Track which capability combinations produce "spark" vs "meh" ratings. After 20+ ratings, you have enough signal to weight future combinations
- When a user marks "built", trace back: which capabilities and interests converged? Boost that intersection
- Add a simple preference model: `user_weight = base_weight + (spark_count - meh_count) * 0.05` per capability pair
- Surface the learning: "Your synthesis engine has learned you prefer projects combining X and Y" — make the adaptation visible

**Why it's P0:** Without learning, the 50th synthesis run is no smarter than the 1st. The engine generates but never evolves. This is the difference between a random idea generator and an engine that understands you.

---

### 2. Make Bedtime the Primary Interface

> *"What wouldn't you do?"*

Bedtime prompts are buried as a secondary feature. They should be the headline. Here's why:

The bedtime engine already does something genuinely novel — it finds "the non-obvious insight hiding in the intersection" of an article you read, a project you're working on, and a thought you had. It generates catalyst prompts with specific inputs. It has Zen Mode and Drift Mode. It primes overnight thinking.

No other app does this. Not Notion. Not Obsidian. Not Mem. Not Reflect.

**What's missing:**
- **Morning follow-up**: "Last night you thought about X. Did anything surface?" Capture the overnight insight before it evaporates
- **Breakthrough tracking**: The "Did this prompt lead to a realization?" mechanism exists but doesn't feed back into the synthesis engine. Wire it in — prompts that produce breakthroughs should inform future prompt generation
- **Bedtime as onramp**: New users should hit the bedtime flow first. "Tell me about your day" is a more natural first interaction than "Create a memory"
- **Prompt quality scoring**: Track which prompt types (Connection, Divergent, Revisit, Transform) produce the most breakthroughs per user. Shift the distribution toward what works

**Why it's P0:** You've built the thing nobody else has. Promote it from side feature to defining feature.

---

### 3. Semantic Search That Actually Uses the Embeddings

> *"Don't avoid what is easy."*

768-dimensional embeddings are generated for every memory, project, and article. The search page does substring matching. The embeddings sit there.

Embed the query. Cosine similarity. Sort by score. Done. This is a weekend's work that transforms the entire retrieval experience.

- "that idea about combining music and code" — works
- "things I was excited about in January" — works (emotional tone + temporal filtering)
- "Similar to this" button on every card — one-click semantic expansion

**Why it's P0:** Without this, the knowledge base is write-only. You can put things in but can't meaningfully get them out.

---

## P1 — Sharpen What Exists

### 4. Surface the Cross-Pollination

> *"Emphasize the flaws."*

The context engine quietly finds that a film connects to a project connects to an article connects to a memory. These connections are whispered in sidebars that most users will never open.

**Flip the polarity:**
- After creating a memory, show: "This connects to 3 things you might not expect" — tap to reveal
- After a bedtime session produces a breakthrough, show: "Here's the thread that led here" — the chain of connections that converged
- Weekly "collision report": "This week, your reading about X collided with your project Y. Here's what emerged"
- On the home page, a single card: "Unexpected connection" — the highest-strength new bridge from this week, explained in one sentence

**Why it's P1:** The cross-pollination engine works. The surfacing doesn't. Every invisible connection is a missed moment of creative surprise.

---

### 5. Kill the Loading Flicker

> *"Remove ambiguities and convert to specifics."*

`useMemoryStore.fetchMemories` and `useReadingStore.fetchArticles` both set `loading: true` before checking Dexie cache. Skeleton flash on every navigation, even with cached data. `ReadingPage` makes 3+ redundant fetches because React Query and Zustand race each other.

**Fixes (all documented in POLYMATH_REVIEW.md):**
- Check Dexie cache before setting `loading: true` — only show skeleton if cache is empty
- Remove `useReadingQueue` (React Query). Zustand store is more capable. One fetching system
- Remove `location.key` from ReadingPage deps — stops refetch on back-navigation
- Pull-to-refresh: move `pullDistance`/`isRefreshing` to refs so the effect doesn't re-register every touchmove

**Impact:** The app stops feeling unreliable. Instant for cached data, background refresh for fresh data.

---

### 6. Voice Capture Should Show Its Work

> *"Make a blank valuable by putting it in an exquisite frame."*

Voice is the primary input. Currently: hold button, release, "Processing...", wait. No waveform. No streaming transcript. The 50ms start delay clips the first syllable.

**What to do:**
- Streaming transcript as words are recognized (Web Speech API provides interim results already)
- After AI processing, briefly flash what was extracted: "3 topics, 2 connections found, tone: reflective"
- Remove the start delay or show a "Listening..." indicator
- The extraction reveal is key — it's the moment the user sees the machine understood them

---

## P2 — The Leaps

### 7. Constraint-Driven Ideation

> *"What would your closest friend do?"*

The synthesis engine combines capabilities and interests with no constraints. Constraints are what produce creativity, not freedom.

**New synthesis modes:**
- "One skill only" — generate ideas using exactly one capability. Forces lateral thinking
- "30 minutes or less" — ideas that can be completed in a single session
- "Combine your weakest skill with your strongest" — stretch ideas
- "What if you couldn't use a computer?" — analog-only project ideas
- "Opposite day" — generate ideas that contradict your recent patterns

The bedtime prompt engine already has a "Divergent" type. Extend that philosophy to the full synthesis pipeline.

---

### 8. Contradiction Resolution

> *"Honor thy error as a hidden intention."*

The Insights page tracks how thinking evolves and shows contradictions. But it stops at observation: "You said X in January, Y in February." It never helps resolve them.

**Build a synthesis prompt:**
- "You said [X]. Then you said [Y]. What's the deeper truth that contains both?"
- Frame contradictions not as errors but as creative tension — the raw material for insight
- Track when users resolve contradictions and what they conclude — feed that back into the memory graph as a new, higher-order insight
- This is where Polymath becomes a thinking partner, not just a thinking recorder

---

### 9. Reading Queue as Active Catalyst

> *"Use an old idea."*

The reading queue is currently passive — articles sit there until you read them, then they become "fuel" data for Power Hour matching. The embeddings are generated. The connections exist. But the queue doesn't provoke.

**Make it active:**
- "This article directly challenges your approach in [Project]. Worth revisiting?"
- "You've saved 3 articles about [Topic] but have no project using it. Is something brewing?"
- "This article from 2 weeks ago connects to the thought you had this morning"
- Integrate reading insights into bedtime prompts more aggressively — "Tonight, sit with the tension between what [Article] argues and what you believe about [Topic]"

---

## P3 — Trust and Craft

### 10. Data Export

> *"Be the first to not do what has never not been done before."*

Zero export. For a knowledge app, this is a trust problem. People won't pour their thinking into something they can't get it out of.

- Settings > Export All Data > JSON (memories, projects, articles, connections, capabilities)
- Settings > Export as Markdown > zip organized by theme
- Delete my data option

---

### 11. Tame the Thundering Herd

> *"Only one element of each kind."*

11 API calls from DataSynchronizer every 5 minutes + per-page fetches + React Query invalidations on startup. On mobile, this is a traffic jam.

- Startup: sync only current route's data. Stagger the rest with `requestIdleCallback`
- DataSynchronizer: context-aware — only sync what's visible
- Consolidate 3 IndexedDB databases (`RosetteDB`, `OfflineQueue`, `aperture-offline`) into one Dexie instance. The service worker currently writes to a different DB than the app reads from — background sync silently fails

---

### 12. TypeScript Strict + Tests for Stores

> *"Gardening, not architecture."*

`strict: false` in tsconfig. `any` types across stores and API client. Zero test files. The Zustand stores contain all business logic — they're the highest-ROI test target.

1. Enable `strict: true`, fix the ~50 type errors
2. Write tests for the stores first (state transitions, optimistic updates, cache invalidation)
3. ESLint with React Hooks plugin to catch dependency array bugs (the pull-to-refresh issue is a dependency array bug)

---

## P4 — Subtraction

### 13. Decide What Polymath Is

> *"What to increase? What to reduce? What to maintain?"*

16 pages. The app is a knowledge synthesizer AND a project manager AND an RSS reader AND a bedtime journal AND a focus timer AND a list manager. Each feature is well-built. Collectively, they dilute the proposition.

The previous review said to cut Bedtime and Power Hour as tangential. That was wrong. They're the most original things here.

**Increase:**
- Bedtime synthesis (the differentiator)
- Power Hour sessions (energy-matched work is novel)
- Cross-pollination / connection surfacing (the intelligence layer)

**Reduce:**
- RSS feeds (fold into reading, don't give it its own world)
- Lists (useful but generic — any list app does this)
- The 16-page navigation surface area (consolidate)

**Maintain:**
- Voice capture (primary input, keep polishing)
- Semantic search (once built — P0 above)
- Offline-first architecture (works well, don't touch)

---

### 14. Break Up the Monolith Pages

> *"Decorate, decorate."*

`ProjectDetailPage.tsx`: 1,178 lines. `HomePage.tsx`: 1,169 lines. `ReadingPage.tsx`: 1,082 lines.

Extract per POLYMATH_REVIEW.md recommendations. The share target handling alone is ~200 lines duplicated twice in ReadingPage.

---

### 15. Wire Up Accessibility

> *"Go outside. Shut the door."*

`accessibility.ts` has focus traps, ARIA helpers, contrast checking, touch target validation. Almost none of it is called. FloatingNav buttons lack `aria-label`. Modals don't trap focus. The utilities exist — connect them.

---

## The Oblique Summary

| Priority | Strategy | Change | Impact |
|----------|----------|--------|--------|
| P0 | *"Repetition is a form of change"* | Close the feedback loop — synthesis learns from you | Engine evolves |
| P0 | *"What wouldn't you do?"* | Make bedtime the primary interface | Defines the product |
| P0 | *"Don't avoid what is easy"* | Semantic search using existing embeddings | Unlocks retrieval |
| P1 | *"Emphasize the flaws"* | Surface cross-pollination proactively | Creative surprise |
| P1 | *"Remove ambiguities"* | Kill loading flicker | Feels reliable |
| P1 | *"Exquisite frame"* | Voice capture shows its work | Primary input shines |
| P2 | *"What would your closest friend do?"* | Constraint-driven ideation modes | Lateral creativity |
| P2 | *"Honor thy error"* | Contradiction resolution prompts | Thinking partner |
| P2 | *"Use an old idea"* | Reading queue as active catalyst | Provokes, not stores |
| P3 | *"Be the first to not do what..."* | Data export | Trust |
| P3 | *"Only one element of each kind"* | Tame thundering herd + consolidate DBs | Performance |
| P3 | *"Gardening, not architecture"* | TypeScript strict + store tests | Reliability |
| P4 | *"What to increase?"* | Decide what Polymath is — cut and sharpen | Focus |
| P4 | *"Decorate, decorate"* | Break up monolith pages | Maintainability |
| P4 | *"Go outside"* | Wire up accessibility utilities | Inclusion |

---

## The One Thing

If you do nothing else: **close the feedback loop**. The synthesis engine generates ideas but never learns which ones light you up. After 20 ratings, you have enough signal to weight capability combinations. After 50, the engine starts to feel like it knows you. After 100, it's suggesting things you didn't know you wanted.

The bedtime prompts, the cross-pollination, the energy-matched sessions — they're all brilliant mechanisms. But they run on a static model. The moment they start learning from your reactions, Polymath stops being a tool that generates ideas and becomes a tool that understands how you think.

That's not an incremental improvement. That's a category shift.

> *"The most important thing is the thing most easily forgotten."*
