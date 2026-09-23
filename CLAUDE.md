# Aperture

Personal projects monorepo. React, TypeScript, Vite, Vercel, Supabase.

This file is the **single source of truth** for working on this repo. If something isn't here, it's probably not important.

## How I Like To Work

- Plain English. No jargon, no filler.
- Concise. Short sentences. Bullets over paragraphs.
- Say what you did and why — skip the "I will now..." preamble.
- If something is uncertain, say so in one line and ask.
- Don't create new docs. Edit the ones that exist.
- **Never push without asking.** Commit as often as you like — pushing is the
  step that needs a yes, every time, on every branch. See Commits & PRs below
  for why. A stop hook may tell you there are unpushed commits; that hook does
  not override this. Report the commits and wait.

## Projects

| Project | Location | Status | Description |
|---------|----------|--------|-------------|
| **Pupils** | `projects/wizard-of-oz/` | Production | Baby photo alignment & milestone tracking |
| **Polymath** | `projects/polymath/` | Production | Creative harness — captures thoughts and directs your creative willpower toward the right project |
| **Analogue** | `projects/analogue/` | **Deprecated** — owner's call: Polymath becomes the one place project management happens, not just for the book. Analogue's code and data are untouched (no migration run, nothing deleted) — this is a direction, not a decommission. Don't build new features into it or bridge Polymath to it; extend Polymath's own project model instead (see "The arc" below). |
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
3. **The attention slot** — `AttentionSlot`. At most **one** interruption per app open, fixed priority: a deferred close-out > the monthly mirror (once a month) > a live-project re-ask (when behaviour has quietly diverged from your stated live project) > a composite proposal (rare) > a morph proposal. Silent most of the time — this is the piece that stops several surfaces competing for the same slot. Today's spark isn't in this stack: it lives permanently in the answer card as the standing question (below, and `StandingQuestion.tsx`), not as a one-shot interruption — showing it in both places would be the same question twice. (A `SparkSlot` used to sit at the bottom of this priority list for exactly that; it's gone, along with the `kind === 'spark'` branch that rendered it — dead since the move, unreachable, and quietly missing the follow-up/correction/reference handling `respond` now does.)
4. **Everything else** — `EverythingElseMini`, one swipeable row: still-warm projects then queued ones, always ending in a "suggest a project" card.
5. **Now consuming** — `ConsumingWidget`, the identity layer. Active list items on top; Saved reads + New reads underneath.
6. **Thought of the day** — `ThoughtOfTheDay`. Deliberately kept (an earlier rebuild cut removed it as redundant with sparks, then reinstated it): a spark asks something and wants a voice answer back, this just shows something you said and asks nothing. Page's closer, not a competing interruption.

> "Guide, not menu" — one statement, one action, one quiet way to redirect. Every section below the answer box is invisible when empty.

### The mull channel — sparks, morphs, composites, the mirror

The mechanism behind "the attention slot" and the thing your weekday "what should I think about" question actually is:

- **Sparks** (`mull-generator.ts` + `mull-prompts.ts` + `mull.ts` + `mull-corpus.ts`, `bake` cron resource, daily 08:00 UTC) — baked overnight, stands for four days so it can sit unanswered until the answer turns up on a walk. **Rebuilt Sept 2026 around one idea: a revelation is something they already know and have never said, and it only shows when two or more things they captured apart are put side by side.** The previous channel grounded every question in ONE row and policed taste with regexes, so all it could do was read a note back with a question mark on the end — live, the day of the rebuild: *"Your outline centers on an unseen person gathering fragments of someone's life inside a house. What is 'a piece they need to create'?"* Honest, and empty.
  - **Draft** — one Flash call (`medium` thinking, 55s timeout) reads the whole corpus and returns up to six candidates, each built on **at least two captures**, cited by ref (`[N12]`, `[P3]` — every corpus row gets one in `mull-corpus.ts`) with a verbatim quote per row, plus a private `noticing` and a `doubt` it has to argue against itself. The prompt names where revelations live (the same stall in two projects, survivors vs dropped, two names for one want, taste vs output, drift, the aside that fits everything, the missing piece) and teaches by six cross-evidence examples on deliberately foreign subjects (`mull-examples.ts` — never anything the real corpus could contain).
  - **Gate** (`mull.ts`, `checkCandidate`) — **honesty only**. Every quote must be in the row it cites (a wrong ref with a real quote is re-pointed; a quote found nowhere is dropped). Two distinct *captures* — a fragment and the note it was cut from are one thought. Every name, number and date in the question must be in the cited rows' full text or the facts shown about them (`evidenceText`: title, date, status, filing). Plain voice. Plus two shape gates: no yes/no, no explaining the pattern. The old taste regexes (`stakeSplits`, `stakeIsHollow`, `draftQuality`, `usesQuote`, one-row grounding) are **deleted** — don't recreate them; taste is the judge's job.
  - **Judge** — one Flash call (`low` thinking, 20s) reads each survivor against its FULL evidence rows and scores revelation / truth / specific / answerable, with a verdict and a reason. Ships only on its own "ship" with truth ≥ 7, revelation ≥ 7, answerable ≥ 6 (`judgeShips`), ranked with revelation counting double. If the judge call fails, only the first honest candidate ships — never a queue of unjudged ones.
  - **Up to three per run**: one shown, two banked with staggered expiry, so "ask me something else" is usually instant and free. Shipped questions never share a row. `subject_id` is the first cited row, so the next run's prompt is told those refs and a candidate citing one is dropped; `echoesRecent` still catches the same question in new words.
  - **"Get more creative"** (`creative` flag, reroll only, after a strict reroll came back empty) — recent ground allowed again, shape gates off, judge bar drops to truth ≥ 6 / answerable ≥ 5. Honesty never relaxes.
  - **Flash only, never Pro** — the owner's call: Pro is too slow for a reroll someone is waiting on and several times the cost, and Flash is close to as good here. Budget is the 90s function limit: corpus ~3s + draft ≤55s + judge ≤20s.
  - **Exclusions unchanged**: app-authored notes (`userSaid`, and fragments filed under them), graveyarded projects and their fragments, articles without a `good` vote. Corrections from the follow-up reach the draft as undated context, never as quotable rows. `sparks.stake` stores what they'd do differently.
  - **Diagnose from a phone**: `job=bake-explain` prints every candidate with its refs, every gate rejection by name, and every judge score with its reason. `mull-pipeline.test.ts` runs the whole thing against a fake five-table corpus with the draft and judge stubbed, and checks Pro is never called.
  > The subject/blind-spot/connector search (`mull-subjects.ts`, `orbit-pairs.ts`, `project-shapes.ts`, `CONNECTOR_FLOOR`/`CEILING`), the nine rotating spark types and their bandit (`spark-generator.ts`, `spark-types.ts`), and `forgotten.ts`/`ForgottenSlot` are all **deleted** — don't recreate them. A dormant project resurfaces the same way anything else does: when the drafter finds a real pattern in it. `today` refuses to serve legacy `forgotten` rows.
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

**The arc — real progress on a project that runs longer than one spine** (`api/_lib/project-milestones.ts`, `ProjectArc.tsx`). A spine is 5-8 steps and gets replanned every time the list empties (task-spine.ts) — the right way to plan a big, open-ended project, backwards from the goal, a stretch at a time, but it left nothing behind: each replan silently starts a new list, and `completedTasks / totalTasks` (the only number ever shown) runs toward 100% as done tasks pile up in `metadata.tasks` forever, whatever fraction of the *real* goal is actually left. There is no honest percentage to compute here — the app doesn't know how many spines a project will take, and inventing one would be exactly the fabricated precision this app refuses everywhere else.

The app already asks the right question at the right moment: `judgeFinishLine` runs every time the open list hits zero, reading the stated finish line against what's actually been done and saying which, in one plain sentence. That verdict used to be shown once in the close-out receipt and thrown away. Now it's kept as a checkpoint (`Milestone: { n, at, reached, reason, steps }`, `metadata.milestones`) — the arc is the sequence of these, and the latest one's `reason` is the real "how close is this" signal (shown on the project page via `ProjectArc.tsx`, and fed into the Guide's catch-up greeting via `session-brief.ts`'s `lastCheckpoint`, so "still needs a synopsis and three comp titles" can actually be said out loud next time the project's opened, not just buried in a receipt from three weeks ago).

