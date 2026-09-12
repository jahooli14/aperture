# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

This file is the **single source of truth** for working on this repo. If something isn't here, it's probably not important.

## How I Like To Work

- Plain English. No jargon, no filler.
- Concise. Short sentences. Bullets over paragraphs.
- Say what you did and why — skip the "I will now..." preamble.
- If something is uncertain, say so in one line and ask.
- Don't create new docs. Edit the ones that exist.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment & milestone tracking |
| **Polymath** | `projects/polymath/` | Production | Creative harness — captures thoughts and directs your creative willpower toward the right project |
| **Analogue** | `projects/analogue/` | Active | Book publishing / manuscript editing IDE |
| **Idea Engine** | `projects/polymath/api/_lib/idea-engine-v2/` | Active | Evolutionary ideation system — emails a curated daily digest of frontier-of-human-knowledge ideas. Not part of Polymath's product surface (don't conflate with Polymath's home feed). TypeScript, lives inside the polymath API — see Cron section below. |
| **Golf Masters** | `projects/golf-masters/` | Active | Masters pool tracker with live ESPN scores |
| **Heart Recovery** | `projects/heart-recovery/` | Active | Day-by-day post-heart-attack (stent/PCI) recovery guide — single user, no backend, localStorage only |
| **Relay** | `projects/relay/` | Active | Write a story with friends, a line at a time. PWA + web push. Up to 10 writers per story. |
| **Fix Queue** | `projects/polymath/` (feature) | **Needs review** — owner doesn't actively use this; code may still be running. Don't extend without checking. |

> **Sonically Sound** ships from outside this repo.

## Plain English (mantra — applies everywhere)

This applies to everything Polymath produces or surfaces: AI prompts, AI-generated copy, UI strings, error messages, settings labels, empty states, push notifications, anywhere words appear.

**Rules:**
- Real words people say. No "leveraging," "synergies," "soundscapes," "unlocking momentum," "psychological defenses," "feature-rich," "narrative substrate."
- No invented hyphenated jargon in scare-quotes ("friction-over-function," "blind-edit," "high-impact transition"). If a term needs scare-quotes to be understood, rewrite it.
- No analyst voice. The app is not consulting at the user. It's a friend who's paying attention.
- One idea per sentence. Long, hedged, multi-clause analysis is the failure mode — the analyst/oracle voice ("what you couldn't see," "what this reveals").
- Concrete nouns over abstract ones. "Logic Pro trial expired" beats "your reliance on the 90-day trial of Logic Pro acted as an artificial deadline."
- Imperative verbs are fine. Time estimates are fine. Don't hedge.
- If you can't say it plainly, you don't understand it well enough to surface it. Stay silent.

When you write or modify any prompt that asks the model for output, repeat the plain-English rule inside the prompt with a short anti-example. The default Gemini Flash voice drifts to corporate-coach unless told otherwise.



Polymath is a **creative harness**. The user opens it with willpower to spend on creative work; the app's job is to direct that willpower productively — name a project worth starting, resurface the right forgotten one, or extend an existing one in a specific direction. It is not a "knowledge graph" or a "second brain" in the Mem.ai / Roam sense. It is goal-directed.

### Core loop

1. **Capture.** Voice note in-app → transcribe → tidy prose → title → save as a "thought." Capture-time triage classifies intent (`memory_type`, `triage.category`) so downstream surfaces can find it.
2. **Feed the corpus.** Thoughts join projects (active / dormant / abandoned with `blockers`), lists (films / books / music / places / etc.), and reading (queue + RSS + highlights). Lists are **identity signals**, not consumption logs — reading *Flowers for Algernon* makes you a different creative person from someone reading *50 Shades*.
3. **Direct the willpower.** The home surface is the session contract plus one spark a day — see below. Lists and reading feed the identity layer, which shapes what the spark/composite/morph channel proposes.

### Home surface (execution rebuild — `SPEC.md`, `HomePage.tsx`)

Mid-2026 the home page was rebuilt around a different thesis: thinking time is unlimited, execution time is scarce — so capture without limit, but spend zero of the scarce hour deciding what to do. **This replaced the old "review rotation" model.** `ReviewRotation` ("worth a look" — pick it up / still mine / park it) is fully deleted; its job (offering a forgotten project back into play) now lives in the attention slot below, and quiet drift-decay kills dead projects without ever asking you to confirm a kill.

1. **Masthead** — wordmark + search + (after 21:30) bedtime icon.
2. **Today's answer = the session contract.** `TodaysAnswerCard` IS the session now, not a card that launches one: the live project, the last close-out played back in your own words, and "Start session" runs window → shapes → timer → close-out inside the same box. Its redirect panel holds the Focus chat thread and the on-demand idea deck (`ProjectIdeasHome`, still live — see caveat below). `FeelingPill` renders inside it, feeding session context into both the redirect and the idea generator.
3. **The attention slot** — `AttentionSlot`. At most **one** interruption per app open, fixed priority: a deferred close-out > the monthly mirror (once a month) > a live-project re-ask (when behaviour has quietly diverged from your stated live project) > a composite proposal (rare) > a morph proposal > today's spark (the default, most opens). Silent most of the time — this is the piece that stops five different surfaces competing for the same slot.
4. **Everything else** — `EverythingElseMini`, one swipeable row: still-warm projects then queued ones, always ending in a "suggest a project" card.
5. **Now consuming** — `ConsumingWidget`, the identity layer. Active list items on top; Saved reads + New reads underneath.
6. **Thought of the day** — `ThoughtOfTheDay`. Deliberately kept (an earlier rebuild cut removed it as redundant with sparks, then reinstated it): a spark asks something and wants a voice answer back, this just shows something you said and asks nothing. Page's closer, not a competing interruption.