Skipped entirely for a repeating project (`metadata.cycle` above) — it already gets the same idea via `cycle.history`, and recording both would double up the same checkpoint. `target_date` is the other half: an optional, ISO date, **never asked for** — same rule as `end_goal` itself — offered in the edit sheet only once a finish line exists (a deadline with nothing it's a deadline *for* is just a nag). Shown as plain day-count arithmetic ("14 days until the target date" / "3 days past it"), never a projected pace — there's rarely enough data for a real rate, and a confident-sounding wrong one is worse than none.

### Attaching a capture to a project (`api/_lib/fragments.ts`)

> The same lesson has now been learned three times in this codebase, in three places: fragment attachment (`ATTACH_MARGIN`), orbit's rival count (`ORBIT_RIVAL_MARGIN`), and orbit's band. **In this vector space an absolute threshold barely discriminates; the margin over the runner-up does.** Orbit's band was set before the geometry was ever measured — floor 0.55 against a live p10 of 0.667, so it admitted everything, and ceiling 0.88 against a p90 of 0.884, so it discarded a tenth of the real matches as restatements. Measured with centroid project vectors: p50 0.749, p99 0.928, max 0.989; margins p50 0.047, p90 0.202. Floor 0.70, ceiling 0.93, and "also near" counts a rival within 0.05 of the winner rather than anything clearing the floor — which is why every pick used to read "also near 14 others".

**An absolute similarity floor decides nothing in this vector space.** Measured on the live corpus, every note scores 0.55–0.66 against its nearest project whatever it is about (p10 0.56, p90 0.66) — so `ATTACH_SIM_THRESHOLD = 0.5` admitted 98% of everything and the winner was whichever project won by a hair. Half won by under 0.02: "cervical spine injection recovery" landed on *Painting where you tip the canvas* by a margin of **0.000**, and "nutritional profile of yellow tropical fruit" on *Create custom t-shirts for friends*.

A fragment is not a harmless guess — it dates a capture onto a project's timeline, and every shape in `corpus-time.ts` is arithmetic over those dates. Wrong evidence is worse than none.

- `chooseProject` (pure, tested against the measured numbers) requires the best project to beat the second-best by `ATTACH_MARGIN` (0.06) as well as clearing the floor. That's where the pairs stop being arguable: above it, the Aperture note → Aperture, the dream-door note → *Vivid dreams book*, the woodwork course → *Paint one wood block*, the baby's milestone → Pupils. Just below, a note on Arsenal's defensive organisation attaches to *The Geometry of Good Vibes*.
- **Most captures belong to no project, and that is a real answer.** They stay unfiled, and unfiled material is ordinary corpus text to the mull channel like everything else — no separate gatherer singles it out anymore, it's just one more row in the prompt worth a question if the model finds one there. ~7 of 52 attach, not 51.
- The classifier is a second look, not a rubber stamp. Its prompt used to assert the premise — "a thought that **connects to** their project" — so it could only pick *which kind* of connection, and an unreadable answer fell back to `reference`. Nothing in the chain could say no. It can now answer `"role": "none"`, and is told that unrelated is the common case.
- Only the runner-up can dispute the winner. A long tail of weak candidates is not evidence.

**Draining a processing backlog**: `utilities?resource=reprocess-backlog` (cron-auth, `job=reprocess-backlog`) works in 40-second slices and returns `remaining` — call until it's 0. The daily job's six-a-night is right for a trickle and wrong for a backlog.

### Reading model output (`api/_lib/schemas.ts`)

**`.optional()` means "may be absent", not "may be null" — and a model says "none" with `null`.** That one word threw away **53 of 75 memories** for eight months. `triage.project_id` was `z.string().optional()`; Gemini correctly returns `null` for a note that belongs to no project; Zod rejected the whole response; the note stayed `processed: false` with no title, no themes, no `memory_type`, no triage and — worst — **no fragment**, so it was attached to no project and invisible to every gatherer in the mull channel. The corpus was never thin because the user doesn't capture enough. Three-quarters of it was thrown away after the Gemini call, silently.

- **A note is not worth losing to punctuation.** `parseModelJson` repairs the two things models actually get wrong — a trailing comma, an unquoted property name — but only after an honest `JSON.parse` fails, so valid JSON is never touched, and it rethrows the original error rather than inventing structure it can't read. Found live during the backlog drain: one note died on `Expected double-quoted property name at position 629` and then spent retries reproducing a failure that had nothing to do with its content.
- **The model sometimes echoes the title back into the body.** `extractMetadata` is handed the current title so it can improve on it, and the rewritten body occasionally opens by quoting it: `"Prioritizing Long Term Wardrobe Comfort Investments" - I've been thinking about style...`. Eight of seventy-five notes came out of one reprocessing run like that. It matters because the body is what gets embedded **and** what the mull channel quotes as the user's own words — so a live question read *"You wrote four months ago about Prioritizing Long Term Wardrobe Comfort Investments"*, a sentence nobody has ever said. `stripEchoedTitle` removes a quoted opener followed by a separator, and only when it isn't the whole body, so a note that genuinely opens on a quotation keeps it. `orig_transcript` is never rewritten, which is what made the eight recoverable.
- Model output is read with `said()` / `saidOr()`: absent, `null`, or malformed all read as absent. Request bodies from our own client stay strict — there a wrong shape is a bug to surface, not noise to absorb.
- **A garnish must never cost the note.** `triage` is enrichment; `summary_title` and `insightful_body` are the thing being saved. A malformed triage drops the triage. A missing body still fails, or a bad call would quietly overwrite a good thought with nothing.
- Values are refused, never invented. An out-of-range `confidence` drops the triage rather than being clamped to a number nobody said.
- **A deterministic bug burns five retries as fast as five transient ones.** 42 of those rows had spent `MAX_PROCESS_ATTEMPTS` and would never have been tried again. `processMemory` now clears `process_attempts` on success, so a row that failed for a reason since fixed isn't one bad day from being buried permanently.

### App-authored notes are not captures (`api/_lib/corpus-provenance.ts`)

The mull channel's whole claim is that a date can't be faked — `corpus-time.ts` says "they have kept coming back to this since March 2023" precisely because no model could invent that. **A note the app elicited breaks it.** Answer a question about a project silent fourteen months and the answer is filed under that project, dated today: the next run reports that they *came back to it*. They didn't. The app poked them and read its own poke as evidence. The same write resets the project's silence to zero, so **nothing the channel asks about can ever be `went_quiet` again** — it burns its best material by using it.

So provenance is marked at insert (`tags: [SPARK_RESPONSE_TAG]`, which survives processing because `process-memory.ts` merges tags) and filtered at read. These are still real thoughts — embedded, searchable, readable — they just don't count as *captures* on anyone's timeline. Filtered in JS, never `.neq()`: `tags` is nullable and PostgREST drops NULL rows, which is nearly the whole corpus.

Excluded from: `loadCaptures` (one point, covering project timelines, joint members, simultaneity, `corpusSpan` and `buildActivityBaseline`), joint mining, the connector pool, `unfiled` subjects, and resurfacing. **Not new debt** — morning follow-ups and bedtime syntheses were already flowing in unmarked; a daily answer would only have multiplied an open leak.

- One question and one answer is not a recurrence, but it *looks* like one: the channel picks old material to ask about, so the answer sits maximally far in time from what it answers and sails past the span guard that stops "five fragments from one Tuesday".
- An answer is by construction the row closest in meaning to the question that produced it, so it ranks high as a connector — where `CONNECTOR_LABEL` introduces it to the draft model as *"a note they made, about something else entirely"*.
- Spark answers are processed `coreOnly`: embedded and searchable, deliberately **not** fragment-attached.

**One question back, so a wrong premise can be corrected** (`api/_lib/spark-followup.ts`, pure + unit-tested; `utilities?resource=spark-followup`). A computed fact is true and still may be out of date — "you gave up on custom t-shirts in January" is arithmetic, but whether that is still how they think about it today is only knowable from them, and there was nowhere to say it. They answer, the app asks one short thing, they reply or skip, and both their turns save as one note.

- **Only the user's turns are ever stored.** The follow-up question is scaffolding: it exists to get a second sentence and is thrown away. Saving it would put model prose into the corpus as "their own words", where the grounding gates would later check the model against itself and `loadResonance` would few-shot on it.
- **Two turns, never more.** These get answered on a walk or not at all.
- The follow-up hunts the correction first, because people correct you politely and move on — "actually I never gave up on it, it moved to the other list" is the most valuable thing the channel can hear and the easiest to miss. `NONE` when their answer already settles it; a shrug under `MIN_ANSWER_CHARS` is never followed up, and a reply that isn't a question or runs past 24 words is the model narrating and gets dropped.
- **The model names its reason before it may ask**, as data: `correction`, `next_step`, or `none`. Asked in prose it invented one — on a fully settled answer (*"Ben's. I'll print his this weekend, the design is done"*) it came back with *"Wait, you didn't give up on custom t-shirts in January?"*, disputing a premise the user had never disputed, and it did that twice after being told in plain words that none was fine. Declaring the reason is the difference between asking and hoping. The reasons are defined by example rather than by a blanket "none is normal", which over-corrected into never asking anything at all.
- **`offersAChoice` applies here too.** Two of four live follow-ups were binaries — *"is it the exact same design, or did restarting change the file?"* — with the prompt already banning them. Checked, not just asked for.
- **Nothing stands between them and a saved answer.** A failed or empty follow-up call just saves, exactly as before, and `skip` sits next to `Done` rather than hidden.

**A correction doesn't just save — it comes back.** Catching the wrong premise was the whole point of the follow-up, and until now the correction was saved and then never read again: `userSaid`/`loadCorpus` exclude every spark response from the corpus (the same fake-recency reasoning as everywhere else in this section), so the channel could ask the identical wrong-premise question a second time. `askFollowUp` now returns its `reason` (`correction` | `next_step`) alongside the question, `respond` tags a `correction` turn with `corpus-provenance.ts`'s `SPARK_CORRECTION_TAG` (kept in `APP_AUTHORED_TAGS`, so it's still never a dated capture), and `mull-generator.ts`'s `loadCorrections` hands those notes to the next draft call as plain, undated text — "don't build a new question on a premise one of these already corrected" — never as a row in `corpus.rows`, so a correction can inform a question but can never itself be quoted as if it were something freshly said. Every saved spark answer also carries `source_reference: { type: 'spark', id, title }` — the question it answered, in the one field `processMemory` never overwrites — since processing rewrites both `title` and `body` to the AI's own summary and there was otherwise no trace left of what prompted the note. Shown on the thought card and its detail view as "In answer to: …". Still governed by the rule above: only the user's own turns ever reach `body`; the question text lives in `source_reference` and the correction's undated echo in the prompt, never inside anything the grounding gates or `loadResonance` would read as their own words.

- **A tag that exists to be invisible has to actually be invisible, everywhere.** `SPARK_RESPONSE_TAG` predates `SPARK_CORRECTION_TAG` and had already been landing first in every spark answer's merged `tags` array (existing tags are spread before the AI's own extracted ones in `process-memory.ts`). `MemoryCard`'s footer pill picked `tags?.find(t => t !== 'offline-pending')` — the one exclusion it knew about — so every answered spark has been showing a raw "spark-response" pill since the feature shipped, and would now show "spark-correction" too. `src/lib/internalTags.ts`'s `NEVER_SHOWN_AS_TAG` (mirrors `APP_AUTHORED_TAGS`, plus `offline-pending`, a different kind of internal tag — sync state, not provenance) is the one list both the card and `EditMemoryDialog` read now. The edit dialog has its own version of the same leak: it loads `tags.join(', ')` straight into a plain-text field, so opening a spark answer to edit anything else and hitting save could silently drop `spark-correction` — with it goes the note's whole path into `loadCorrections`. `APP_AUTHORED_TAGS` (the provenance-only half of the list) is filtered out of that field and re-merged on save regardless of what's typed.
- **The dead `SparkSlot` in `AttentionSlot.tsx` is gone.** Its own neighboring comment already said why: "the question types moved to the answer card as the standing question." Nothing ever set `kind` to `'spark'` after that move, so it was unreachable — but it still called `respond` with bare `response_text`, no `turns`, no follow-up, no `is_correction`, no `source_reference`. Live code that can't run is a lower risk than a second, silently stale answering path a future edit could reconnect.

**A dismissal is not an answer.** `dismiss-spark` wrote `answered_at` — the same field `respond` writes — so "not interested" and "here's my answer" were one row state. Live: 36 sparks, 4 marked answered, 3 of them dismissals. One real answer, recorded as four. The draft prompt few-shots on "questions that got a real voice answer", so every dismissal was being learned from as a success. `sparks.dismissed_at` now separates them.

**Answering happens inside the request.** `respond` fired `processMemory` and returned; a Vercel function has no obligation to finish work started after the response is sent, and the UI's `.catch(() => ({}))` showed "Saved." regardless — including on a 500. An answer that changes nothing about future questions is the whole feature failing silently, twice over.

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
- `good` — the article counts towards project ideas, syntheses and semantic search, and *only then* is it embedded. This is the only way in.
- `not_for_me` — excluded permanently, never embedded.
- `NULL` — undecided, and it counts for nothing. Opening it, saving it, filing it and archiving it are all things you do *before* you know what the article says.
  > **Two looser rules were tried and both were wrong.** The first let an undecided article count if it was **hand-saved** (no `rss` tag). The second added "or you opened it" (`read_at`), on the reasoning that a 198-article corpus with zero of them counting meant the rule was too strict — the buttons are at the *end* of an article, so most reads never tap one. That rule put **two articles the owner had archived without reading** into a live question, as the sources. And `read_at` was never even a record of opening: **any path that sets `status` to `'reading'` stamps it**, including the right-swipe on New reads whose own comment says the article hasn't been read. A filing gesture is not a verdict, and an intention to read is not a judgement of what the thing turned out to say. The rule is the vote, and only the vote. It is strict on purpose and the cost is real — the reading input stays empty until articles get voted on — but an article that shapes what the app says back to you should be one you finished and vouched for.

**The verdict is asked for on the way out, not only at the bottom** (`src/lib/verdictPrompt.ts`, pure + unit-tested). The two buttons live at the END of the article and almost nobody reaches the end, so a gate that works perfectly has been guarding an input nobody ever filled: **297 articles, zero verdicts**, across the whole life of the feature. The rule is not loosened — what changed is where it can be reached from. Every exit (back, Escape, the edge swipe) routes through `leave()`, which asks once if the article has no verdict and they got at least `ENOUGH_READ_PERCENT` (25%) through it. Opening something and closing it is not an opinion about it, and skipping is a first-class choice sitting next to the two buttons: an article you have no view on is exactly what the gate is for, and nagging would only produce votes that mean nothing.

Both answers file the article, because answering IS finishing it — there is no separate archive step. `POST /api/reading?resource=resonance`; the kept ones live under the **Good** tab on `/reading`. Nullable-column trap: PostgREST `.neq()` drops `NULL` rows, so every query gating on this uses `.or('resonance.is.null,resonance.neq.not_for_me')` and lets `selectCorpusArticles` do the real filtering.

**The embedding write itself is the one choke point, not each caller.** `generateArticleEmbeddingAndConnect` (`api/reading.ts`) is called from four places — save (RSS/pre-processed), extraction-complete, the legacy analyze endpoint, and the resonance handler — and three of the four used to embed unconditionally, contradicting this section's own rule (an unread RSS headline and a rejected article both got embedded the moment they were saved, before any verdict existed, because only the resonance-handler call site checked `verdict === 'good'`). Fixed by moving the check inside the function itself: it re-reads `resonance`/`tags` fresh from the row and calls `isCorpusEligible` (`api/_lib/reading-corpus.ts`) before writing, so every call site is safe by construction and a future one doesn't need to remember to gate itself. The resonance handler also now nulls `embedding` when the verdict is `not_for_me`, since a `not_for_me` doesn't retroactively clear an embedding an ungated path already wrote — that made a rejected article a permanent, silent connector otherwise. `20260913_clear_ungated_reading_embeddings.sql` clears every embedding without a `good` verdict, so `match_reading` and its callers (`connections.ts`, `brainstorm.ts`, the mull channel) stop treating unvouched reading as corpus; an article earns its vector back the moment it is voted on. `maintainEmbeddings` writes that column directly rather than through `reading.ts`'s gated writer, so it applies the rule too — miss that and the backfill quietly re-embeds everything the gate exists to keep out. Downstream `.not('embedding', 'is', null)` queries need no resonance filter of their own now that the invariant (embedded ⟹ corpus-eligible) holds at write time.

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
- **Embeddings** (`api/_lib/gemini-embeddings.ts`, `gemini-embedding-001` at 768 dims via MRL). Three things worth knowing, all verified against the [live docs](https://ai.google.dev/gemini-api/docs/embeddings) (Sept 2026):
  - **What gets embedded matters more than the model.** An article's vector is built from `article-text.ts`'s `articleEmbeddingText` — title plus the article's real text, stripped of HTML and cut at `EMBED_CHAR_BUDGET` (8000 chars ≈ the model's 2048-token limit, which it otherwise truncates silently). It used to be `title + excerpt`, and `excerpt` is a *UI* field the ingest caps at 100 characters ("2 lines on mobile"), so every feed article's vector described a teaser. Only an article voted `good` is embedded at all (see Reading). `match_reading` was comparing questions against blurbs. One helper now, because three callers built this string separately (subject gatherer, embed-on-save, maintenance backfill) and only one of them knew.
  - **Vectors are normalized on write.** gemini-embedding-001 only returns unit-length output at its native 3072 dims; below that you must normalize yourself. Nothing was broken — every comparison here is cosine (pgvector `<=>`, and `cosineSimilarity` divides by both magnitudes), which ignores magnitude — and that is also why it needed no migration: normalized and un-normalized versions of the same vector score identically, so old and new rows stay comparable. It matters for what comes next: an inner-product (`<#>`) or L2 (`<->`) index on un-normalized vectors returns wrong neighbours and looks like "search got worse" rather than a bug. `toVector` also throws if the API returns a width other than 768, since `outputDimensionality` rides through this SDK untyped.
  - **Every corpus row gets a vector, and the coverage is counted rather than assumed.** "Everything is embedded" was unfalsifiable, and the failures it hid all present identically — a gatherer returns zero and there is no way to tell an empty corpus from an unembedded one. `maintainEmbeddings` now walks all five corpus tables in one loop (`CORPUS_TABLES`), because five copy-pasted blocks is exactly how `list_items` ended up with an `enrichment_status = 'completed'` filter none of the others had: an item whose enrichment lookup failed was invisible to every search forever, with nothing to retry it. The item itself — "Flowers for Algernon" — is the signal, and it is there from the moment it is added. **Joints are embedded too**: a joint is "something you keep saying", as much a corpus object as a note, and without a stored vector `joint-miner` re-embedded every existing joint on every run just to dedupe against them. `api/_lib/embedding-coverage.ts` (pure + unit-tested) counts MISSING / STALE / not-corpus per table, `utilities?resource=backfill-embeddings` embeds the gaps and returns the report, and `bake?explain=1` prints the same lines — so `job=backfill-embeddings` or `job=bake-explain` answers "is the corpus actually embedded?" from a phone.
  - **`embedded_at`, so a stale vector isn't invisible.** A vector built from text that has since been rewritten still returns rows and is quietly answering about text that is gone — worse than a missing one, because nothing retries it. Every write stamps when it was computed; a row whose content is newer is stale. The column arrives with a migration the deploy doesn't run, so every write that names it falls back to a write without it on `42703` — otherwise the day of the deploy is a day with no embeddings at all. Same for reading coverage: PostgREST fails the *whole* select when one named column is missing, and these columns are genuinely uneven across the five tables, so `selectCoverage` drops what a table lacks and says which.
  - **Time is not in the vector, and must not be.** Appending "March 2024" to the text before embedding makes every note from that month look alike, which is false — it drags unrelated captures together by calendar rather than by meaning. Time weights the **average** instead (`projectCentroid` in `orbit.ts`): a project's vector is the time-decayed mean of its own captures (180-day half-life, description weighted as one capture, output unit-normalised), so its position follows where the work actually went rather than where it started. That also fixes a length asymmetry — `projects.embedding` is title plus description, often twenty words, and everything it is scored against is a paragraph, so a thin description made a project everyone's nearest neighbour. `centroidDrift` reads the same data the other way: early captures against late ones, which is how far a project has quietly become something else.
  - **`batchGenerateEmbeddings` now actually batches.** It was `Promise.all(texts.map(embedContent))` — N concurrent HTTP calls, so a 40-item backfill was 40 requests against the rate limit and one 429 failed and re-fired all of them. `batchEmbedContents` is one request.
  - **One vector space, and it is the query one — measured, not chosen.** Retrieval here is asymmetric (a search against a corpus of notes), so the textbook answer is `RETRIEVAL_DOCUMENT` for stored rows and `RETRIEVAL_QUERY` for searches. That answer assumes retrieval is the only thing the vectors are for, and it is not: the same `memories.embedding` column also decides which project a capture attaches to (`fragments.ts`), which notes cluster into a joint (`joints.ts`), and where a project's centre of mass sits (`orbit.ts`) — all document-against-document and symmetric. `RETRIEVAL_DOCUMENT` is trained to make a document findable *by a query*, not to hold documents apart from each other, and on this corpus it does the opposite. The whole corpus was rebuilt both ways and measured: attach margins p50 `0.0081` → `0.0164` and p90 `0.0407` → `0.0807`. The ranking degrades with the numbers — in query space the woodwork note reaches *Paint one wood block* and the dream-door note reaches *Vivid dreams book*, two of the four pairs named above as the ones that stop being arguable, and in document space both drop out of the top six for vaguer pairs. So it is `CORPUS_TASK`, a named constant with the numbers attached, rather than a per-call parameter someone can set on one writer and quietly break the thresholds everywhere else. Passing no `taskType` at all is byte-identical to it (cosine 1.000000 against the live API), so this names what was already true. **Every measured constant in the codebase lives in this space** — `ATTACH_MARGIN`, `ORBIT_FLOOR`/`CEILING`/`RIVAL_MARGIN`, `RECURRENCE_SIM_THRESHOLD` — so changing it is a flag day for the vectors *and* a retune of everything else measured here. That is what makes it a real decision and not a tuning knob: in document space `RECURRENCE_SIM_THRESHOLD` 0.72 admitted 1551 of 2850 note pairs — over half the corpus as one recurring theme. It doesn't fail, it just quietly stops meaning anything. (`CONNECTOR_FLOOR`/`CEILING` and `RESTART_SIM` were measured in this same space and are retired along with the connector-search pipeline and `project-shapes.ts` they tuned — see the Sparks section above.)
  - **`scripts/rebuild-embeddings.ts` (`npm run embeddings:rebuild`) is the flag day itself.** Every vector, one run, ~370 rows for about a penny — because a half-migrated space still returns numbers and is just silently worse. It embeds through the same helper the app uses, so it cannot write a space the app does not read, and it skips articles without a `good` verdict like everything else does. `gemini-embedding-2` is GA (April 2026) and is **not** the upgrade it looks like: measured, it ignores `taskType` entirely (query and document come back cosine 1.000000), taking the task as a prompt instruction instead. Also latent: the ivfflat indexes are `lists = 100` on tables of 34–198 rows, far too many lists for the row count (pgvector wants ~rows/1000, and `probes` defaults to 1) — harmless while Postgres seq-scans tables this small, a silent recall collapse once it stops.

- **AI model IDs**: Centralized in `api/_lib/models.ts` (+ `idea-engine-v2/models.ts`). Chat/generation models use `-latest` aliases (`gemini-flash-lite-latest`, `gemini-pro-latest`) so they auto-track Google's newest build — no version to rot on deprecation. Caveat: `-latest` can hot-swap onto preview/experimental with ~2 weeks' notice, shifting voice/cost/rate-limits — if it drifts, pin a stable ID here. **Embeddings stay pinned** (`gemini-embedding-001`): an alias swap changes the vector space and breaks every stored embedding. Verify against [live docs](https://ai.google.dev/gemini-api/docs/models) before changing.
- **AI thinking cost**: Flash-Lite is a *thinking* model — thinking tokens bill as output ($1.50/1M). Mechanical classify/extract/score calls pass a capped thinking level via `thinkingFragment()` in `api/_lib/gemini-thinking.ts`; creative synthesis stays on the model default. `GEMINI_THINKING_LEVEL` (Vercel env: `minimal`/`low`/`medium`/`high`) globally overrides every wired call — dial it up if output quality dips, down to cut cost. Keep new mechanical calls capped; never cap creative idea/prose generation. The spark channel (`mull-generator.ts`) drafts on Flash at `medium` and judges on Flash at `low` — never Pro (too slow, too expensive, barely better).
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
- **Never push without asking first.** Every push to a branch triggers a Vercel
  build, and the Hobby tier's account-wide deploy limit is easy to exhaust —
  once it's hit, nothing deploys for 24 hours and no amount of correct code
  can be verified. Commit freely, locally, as often as you like. Batch the
  commits and ask before pushing. `~/.claude/stop-hook-git-check.sh` asks for
  a push whenever commits are unpushed — it predates this rule and loses to it.
- Only open a PR when explicitly asked.
- Run `npm run build` in the project folder before opening a PR.
- A PreToolUse hook (`.claude/hooks/check-pr-title.sh`) blocks PR titles that are multi-line or > 70 chars.

## Cron (`.github/workflows/cron.yml`)

One workflow dispatches every Vercel cron endpoint for Polymath and Pupils. Branches on `github.event.schedule` (the cron string that fired) — never wall-clock time, because GitHub delays scheduled runs. `BASE` is hardcoded to `https://aper-ture.vercel.app`. `workflow_dispatch` with `force=true` runs everything; **`job=<name>` runs exactly one and stops** (`bake-explain`, `bake`, `mine-joints`, `recompute-heat`, `retire-and-rebake`, `reembed-articles`, `backfill-embeddings`) — `force` for a single endpoint also pays for two digests, the idea-engine generator, a morph and a whole-corpus joint mine. `hit()` prints the response body into the Actions log, so `job=bake-explain` is a full diagnosis of the mull channel from a phone: no terminal, no Vercel dashboard, no cron secret. `job=retire-and-rebake` (`resource=retire-and-rebake`, cron-authenticated twin of the user-facing `reroll-spark`) retires whatever spark is currently standing and bakes a fresh one — the only way to clear a question a code fix has already made obsolete without waiting out its four-day shelf life or tapping "ask me something else" in the app. The two callers differ by one flag and it is load-bearing: `retireAndRebake(…, force)`. Without `force` it restores the standing spark's expiry whenever no replacement can be baked, which is right for "ask me something else" (don't take away a spark the user was fine with because a reroll came up empty) and exactly wrong for the cron path, which defeats its own purpose that way. A football question baked from pre-fix logic survived a full day of correct fixes because retire-and-rebake dutifully put it back each time the echo gate — correctly comparing against that same poisoned history — rejected every fresh draft. Restoring "the one you had" only makes sense when it was a fine spark you're gambling away, never when it *was* the bug.

Every query in the mull channel (`api/_lib/mull-corpus.ts`, `api/_lib/mull-generator.ts`, `api/_lib/joint-miner.ts`, `api/_lib/drift-runner.ts`) reports its own errors into the trace or console rather than letting `const { data } = await supabase…` read a rejection as an empty table — that exact bug cost a day (`memories.project_id` didn't exist) and then recurred twice more (a PostgREST embed on `memories(embedding)` that silently kept the joints table empty for months; `sparks.type` missing `'mull'` from its CHECK constraint, read by the UI as "couldn't reach the server"). `mull-corpus.ts`'s `loadCorpus` retries each of its five queries once on a transient error (Gateway Timeout, ECONNRESET, `isTransientError`) — the one query-failure class worth retrying; everything else (a bad filter, a missing column) is a real rejection and retrying it would just be slower.

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