> "Guide, not menu" — one statement, one action, one quiet way to redirect. Every section below the answer box is invisible when empty.

### The mull channel — sparks, morphs, composites, the mirror

The mechanism behind "the attention slot" and the thing your weekday "what should I think about" question actually is:

- **Sparks** (`mull-generator.ts` + `mull.ts`, `bake` cron resource, daily 08:00 UTC) — one per day, baked overnight so it's instant and offline-available, not generated on open. It stands for four days, because the point is that it gets to sit unanswered until the answer turns up on a walk. **One mechanism, not a menu of question shapes.** Take one subject (a project, usually — momentum-weighted with a swerve — or a recent note, or an article that earned its place), name the **blind spot** it takes for granted, rewrite that blind spot as a plain human question with *none of the subject's own vocabulary left in it*, and embed-search the whole corpus with that. Whatever comes back is the connector, and it was chosen *by* the blind spot, so there is nothing left to invent. The vocabulary strip is the load-bearing step: search "how is replacing a character different from developing one" and you get the chapter outline back — the subject restated; search "what it's like when someone you know becomes a different person" and you reach the note about your dad's garden. Retrieval is **banded** (`CONNECTOR_FLOOR`/`CONNECTOR_CEILING`): above the ceiling it's the note restated, below the floor it's noise, and inside the band anything sharing two distinctive words with the subject is dropped however well it scores — relevance from the vector, distance from the vocabulary. **The ceiling scales with how much vocabulary the subject actually has** (`connectorCeiling`): the two guards are meant to work together, but the best subjects are short and plain — "it only works if it's one take" is three distinctive words and nine stopwords — so `sharesDomain` blocks nothing for them, including the note that is that idea in different clothes. When one guard is absent the other tightens. The draft is then gated by rules, not taste (`rejectionReason`): the quote must really be in the note, the question must use it rather than append it, it ends in a question, sixty words max, and it may not contain "which mirrors" / "this connects to" / "both are about" — explaining the link is the tell that there wasn't one. **The corpus is a time series, not a bag of rows** (`corpus-time.ts`, pure + unit-tested; subjects assembled in `mull-subjects.ts`). Every selector this channel had was recency-bound — the newest 150 fragments for joint mining, 45 days for notes and articles, momentum weighting for projects — so a corpus with years in it was only ever asked what happened lately, and the years are where the convictions are. Now the subject is a **temporal shape**: a true, dated statement computed from timestamps, with the captures that prove it. `long_unfinished` (said since March 2023, never became a project — the strongest one there is), `return` (silent 14 months, back last week, where the silence must be out of character for *that* timeline or a slow conviction reads as a comeback), `conviction`, `went_quiet` (a rhythm that stopped in a nameable month), `burst` (one week two years ago, never again), `drift` (early vocabulary vs late), and `simultaneity` — two things captured days apart under different projects and never joined since, which is **purely temporal and therefore invisible to vector search**, since embeddings can only return things that resemble each other. **Span beats count everywhere**: five fragments from one Tuesday is one thought, so `mine-joints` now reads the whole corpus and drops any cluster under `MIN_SPAN_DAYS`. List items get a time dimension too (a want held a year is not a mood). **Capture time is not thought time**, which is the confound under all of it: a project going quiet in August might be abandoned, or a baby arrived and everything went quiet at once. `buildActivityBaseline` is the missing denominator — a month where the whole corpus fell silent explains any one project falling silent, and a month where everything spiked explains any one burst. So `went_quiet`, `burst` and `return` all decline when a global lull accounts for the silence. No guess about the cause, just the arithmetic. Three subjects go into the one blind-spot call, **capped at two of any one kind** — joints carry several shapes and outrank everything, so deduping by shape alone let three joints take every slot and ask three questions about the user's own recurring thoughts. Reading keeps a slot whenever any exists, since an article has no temporal shape and on strength alone would never once be chosen; `unfiled` (a thought old enough to have been filed and never was) makes thoughts a subject rather than only a connector. The model never chooses the shape and never supplies the fact — it's handed one and asked to write the question, and the prompt requires it to use the real date, because a date is the one part the user can't argue with and the one part they had no way of seeing from inside.

**What makes a question resonate** — the channel is tuned for one outcome: a question that sits for days and ends in *"oh, I should make that."* **A declared stake**: the model must say what the user would *do* differently depending on the answer, and `stakeIsHollow` rejects the ways of saying there isn't one ("a deeper sense of their themes"). A question with no consequence gets no background cycles. **The answerability band**: too easy is a quiz and is gone in five seconds; too hard is a riddle and gets dismissed; right is when they know they have the answer and can't quite reach it. **What actually landed before**: `sparks.response_memory_id` records which questions got a real voice answer and what was said back — dead data since the type bandit went — now few-shot in the draft prompt alongside the ones shown and left to expire. Six examples of what works on *this* person beats any amount of general advice. Lists go in as register, never as material (they aren't the user's words, so they can't be quoted). And the prompt stops one step short on purpose: naming the project is the one move that guarantees they don't get there themselves.

**Two model calls per run, whatever happens, and a run usually feeds the channel for a week.** Model calls are the expense; Postgres and embeddings are close to free, so the work sits either side of them. Call one names the blind spot for *every* subject at once (a project, a recent note, an article) — three blind spots for the price of one, thinking capped to `low` since naming an assumption is closer to extraction than prose. Retrieval then runs three searches instead of one, which is the step most likely to come back empty and the one that costs nothing to repeat. Call two writes up the best **two** surviving pairs together (`rankPairs` — deterministic, no third call to choose). The second question is **banked**: written with a longer expiry so it sorts behind the standing one (`today` serves soonest-to-expire), then handed over with no cron run and no model call when the first is answered or runs out. `reroll-spark` checks the bank before generating, so "ask me something else" is usually free and instant. Shelf life is stamped on first sight, not on generation, or a banked question would arrive half spent. `spark-echo.ts` still rotates the *subject* (recent sparks go into the prompt verbatim as an avoid-list, and a spark reusing a recurring motif is dropped). Silence is the common case and it's correct — most nights one of the four steps declines. `mull-pipeline.test.ts` runs the whole channel against a fake corpus with a stubbed Gemini (five gatherers, nine searches, two calls), and `mull-gates.test.ts` is a false-reject harness rather than a unit test: the gates once threw away three good questions in five, and that fails silently as an empty slot.
  > The nine rotating spark types (`noticing`, `transferred_constraint`, `contradiction`, `scale_jump`, `material_fact`, `outside_reach`, `gap`, `unfinished_thought`) and the answer-rate bandit that weighted them are **deleted** (`spark-generator.ts`, `spark-types.ts`). Each type picked its own pair and asked the model to bridge it, which is the machine that produces forced mashups — rotation made the collisions varied, not true. Don't recreate them. `session-gap.ts` lives on, but only where it always belonged: session shaping. `forgotten.ts` also lives on as the one non-question output (a tap, not words), tried only when the mull channel has nothing, and still rendered as an action by the attention slot.
- **Morphs** (`generate-morph`, daily) — a project quietly reshapes itself from accumulated fragments. Rate-limited to one project per day, one per project per 14 days. Always a proposal, never a silent rewrite; one-tap "that's not it."
- **Composites** (`joint-miner.ts` → `mine-joints`, then `composite-generator.ts` → `generate-composite`, both **weekly, Sunday**) — two *stalled* projects fuse, but only from a joint (something you keep saying, quoted, recurring) the corpus actually supplies — joint → pair, not pair → invented bridge. That inversion is what stops it producing forced mashups.
- **Drift-decay** (`drift-runner.ts` → `drift-decay`, weekly) — the silent, no-confirmation harvest: high drift + no recent capture lets a project go and releases its reusable fragments back into the pool. Never asks you to confirm a kill.
- **The mirror** (`resource=mirror`) — monthly, logged execution hours per project. Zeros shown only for the live project. No streaks, no capture counts — execution time is the only number the app ever shows. Because most execution happens off-app, there's a once-a-month voice correction ("did two hours on the decks last night") so it doesn't lie by omission.
- **The different-thing quota** (`different-thing.ts`, `different-thing-status` resource) — one hour a month on something off your usual pattern, exempt from the live-project rule. Never nagged if missed, doesn't roll over.

### `ProjectIdeasHome` (READ/CROSSOVER) — deliberately kept for now, not a bug

`SPEC.md` originally called for the rebuild to **replace** `ProjectIdeasHome` — "the idea generator becomes joints and composites." That hasn't happened, and it's staying that way on purpose: `ProjectIdeasHome` is the only **on-demand** "give me a new project idea right now" surface in the app. Sparks are cron-baked once nightly, morphs and composites are rate-limited proposals — none of them can be triggered on demand. Retiring `ProjectIdeasHome` means either accepting the loss of the on-demand button or building an on-demand path into the spark/morph/composite system first, and that decision hasn't been made. Don't remove it without that decision.

The old `resource=evolve` cron call (daily, active-projects-only, wrote to an `evolution_events` table nothing read) **has been removed** (2026) — that part of the duplication was genuinely dead weight and is gone. `ProjectIdeasHome` + `generate-project-ideas` (feeding `project_ideas`) is the one on-demand generator left, running alongside sparks/morphs/composites deliberately, not by accident.

What `ProjectIdeasHome` does:

- **READ mode** (`mode='read'`) — the longitudinal pattern reader. Names a through-line across projects/voice notes/lists/reading, then the project that breaks or extends it. Cron-only. Auto-surfaces on confidence ≥70.
- **CROSSOVER mode** (`mode='crossover'`) — locked seed pairs, four visual sub-modes (new_idea / forgotten / reshape / extend) derived from evidence. Cooldowns: rejected centres blocked 180d, shown-not-acted-on blocked 30d.

### What's NOT in the user's mental model

- **Todos / Fix Queue / AudioPen** — historical or unused. Fix Queue route + API still exist so old drafts stay visible, but cron is disabled and it isn't surfaced on home. Don't extend without checking.
- **Idea Engine emails** — not a Polymath surface. Lives inside the polymath API (`api/_lib/idea-engine-v2/`). See Cron section.
- **Context Engine sidebar** — **removed.** It was a "What connects here" panel opened from cards across the app, with six AI actions (summarize, find-gaps, suggest-next, connect-dots, chase-thread, provoke) plus an `analyze` readout.

  It invented. The only check on its output was `findVoiceViolations` — a *voice* gate, which gives the prose the house style and then passes whatever titles the model made up. With an empty corpus the context block read `(no related items found in knowledge lake)` while the prompt still ordered "Show 2-3 ways this idea echoes… Name titles directly", so at zero connections it named three articles that don't exist.

  Grounding it was possible (`session-grounding.ts` and Relay's `index/ground.ts` both do exactly this) and not worth it. Five of the six actions were "tell me something interesting about this note" — browsing enrichment with no output, the knowledge-graph mode this app isn't. The sixth, suggest-next, is already answered four times over and grounded: the answer card, the session shaper, the crossover generator, the Guide. **The test to apply to anything like it: does it end in an output, or does it just make the note more interesting to look at?**

  `/api/connections` itself stays — it's real plumbing (sparks, suggestions, paths, links) with a dozen callers, and the `connections` table feeds `memories.ts` and embeddings maintenance.

### Project = creative goal with a defined output

Active, partly-shaped, dormant, and abandoned are different states. Long-dormant projects are explicitly **not** waste — they are eligible for reshape via the crossover generator.

**Never ask what done looks like.** Plenty of real projects are ongoing (DJing, a sketchbook habit) and have no "done"; asking makes people invent one and rewrite it forever. `metadata.end_goal` is kept when the user volunteers it (extraction picks it up, the Guide writes it down when it's said in passing) and used to plan backwards. When it's absent, steps are planned *forwards* from what the project is. Its absence is never a gate, a warning, or an empty field on a card. See SPEC.md → "Where session shapes come from".

**Projects whose finish line repeats** (`api/_lib/project-cycles.ts`). DJing is "record a mix, record a mix, record a mix". Removing the finish line is one answer, and it was the old one — but it means you never finish *anything*, and each cycle looks like a brand-new project when the list empties. So the finish line is scoped to ONE unit instead: `metadata.end_goal` becomes "a recorded mix" and `metadata.cycle = { unit, done, history }` says it repeats. Every planner then works unchanged and works *well* — the spine plans backwards from a real finish, `judgeFinishLine` asks a question with a real answer. Only the ending differs: `resource=next-cycle` files what the finished one took, counts it, and plans the next from that shape (`SpineInput.previousCycle`) rather than from nothing.
- **Not a habit tracker** — that was tried and rejected. A habit is measured in frequency (did you this week, streak, you've missed three); a cycle is measured in outputs (this is the fifth). No cadence, nothing to fall behind on. A quiet repeating project goes cold like any other and is resurfaced the same way.
- `repeat_unit` is a short singular noun, extracted only when the user volunteers that the work is like that — never asked. Most projects don't repeat, and deciding one does turns it into a treadmill.
- `project_mode` is legacy and derived: a cycle means `recurring` regardless of `end_goal` now.

**The order of `metadata.tasks` is the plan.** The session takes the top open steps in order, so every writer keeps `order` contiguous (`api/_lib/task-order.ts`), generated steps declare what they come `after`, and what a close-out says comes next goes to the *front* of the open list. A step worked on but not finished carries `progress_note` — the user's own words — read back as the re-entry line for that step.

### Anti-patterns (kill on sight)

- **Forced surrealist mashups** — "willow memory totem," "dazzle-patterned commuter bike." Inputs as motifs, not as load-bearing structure.
- **Cliché tech-Twitter projects** — newsletter, podcast, course, tracker app, "directory of," digital garden, second brain, year-of-X challenge, zine that "explores" interests.
- **Admin disguised as build** — "create a file named X.json," "open settings," "research Y." A real next step uses a tool against a workpiece (cut, drill, flash, commit with named first content, drive, phone).
- **Narrative why_now** — "the April note about X means Y can finally land" asserts a causal connection that isn't real. why_now must name a specific recent acceleration that genuinely unblocks something.

### Project labels

**Labels, not containers.** Projects carry `metadata.tags: string[]` — a field that already existed and was already read by the idea generator (`gather.ts`, `seed-picker.ts`) and the resurface scorer, but had nothing writing to it. `api/_lib/project-tags.ts` fills it. A project can be both `music` and `woodwork`; that overlap is the point. `type` is legacy and is NOT a grouping axis — "creative" labels nothing when every project is creative.

- Vocabulary is **derived from what the user already has**, not a fixed enum. Existing labels are handed to the model as "strongly prefer these" so it reuses rather than minting near-synonyms. Free-text tags rot into forty singletons that group nothing.
- `normalizeTag` slugifies (lowercase, hyphenated, 2–24 chars) and drops anything that can't reduce to one. A malformed label is worse than a missing one — it becomes a filter matching exactly one project forever.
- Max 3 labels per project. Backfill is **idempotent** (skips projects that already have labels), so it's safe to re-run and safe on cron. `projects?resource=backfill-tags` POST, plus a 40-project pass in the Vercel daily cron to catch newly-created projects.

> The old review rotation (`api/_lib/project-review.ts` → `ReviewRotation` — "still mine" / "pick it up" / "park it") is fully deleted, per the execution rebuild above. Its one job worth keeping — offering a long-forgotten project back into play — now lives in `forgotten.ts` and surfaces through the attention slot; the rest (a nag to confirm a project isn't dead) is what quiet drift-decay replaced. Don't recreate `project-review.ts`, `reviewRotationOps.ts`, or their exports (`selectReviewCandidates`, `getReviewQueue`, `REVIEW_BATCH_SIZE`, `REVIEW_COOLDOWN_DAYS`) — none of them exist anymore.

**Labels drive colour** (`getTheme` in `projectTheme.ts`). Colour resolves label → legacy `type` → hashed title. A label with its own palette entry (music, art, writing…) uses it; any other label is hashed on the *label*, so every woodwork project comes out the same colour and the page reads as grouped by craft instead of as confetti. Every project card passes `metadata.tags` now.

### Identity layer

Lists + reading queue + recent highlights are framing inputs. Same project surfaces with different framing depending on what the user has been reading. *Bed by Ten* after a minimalism book reads differently than *Bed by Ten* after a film about constraint.

### Reading (RSS + the reader)

Feeds arrive as unread rows in `reading_queue` (tagged `rss`). Most of them are never opened. The reader is where an article either earns a place in the corpus or doesn't.

**Only a verdict lets an article into the corpus** (`api/_lib/reading-corpus.ts`, unit-tested). At the end of every article there are two buttons — **"This was good"** and **"Not for me"**. That answer is `reading_queue.resonance`, and it is the whole gate:
- `good` — the article counts towards project ideas, syntheses and semantic search, and *only then* is it embedded. Labelled in the generator prompt so the model can tell a vouched-for piece from one that merely sat in the list.
- `not_for_me` — excluded permanently, never embedded.
- `NULL` — undecided. One carve-out for the years of rows that predate the verdict: a **hand-saved** article (no `rss` tag) still counts, as it always did. An unread RSS headline counts for nothing.

Both answers file the article, because answering IS finishing it — there is no separate archive step. `POST /api/reading?resource=resonance`; the kept ones live under the **Good** tab on `/reading`. Nullable-column trap: PostgREST `.neq()` drops `NULL` rows, so every query gating on this uses `.or('resonance.is.null,resonance.neq.not_for_me')` and lets `selectCorpusArticles` do the real filtering.

**The gist.** Opening an article fires one Gemini call that returns three bullets saying what the piece actually claims (`api/_lib/article-gist.ts`, `POST ?resource=gist`). Cached in `metadata.gist` forever after, so a second open is free; skipped below ~220 words and recorded as skipped so it doesn't retry. Bullets that break the plain-English rules are dropped rather than shown, and fewer than two means no card at all — silence beats a hedged summary.

**Typography.** Article body is **Literata** (`--brand-font-reading`), not Playfair. Playfair is a display face: its hairlines vanish at body size on a dark screen, which is what made long reads tiring. Playfair still sets the title. Typeface / size / line spacing / column width live in a settings sheet (`ReaderSettingsSheet`) and persist per device (`src/lib/readerPrefs.ts`, pure + unit-tested) — reading preferences are set once, not per article.

**Nothing floats over the text.** `FloatingNav` (and its voice FAB) hide for the whole `/reading/:id` route, derived from the path — the reader has its own back button, edge swipe and Escape. The offline banner publishes its height as `--global-banner-h` so the reader toolbar sits below it instead of half under it. Connections are out of the reading surface entirely — the "Connected" block at the end of every article, the Connect button on the card, and `ArticleConnectionsDialog` (deleted). `ItemInsightStrip` lives on and is still used by lists.

**Extraction is a 4-tier chain** (`fetchArticle` in `api/reading.ts`) — Readability (local) → Jina Reader → Diffbot → ScraperAPI, each tried in order. Two failure modes this had to account for:
- **Bot walls posing as articles.** A challenge/interstitial page ("Just a moment…", "Vercel Security Checkpoint") can clear every tier's own length check — Readability's `charThreshold` is 0, Jina's validator only checks text length — so it gets stored as if it were the article. `api/_lib/bot-wall.ts` (unit-tested) closes this two ways: `mitigationFromHeaders` reads the header Vercel's Attack Challenge and Cloudflare's challenge action both stamp on the response (`x-vercel-mitigated` / `cf-mitigated: challenge` — authoritative, no guessing), and `detectBotWallText` pattern-matches the *extracted* text/title against known interstitial phrases as a fallback for vendors that don't stamp a header. Checked on each tier's own extracted content (Readability's `article.textContent`, Jina's validated text), never on a page's raw full-page HTML — a legitimate site's `<noscript>Enable JavaScript</noscript>` fallback would otherwise false-positive. A match throws and falls through to the next tier, same as any other extraction failure; if all four exhaust, the reader shows "Couldn't get the text for this one" with a link to the source rather than junk.
- **Link-clutter.** Jina's markdown keeps every hyperlink inline (`[text](url)`), and pages that survive Readability sometimes keep "Related stories" rows or nav rails because they live inside the same DOM subtree as the real content with no distinguishing class. Two independent fixes: Jina requests now send `X-Retain-Links: text` (keeps anchor text, drops the URL — the original is one tap away via "Open the original" regardless), and `api/_lib/link-density.ts` (unit-tested) strips DOM blocks that are mostly links rather than prose — applied inside `cleanHtml`, so it runs for every tier and every RSS path at once, not just Jina's.

### Session context

`useSessionContextStore` carries a per-session `feeling` (focused / scattered / restless), captured by the FeelingPill at app open and persisted to sessionStorage (resets when the tab closes). The on-demand "suggest a project" path passes it into the generator prompt so the re-roll calibrates to right-now state.

### Inputs still to add

1. **List-item / reading reaction tags** — one tap per item: "inspired me" / "felt off" / "made me want to make X." Sharpens the identity signal beyond "added to list."
2. **Post-Keep-Going capture** — after a focus session ends, prompt "what did you do? what's next?" A 30-second voice note feeds project freshness + cooldowns.

## Relay

Line-by-line collaborative stories. Started as a WhatsApp thread with Ben, moved
to Signal, now its own PWA. One person writes a line, the next person writes the
next one.

**The notification is the product.** Signal's notifications are why the thread
survived. If Relay's "your turn" push is worse than Signal's, it dies. Every
other feature is downstream of that working.

### Shape

- **Turn modes.** `rotation` is a strict queue (right for two people). `open`
  lets anyone but the last writer go (right for a group, where a strict queue
  stalls the moment someone's on holiday). Any member can **skip** a stalled
  turn — a rotation that can wedge is worse than no rotation.
- **Whose turn it is** is resolved by a database trigger in the same transaction
  as the line that changes it, never recomputed in the client. Pure helpers in
  `api/_lib/turns.ts` are unit-tested and shared with the UI.
- **Two views of the same thread.** `thread` shows who wrote what and when.
  `read` drops attribution and runs the lines together as prose — that's the
  reason to leave a chat app.
- **The exchange has to be visible without reading it.** In `thread`, turns sit
  on alternating sides with a rule and a faint wash in the writer's colour, so
  the back-and-forth reads at a glance — the thing chat apps got right and a
  flat list loses. Names are the fallback, not the signal. Line numbers stay in
  a fixed gutter regardless of indent, because the index cites them.
- **Chapters** are marked by the writer on the line that opens one. The story
  already did this in prose ("Chapter 2.", "III: When in Rome"); this makes it
  navigable.
- **No AI writes or suggests lines.** Ever. The whole point is that it's the two
  of you. Derived stats only — counts, gaps, chapters, all from the lines
  themselves. Never an invented story about what a gap "means".
- **The index** (`api/story-index.ts`) is the one place Gemini is used, and it
  reads rather than writes: people, places, and what keeps coming back, each
  pointing at the line numbers it came from. Tapping a number jumps there.
  - **Grounding is the whole design.** `api/_lib/index/ground.ts` checks every
    entry against the text: the cited line must exist, and the name must
    actually appear in one of the lines cited for it. Anything that fails is
    dropped, so an invented character can't reach the sheet. Pure and unit
    tested — never bypass it.
  - Notes are one plain sentence, and a note that slips into critic voice is
    dropped while the entry stands on its citations (`plain-english.ts`).
  - Built on demand, never automatically. Cached in `relay.story_index` with
    `up_to_position`, which is how the sheet knows it's behind.
  - `GEMINI_KEY` in Vercel. Without it everything else still works — the sheet
    just says so.
- **Sending is optimistic.** The line appears and the turn moves the moment you
  hit send; a failure pulls the placeholder back out and the composer restores
  your text, so a dropped connection never loses a line.
- **Push heals itself.** `ensurePushHealthy()` runs on sign-in: if permission is
  still granted but the subscription has gone (Safari drops them silently), it
  re-subscribes and re-saves. Settings has a test-notification button, because
  "did that actually work?" is otherwise unanswerable.
- **One nudge when a turn goes cold** (`api/cron/nudge.ts`, Vercel cron, daily).
  The only other push fires as a line is written — miss it and there is silence
  forever, which is how a thread dies. After `NUDGE_AFTER_DAYS` (3) the person
  who owes a line gets one reminder carrying the line they're following, then a
  `QUIET_PERIOD_DAYS` (4) rest. Stamped whether or not a push lands, so someone
  with notifications off isn't retried daily. The `relay.stale_turns` view
  answers "whose turn, how stale" in one place; solo stories are excluded.
- **Nothing written is lost.** A send that fails offline is queued in this
  browser (`lib/outbox.ts`) and retried on `online`; drafts save as you type,
  per story, and you can write when it *isn't* your turn — ideas don't wait for
  permission. Your own newest line stays editable for five minutes, and only
  while it is still the newest, since editing a line someone already answered
  rewrites what they were replying to.
- **Reading.** Long silences are named where they fall (`gapLabel`, from the
  timestamps only). How far you've read lives on `story_members`, so it follows
  you between devices. Search filters and marks hits. Names the index knows get
  a dotted underline in `thread` only — `read` stays pure prose.
- **Marks, not chat.** One tap says a line landed. No push, no reply, no thread.
- **The book** (`PrintPage`, `/story/:id/print`). Title page, chapters on fresh
  sheets, indented paragraphs, a colophon with who wrote what — printed through
  the browser, so Share → Print → Save as PDF on a phone. No attribution in the
  body: it's the thing you'd hand someone.
- **Streaks and peak times**, in the So-far sheet. The streak is counted in UTC
  calendar days — a shared number both writers see the same way, rather than
  one that reads differently depending whose timezone is asking
  (`api/_lib/streaks.ts`, folded into `summarise()` so it ships with the rest
  of the stats). Peak times (`PeakTimes.tsx`) is a day × time-of-band heatmap
  read in the *viewer's own* local clock instead — a display aid, not
  something the streak or turn logic depends on, and it deliberately doesn't
  need to agree with the streak's UTC framing.
  - **The 6pm streak-loss nudge** is a genuinely different cron from the
    turn-gone-cold one: it has to fire at each writer's own local 6pm, which
    is a different UTC hour per person and per season (BST/GMT). Relay's one
    Vercel Hobby cron slot is already spent on the daily nudge, so this one is
    dispatched hourly from `.github/workflows/relay-cron.yml` — a separate
    file from the shared `cron.yml`, on purpose: that workflow hardcodes one
    `BASE` domain for every job it dispatches, and Relay deploys to a
    different domain, so folding it in would mean threading a second domain
    through code that was deliberately hardened against exactly that kind of
    fragility. `api/cron/streak-check.ts` decides per writer, per firing,
    whether it's currently their 6pm (needs `timezone` on `story_members`,
    captured from the browser via `useTimezoneSync` and never assumed) and
    whether they're actually the one who can currently write — nudging
    someone who isn't eligible yet would just be noise. Fires once per writer
    per local day (`last_streak_alert_sent_on`), and never claims a streak is
    at risk if it isn't (`current < 1` skips it entirely).

### Setup

Relay shares a Supabase project with another Aperture app — it lives in its own
`relay` schema rather than needing a free-tier slot of its own.

1. Run the migrations in `projects/relay/supabase/migrations/` in order
   (`0001_relay.sql` through `0004_streaks.sql`).
2. Supabase dashboard → **Settings → API → Exposed schemas** → add `relay`.
   PostgREST can't see the tables otherwise.
3. `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY`,
   `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in Vercel. Without them the app works
   but notifications are off. `CRON_SECRET` (any random string, matching
   `RELAY_CRON_SECRET` in the repo's GitHub secrets) authorises both cron
   endpoints.
4. Seed the existing story, either way round:
   - **No terminal:** paste `supabase/seed-pasco.sql` into the SQL editor after
     both writers have signed in once. Two variables at the top to edit.
   - **Terminal:** `npm run seed -- --dan=you@example.com --ben=ben@example.com`.
   Both are idempotent and both leave the turn with whoever is genuinely up.
   Every line in `scripts/pasco-story.ts` carries a real `sentAt` — transcribed
   from the original WhatsApp export and Signal screenshots, not spread evenly
   across a guessed range — so "the story so far" reflects the real gaps,
   including the five months the story sat still over a wedding. One line (7)
   is deliberately misattributed by a naive transcript read: Ben retyped it at
   Dan's request to fix a typo Dan's WhatsApp couldn't edit, and Dan's own
   "your move still, edits don't count" settles whose turn it actually was.
   If a story was seeded before `sentAt` existed, `supabase/update-pasco-timestamps.sql`
   corrects it in place, matched by line position — safe to run more than once.
   Regenerate both SQL files from the transcript with
   `npx tsx scripts/make-seed-sql.ts` — never hand-edit them.

Auth is a six-digit emailed code — no passwords, no magic link. Email
templates are **per Supabase project**, and the shared one renders
`{{ .Token }}` only (Pupils signs in the same way), so a link-based flow would
send Relay's users a code with nowhere to type it. Codes also need no redirect
allow-list, and phones offer to autofill them. Don't edit that template to add
a link — it would change Pupils' email too. Env vars: `.env.example` in the
project folder (it's force-added past the root `.gitignore`).

Both SQL files are checked against a real Postgres 16 with a Supabase-shaped
shim (auth.users, auth.uid, the three roles, supabase_realtime): migration,
seed, turn trigger, 10-writer cap, invite redemption and the RLS policies.

### iOS caveat

Web push on iPhone only works once the PWA is installed to the home screen
(Share → Add to Home Screen, iOS 16.4+). A Safari tab gets nothing, and Safari
can silently drop the subscription. `NotificationToggle` detects this and says
so rather than failing quietly.

## Commands

Each project is its own npm workspace — `cd projects/<name>` first, then:

```bash
npm run dev                  # all JS projects
npm run build                # all JS projects (run before pushing)
npm test                     # polymath, wizard-of-oz, relay (vitest)
npm test -- <pattern>        # run a single test file
npm run lint                 # polymath (eslint src/ api/), analogue (eslint .)
npm run type-check           # polymath, relay (tsc)
```

`projects/polymath/` also wraps as an Android app via Capacitor — see `build-android.sh`.

## Tech + Style

- **Frontend**: React (18 in polymath, 19 elsewhere), TypeScript (strict, no `any`), Vite
- **Backend**: Vercel serverless functions in each project's `api/`, Supabase (Postgres + RLS)
- **AI**: Gemini for embeddings, classification, AND synthesis in Polymath (via `@google/generative-ai`). Claude is referenced in the Idea Engine project (Python) but Polymath itself does not currently call the Anthropic SDK — don't add it without asking.
- **Naming**: PascalCase components, camelCase functions, feature-based folders, files ≤ 300 lines
- **AI model IDs**: Centralized in `api/_lib/models.ts` (+ `idea-engine-v2/models.ts`). Chat/generation models use `-latest` aliases (`gemini-flash-lite-latest`, `gemini-pro-latest`) so they auto-track Google's newest build — no version to rot on deprecation. Caveat: `-latest` can hot-swap onto preview/experimental with ~2 weeks' notice, shifting voice/cost/rate-limits — if it drifts, pin a stable ID here. **Embeddings stay pinned** (`gemini-embedding-001`): an alias swap changes the vector space and breaks every stored embedding. Verify against [live docs](https://ai.google.dev/gemini-api/docs/models) before changing.
- **AI thinking cost**: Flash-Lite is a *thinking* model — thinking tokens bill as output ($1.50/1M). Mechanical classify/extract/score calls pass a capped thinking level via `thinkingFragment()` in `api/_lib/gemini-thinking.ts`; creative synthesis stays on the model default. `GEMINI_THINKING_LEVEL` (Vercel env: `minimal`/`low`/`medium`/`high`) globally overrides every wired call — dial it up if output quality dips, down to cut cost. Keep new mechanical calls capped; never cap creative idea/prose generation.
- **Card surfaces**: use `.glass-card` (theme.css) — this is canonical. `.premium-card` / `.premium-glass` (premium-dark.css) are legacy; don't reach for them in new code.
- **AI voice**: every prompt that produces user-facing prose interpolates `PLAIN_ENGLISH_RULES` from `api/_lib/plain-english.ts`. Add new banned words / cringe patterns there, not inline.

## Deploy

Push to `main` → Vercel auto-deploys. Env vars live in the Vercel dashboard, never commit them.

### The serverless-function budget

Vercel's Hobby tier caps a deployment at **12 serverless functions**, and
every `.ts` file under `projects/polymath/api/` that isn't in `_lib/` is one
of them. Polymath sat at exactly 12 — the next route added would have
failed the build.

Currently **10**: `brainstorm`, `connections`, `cron/jobs`, `idea-engine`,
`lists`, `memories`, `projects`, `push`, `reading`, `utilities`.

So a new endpoint is a **resource on an existing route**, not a new file.
`utilities.ts` is the pattern: it routes on disjoint `resource` name sets
(`EXECUTION_SESSIONS_RESOURCES` and friends) plus an `action` set for Fix
Queue, delegating to a handler in `_lib/`. Put the logic in `_lib/` and add
a name to a set. Anything under `_lib/` is free — it's bundled, not
deployed.

Count them before adding a route:
```bash
find projects/polymath/api -name '*.ts' -not -path '*/_lib/*' -not -name '*.test.ts' | wc -l
```

## Debugging checklist

1. Browser console for frontend errors.
2. Vercel function logs for API errors.
3. Confirm env vars are set in Vercel.
4. Supabase: empty results with data present usually means RLS — check the policies.

## Commits & PRs

Conventional commits. PR metadata is short.

**Commit subject**
- `type(scope): short summary`
- Single line, ≤ 70 chars, imperative mood.
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`.

**Commit body (optional)**
- Blank line after subject, then why + notable decisions. Wrap ~72 chars. Bullets fine.

**PR title**
- **Single line, ≤ 70 chars** — the commit subject, nothing more.
- Never paste the commit body into the title. Never include newlines.
- One commit → PR title = that commit's subject. Multiple commits → write one new subject.

**PR body**
- 1–3 bullets on what changed and why.
- Test plan: 1–3 bullets of what to verify.
- Skip boilerplate checkboxes unless a box genuinely applies.
- Link issue with `Fixes #N` if relevant.

**Workflow**
- Develop on the branch from the session brief.
- Only open a PR when explicitly asked.
- Run `npm run build` in the project folder before opening a PR.
- A PreToolUse hook (`.claude/hooks/check-pr-title.sh`) blocks PR titles that are multi-line or > 70 chars.

## Cron (`.github/workflows/cron.yml`)

One workflow dispatches every Vercel cron endpoint for Polymath and Pupils. Branches on `github.event.schedule` (the cron string that fired) — never wall-clock time, because GitHub delays scheduled runs. `BASE` is hardcoded to `https://aper-ture.vercel.app`. `workflow_dispatch` with `force=true` runs everything.

> Relay has its own separate `.github/workflows/relay-cron.yml` — it hardcodes a different `BASE` (Relay's own domain), so it's deliberately not folded into this file. See the Relay section above for what it does.

| Schedule | Endpoints |
|----------|-----------|
| `0 */2 * * *` | `idea-engine?action=generate` |
| `0 */6 * * *` | `projects?resource=recompute-heat` |
| `0 8 * * *` | `utilities?resource=generate-project-ideas`, `utilities?resource=bake` (spark), `utilities?resource=generate-morph` |
| `0 9 * * *` | `idea-engine?action=review` then `idea-engine?action=send-digest` (sequential) |
| `0 8 * * 0` | `projects?resource=generate-digest`, `utilities?resource=mine-joints` → `generate-composite` (sequential), `utilities?resource=drift-decay` |

> **Note:** the `idea-engine?action=*` endpoints are TypeScript, living in `projects/polymath/api/idea-engine.ts` + `api/_lib/idea-engine-v2/`, deployed as part of the polymath Vercel app — there's no separate standalone project. `idea-engine?action=generate` runs every 2 hours (was hourly, was `*/30 * * * *` before that) — cut because `action=review` only ever processes 10 pending ideas/day, so hourly generation (up to 24/day) was more than double what review could use.
>
> **Fix Queue cron is disabled** — the route and API remain so existing drafts stay visible, but no new drafts are generated or executed.

Besides the GitHub Actions table above, Vercel's own cron (`projects/polymath/vercel.json`, Hobby-tier limit of 1 cron) fires `/api/cron/jobs?job=daily` once a day at 21:30 UTC. That single request bundles several more Gemini-calling tasks: stuck-memory reprocessing, bedtime prompts, Power Hour plan, rotting-project detection, project labelling (untagged projects only, 40/run), embedding maintenance, and (Sundays) capability extraction + drawer digest. It used to also re-run project evolution (same prompt/table as the 08:00 UTC `projects?resource=evolve` above) — removed, since it meant every active project got evolved twice a day.

Background sync calls (DataSynchronizer): `/api/memories?action=evolution`, `/api/projects?resource=bedtime`, `/api/reading?resource=rss` — these are triggered from the client on internal timers, not by cron, so they are not in the table above. Of those, only `bedtime` can call Gemini, and only if the Vercel daily cron hasn't already generated today's prompts.

## Fix Queue (Polymath feature)

Voice-capture life annoyances → AI drafts automated fixes → approve → runs on cron.

**Architecture**
- Triage: voice notes classified as `annoyance` by Gemini (severity + automatable flag)
- Drafting: AI generates data-driven fix specs
- Approval: `/fixes` page in Polymath UI
- Execution: cron would hit `/api/utilities?action=run-fixes` (disabled)

**Fix action types**
- `send_email` — Reminder/notification via Resend
- `weather_email` — Email with live Open-Meteo weather data
- `smart_home` — Frame TV / Sonos / bird cam (Home Assistant or direct)
- `http_request` — Generic API calls

**Key files** (all under `projects/polymath/`)
- `api/_lib/fix-queue/route.ts` — Main API (draft-pending, run-fixes, approve, reject, list), served by `/api/utilities?action=…`. It was its own route until the serverless-function budget below made that too expensive; routed on `action`, which nothing else in utilities.ts uses.
- `api/_lib/fix-queue/drafter.ts` — AI fix generation
- `api/_lib/fix-queue/runner.ts` — Fix execution (tests in `runner.test.ts`)
- `api/_lib/fix-queue/types.ts` — FixDraft, FixAction types
- `src/pages/FixQueuePage.tsx` — Approval UI

**Env vars**
- `RESEND_API_KEY` — Email (configured)
- `IDEA_ENGINE_SECRET` — Bearer token cron uses to call `/api/*` endpoints
- `HOME_ASSISTANT_URL` + `HOME_ASSISTANT_TOKEN` — Smart home hub (optional)
- `SONOS_HTTP_API_URL` — node-sonos-http-api bridge (optional)
- `BIRD_CAM_URL` — Bird cam HTTP endpoint (optional)

> Frame TV has no env var — it's driven through Home Assistant (`runner.ts`), since direct local-IP control isn't possible from the cloud.

## Session start

If `NEXT_SESSION.md` exists, read it. Otherwise just begin.
