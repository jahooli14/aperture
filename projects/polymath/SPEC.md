# Aperture — execution spec

> A **rebuild** spec: it replaces the home surface and the model of what a project is.
> `WHY.md` is the thesis. This is the machine.

---

## The thesis, short

Thinking time is unlimited. Execution time is scarce, unpredictable, and the only
thing that produces anything.

Capture without limit, think across everything, execute on one thing at a time —
and spend zero of the scarce hour deciding what to do.

An aperture gathers wide and focuses to a point. That's the mechanism, not the name.

---

## The finding this is built around

> *"I just prefer DJing at the moment, and the book I need 2 hours for, and I'd rather DJ."*

The book isn't blocked by willpower. It's blocked by **minimum session size**. It needs
two hours; two-hour blocks don't occur naturally; so it never happens.

And it needs two hours partly *because it's always cold* — a chunk of that block is
re-entry. Keep it warm between sessions and the same work fits in 75 minutes.

So the mull channel has a hard job, not a soft one:

> **Mull exists to lower the minimum session size of the things you can't currently start.**

Two consequences:

1. Every project carries a **minimum viable session** (MVS), learned from real sessions.
2. When MVS exceeds the windows you actually get, the app stops suggesting that project
   and offers to **book** it instead. Some work is scheduled, not waited for.

---

## Two channels

Split the portfolio by which currency it spends, not by priority.

| | Execution | Mull |
|---|---|---|
| Currency | Scarce hours | Free thinking time |
| Size | **One live project**, one on deck | Everything else. No limit. |
| Feels like | A contract | A conversation |
| Cost of adding one | High | Zero |

Moving a project out of execution is not failure — it's "in mull right now." The app
can say that out loud: *"The book's not in play. It's still here."*

**Terminology (fixed).** The one project you have declared is the **live project**.
Never "priority" — that word is retired from this surface to avoid two names for one thing.

### Two decisions, never conflated

- **Which project is live** — a standing declaration. *The user makes it. The app never
  picks it.* It is re-asked **on evidence, not on a timer**: when three consecutive
  logged sessions are on something that isn't the live project, ask once —
  *"You've been on the decks. Make that the live one?"* An accurate declaration is
  never interrupted. A calendar-driven re-ask would nag people who are on track.
- **What you do in this session** — the app proposes. Always one proposal, never a menu.

The first is yours. The second is its job. Most of the spec is about the second.

---

## Objects

**Voicing** — any capture. Never limited, scored, deleted, or given a status. The
utterance is free; the commitment is not.

**Project**
- `tags` — labels (existing mechanism)
- `state` — live / on-deck / mull / harvested
- `mvs_minutes` — minimum viable session (see seeding below)
- `next_move` — the one next move, written from the last session's note (see below)
- `slots[]` — named gaps: sound, venue, first track, material, deadline, collaborator.
  **An empty slot is what dormancy actually is.**
- `last_stopped_at` — your own words from the end of the last session

> **Mapping to what exists.** `state` supersedes the current `is_priority` boolean —
> `is_priority = true` becomes `state = 'live'` at migration. Don't run both.
> `metadata.tags` and the label vocabulary carry over unchanged.

**Fragment** — a voicing attached to a project with a **role**: reference, constraint,
material, deadline, obstacle, collaborator. Roles make accumulation useful — three
references and no deadline behaves differently from the reverse.

**Joint** — something you've said more than once that applies across projects.
*"Contrast between clean and raw."* Corpus-derived, quoted, never invented.

**Session** — one move, a timer counting up, a close-out note. Append-only.

### Stalled (defined, because composites gate on it)

A project is **stalled** when it has no logged session in 6 weeks **and** at least one
empty slot. Time alone isn't stall — a finished-shaped project sitting quietly is fine.

---

## The session

### Opening (target: instant)

The move was written when the last session ended, so opening costs nothing:

1. **The move is already on the card.** One move, in the medium's own verbs, with its
   "Done when" — written from your own note last time. Your note sits under it.
2. **Go.** No "how long have you got": one move needs no sizing, and the clock counts up.
3. **Or "not this".** "Too big" and "wrong thing" are one tap each; your own words work
   too. A new move is written, and the answer is kept (`move_feedback`), so the next
   move is written to your size and a turned-down move is never offered again.

### First run — session one has no history

`WHY.md` sets the rule: **pay the user back in the session they captured in, or fail.**
A project with nothing done yet has no note to write a move from, so it opens on what
it does have: its description and the notes it was made from.

- **When nothing is decided**, and the notes hold a real fork, it opens on the fork as a
  question — *"Is it about the pole, or about the wires?"* — because a decision beats a
  step when nothing's decided. You answer in a sentence; the answer is kept as a note
  and writes the first move.
- Otherwise it opens on the smallest real piece of the thing itself.

### Where the move comes from (`next-move.ts`)

**Written at the end of the last session, not the start of this one.** In creative work
you only know the next step once you've done the current one, so a list written up
front is out of date by item two. The project keeps ONE move (`metadata.next_move`),
rewritten by one call at close-out from, freshest first: the note just left, what was
ticked, the move you'd been given, earlier notes, what's been done, what the project
is, and — as background only — the old step list. If the note says what's next, that
IS the move. If something's bugging you, the move can go straight at it.

- **Three openings.** *new* (nothing done: maybe a fork), *going* (the move comes out of
  the last note), *returning* (a month or more away: meet the work again first — play,
  read or look at the last thing that exists, and say one sentence about it).
- **Grounded like everything else**: no admin verbs, nothing named that the evidence
  doesn't name, not a move already turned down. A move that fails falls back to the
  note's own "next", then the old list's next step, then the plainest honest move
  there is: go and look at the last thing you made. Never nothing.
- **Instant, always.** Written at close (in parallel with the debrief, so the close
  waits for one call, not two), and nightly for the few projects most likely to be
  opened that have none or whose move has gone a month stale (`ensureMovesForUser`).
- **Tasks are a log, not a plan.** A ticked move lands in `metadata.tasks` as done work,
  its "Done when" stripped. The old step list (`task-spine.ts`, still written at
  creation and for a repeating project's next cycle) stays folded away on the project
  page and is read by the move-writer as where it was heading, never shown as orders.
- **The finish line**, when you gave one, is judged by the same call: only a *reached*
  verdict is said out loud (a "not yet" after every session is a nag); every verdict
  that changes is kept on the arc (`project-milestones.ts`).

### Making a project (one call)

Capture is one screen, not three: say it (voice, listening on open), and the assistant
asks **at most one question**, only when it can't plan a step from what's been said.
Then a single `shape-project` call returns the title, what it is, the labels, the
finish line *if they said one*, and the first steps in order — all editable in place
before anything is saved. The conversation is stored on the project, so later sessions
cite what was said instead of asking again.

What creation no longer asks for: a finish line, a project type (`type` is legacy and
labels are the grouping axis), a finish-or-habit toggle (derived from whether a finish
line exists), or a separate "first step" field.

### Seeding MVS

- **First session on a project:** ask once, in one line — *"how long do you usually need
  to get going on this?"* Voice, once, never again.
- **After three sessions:** replace the estimate with the measured value —
  the 25th-percentile duration of sessions that **moved**.
- **"Moved"** is classified from the close-out text by a cheap capped-thinking call:
  did the user describe something changing, or describe not getting anywhere? Never a
  button — a yes/no next to a timer is exactly the question-beside-two-buttons pattern
  this spec bans.
- Recompute rolling. MVS is expected to *fall* as mull keeps the project warm; that fall
  is the system working, and is worth showing when it happens.

### Booking a big block

When MVS exceeds the windows you actually get, suggesting the project is dishonest —
it can't be done in the time available. Offer to book it instead.

- The app produces the ask: *"The book needs about two hours. When?"*
- **No calendar integration in v1.** A block like this is a commitment to the household,
  not to an app, so it belongs in the calendar you already share. You put it there.
- The app stores the intended date and time, and on that day opens pre-loaded with the
  book, warm, first item ready.
- If the block passes with no session logged, it is not mentioned. Ever.

### The screens (`SessionContract.tsx` + `components/session/flow/`)

1. **The move** (`MoveCard`, and the home card itself) — the move, its "Done when",
   your last note under it. Go, or "not this". A fork shows as a question to answer.
2. **Focus** (`FocusShell` + `WorkView`) — Go takes the whole screen, true black: the
   move, big, a Done button, "I'm stuck", Stop. The clock counts up. Minimise steps out
   without stopping (remembered per session, so home never throws it back over you).
3. **The breadcrumb** (`Breadcrumb`) — where you stopped, what's next, what's bugging you.
4. **The hand-off** (`Handoff`) — "next time starts with…", the move just written from
   that note, correctable right there in a sentence while it's fresh.

### The timer

- Counts **up**. There's nothing to size, so nothing to count down to.
- Never interrupts, never nags, no progress bar.
- Stopping is one tap and is always fine.
- **The stopping point is visible, never pushed.** The move shows its "Done when". Once
  it's done: "keep going while it's flowing", and Stop becomes the obvious button.
- **"I'm stuck"** sits under the move: one move on it — smaller, sideways, or a
  constraint. Never a new plan, never saved (`resource=stuck`).
- **On Android the move sits in a persistent, silent notification** with Done and I'm
  stuck buttons, so the phone can stay face-down. Cleared the moment the session ends.

### Closing — the highest-value input in the system

Timer stops → one question → thirty seconds of voice.

- Normal: *"Where did you stop, and what's next?"* — the breadcrumb. Stopping mid-thing
  with the next move named is what makes the next session a two-minute start.
- After a short or abandoned session: *"What got in the way?"* — a bad session is data
  about conditions, and the wrong question there gets no answer.

It sets `last_stopped_at`, feeds the corpus, and **writes the next move** — so the next
session starts instantly, from your own words.

The debrief (`debrief-matcher.ts`) still sorts what was said against any open steps on
the old list: finished, finished-but-unlisted, and **part way** (`progress_note`). What
comes *next* no longer goes onto a list — it goes into the move.

**Never say "incomplete."** 22 minutes with item one done is a good session. The framing
decides whether the app gets opened next week.

**Skipping close-out will be the norm, not the exception** — the interruption that ended
the session is also what stops you answering. So it is never lost, only deferred: if a
session ends with no close-out, ask at the **next app open** instead.
*"You did 40 minutes on the decks on Saturday — where'd you get to?"*

A session with no close-out after 7 days is left alone. Never asked twice.

### Overrides

Saturday-you wins, always. No confirmation, no "are you sure."

The switch must be as fast as the default — the on-deck project and the cold-start shelf
are kept warm too, each with a first move and a finish line. If honesty is slower than
compliance, you stop being honest.

One thing the app may say, **once, as a fact and not a question**: *"Book's one session
from done."* You can ignore a fact. A question demands an answer.

### What "one live project" does and doesn't mean

It governs **where re-entry investment goes** — whose shapes are kept fresh, whose
`last_stopped_at` is played back first. It is **not** a rule about what you're allowed
to do on a given day.

Sessions on the cold-start shelf, on the on-deck project, or on the monthly
different-thing are all legal and all log hours to their own project.

---

## The mull channel

**One spark per day, on app open.** No push notifications — the spark is the reward for
opening the app, which is what builds the habit. Opening five times in a day shows the
same spark until it's answered; once answered, the slot is empty until tomorrow.

Sparks are **baked overnight**, not generated on open. That makes them instant, offline-
available, and cheap.

**Shelf life.** Four days, so a question can sit: you read it, you don't answer it, and
the answer turns up on a walk three days later. Unanswered ones expire silently and are
never stacked up or re-shown — five days away should not produce five sparks.

A spark is not a task. It's something you can carry on a walk and answer by voice in
thirty seconds.

### How a spark is built

One mechanism, not a menu of question shapes. The nine rotating types this
section used to describe are gone: each of them picked its own slice of the
corpus and asked the model to link two things, so the model always found a
link, and what it found was a resemblance dressed up as a thought ("you like
how Tame Impala treats synths — does the water scene do that too?"). Rotating
the type, the project and the motif made those collisions *varied*. It could
not make them *true*.

The replacement inverts it, the same way composites were fixed (joint → pair,
never pair → invented bridge):

1. **One subject, chosen by its shape in time.** Not "what's warm" — the
   session contract already answers that all day. A subject is a *temporal
   shape* (`corpus-time.ts`): said since March 2023 and never built; dropped
   for fourteen months and picked back up; a rhythm that stopped in a
   nameable month; one week two years ago and never again; two things
   captured days apart under different projects and never joined since. All
   computed from timestamps over the **whole** corpus, so the years are
   reachable and the facts are ones a model cannot invent. Span beats count:
   five fragments from one Tuesday is one thought, not a recurrence.
2. **Name the blind spot.** What does it take for granted and never examine?
   Not a missing next step — a step is work. The assumption underneath that
   would change what gets made if it were wrong.
3. **Strip the vocabulary and search that.** The blind spot is rewritten as a
   plain human question with none of the subject's own words in it, and *that*
   is what gets embedded and matched across everything the user has written or
   read. This is the load-bearing step. Search "how is replacing a character
   different from developing one" and the nearest hit is the chapter outline —
   the subject restated. Search "what it's like when someone you know becomes a
   different person" and it reaches the note about your dad's garden.
4. **Write the collision.** The connector was chosen *by* the blind spot, so
   there is nothing left to invent. The model quotes the note's own words and
   asks one question. It is not allowed to explain the link.

**Two model calls a run, and the run feeds the channel for about a week.**
The calls are the only real cost, so everything else is stacked around them:
one call names the blind spot for all three subjects at once, retrieval runs
three searches (the step most likely to come back empty, and the one that's
free to repeat), and one call writes up the best two pairs. The second question
is banked behind the first — it becomes the next standing question, and the
instant answer to "ask me something else", with no further calls. Silence now
means all three subjects found nothing, not one unlucky draw.

**Bands, not top hits** (`mull.ts`). A match above ~0.82 is the note restated
and worth nothing to think about; below ~0.45 it is noise. Inside the band, a
candidate sharing two distinctive words with the subject is thrown out however
well it scores — relevance comes from the vector, distance from the vocabulary.
That pairing is the whole mechanism.

**Tuned for resonance, not interest.** The question has to sit for three days
and end in something to make, so: it must land in the answerability band (too
easy is a quiz, gone in five seconds; too hard is a riddle, dismissed; right is
knowing you have the answer and not quite reaching it); it must be specific
enough to be *wrong*, since "no, it's not that at all" is a revelation too; it
must quote the user's own words rather than summarise them, because you can
dismiss the app and you can't dismiss yourself from eight months ago; and it
stops one step short — naming the project is the one move that guarantees the
user doesn't get there themselves. A **stake** is declared with every question
(what they'd *do* differently) and checked: no consequence, no background
cycles. The channel also learns from itself — the questions that got a real
voice answer, and the ones left to expire, go into the prompt as examples.

**Every gate is a rule, not a preference.** The quote has to actually appear in
the note (the Context Engine's invented article titles are what happens without
this); the question has to use it rather than append it; it has to end in a
question; it has to fit in sixty words; it may not contain "which mirrors",
"this connects to" or "both are about" — a real collision needs no connective
tissue, and explaining it is the tell that there was nothing there.

**Outside reach is not optional.** A corpus-only system can only recombine you
— sophisticated navel-gazing. It is no longer a separate type: articles are
eligible as the subject and as the connector, so reading enters through the
same door as everything else.

The one thing left that isn't a question: the **forgotten-project offer**
(`forgotten.ts`), which runs only when the channel has nothing. Its useful
answer is a tap, not words, so the attention slot renders it with an action.

### Rules

- Not always the live project. Sparking the non-live ones is the entire point.
- **Success metric: did you talk back.** Not did you agree. Store `spark_id`,
  `shown_at`, `answered_at`, `response_capture_id`.
- A spark that fills an empty slot fills it. That's how mull lowers MVS.
- Silence beats a weak spark, and it is now the common case: most nights at
  least one of the four steps declines. Nothing is a valid nightly output.

---

## How projects change

### Morph

Fragments accumulate; the project recomputes over them. Structure does the thinking,
the model writes the sentence.

- Cite or stay silent. The link is a quoted capture, never an invented causal story.
- **One morph per project per 14 days; one project per day; strongest evidence only.**
  Four projects changed overnight and you trust none of them. The rate limit is the product.
- A morph is a **proposal**, never a silent rewrite.
- One-tap *"that's not it"* — and that rejection is itself a capture.

### Negative signal

Captures must be able to **subtract**: close a slot, shrink scope, fork, or kill. A
system that only accretes turns forty projects into forty bloated ones.

### Drift, death, harvest

- Drift = distance between the project as written and the last 90 days of capture.
  High drift + adjacent chatter → reshape. High drift + silence → let it go.
- **Death is harvest.** A dead project releases its fragments — timber, collaborator, the
  one good constraint it found — back into the pool.
- Never ask the user to confirm a kill. It decays quietly.
- Voicings are never deleted. Only commitments are revocable.

### Composites

Two projects fuse when the corpus supplies the joint.

The current crossover goes *pair → link*: hand the model two projects and it must invent
a bridge, so it always does. That's where forced mashups come from. Invert it:

> **joint → pair.** *"Here's a thing you keep saying. Which two projects does it apply to?"*

The model's job shrinks from inventing a connection to applying a stated one, and a bad
output is visibly bad because the joint is a quote you can check.

Three conditions, all required:

1. The joint is quoted and has **recurred**. Once is a coincidence.
2. **Both projects are stalled** (as defined above). Fusing two healthy ones is a distraction.
3. The composite **inherits real material** from both — your timber, your deck dimensions
   — so it starts specified instead of at zero.

Prefer the **bridge object** (one small thing that unblocks two stalls) over the grand
fusion. Fusion is reversible: if the composite flops, both parents come back intact.

Best joints come from ideas that died — nothing was at stake when you said them, so
they're the purest taste signal you have.

---

## The mirror

Monthly. Hours in the chair, per project.

- **Zeros shown only for the live project.** "8 hours DJing, 0 on the book" is the nudge
  that flips you back. A full list of zeros is a guilt wall and gets the app closed.
- No streaks, no capture counts, no project counts, no completion percentages.

> **The only number the app ever shows is execution time.** Whatever you count is what
> you'll optimise, and counting captures turns you into a person who captures.

### Untracked hours — the honesty problem

Most execution will happen without the app open. A mirror that only counts in-app
sessions is a **lying** mirror, which is worse than none.

- **Retroactive logging by voice.** *"Did two hours on the decks last night"* is parsed
  into a session record. Must be as cheap as any other capture.
- **Once a month, at the mirror only:** *"This is what's logged. Anything missing?"*
  One voice reply fixes the month. Never asked at any other time — that would be a nag.
- The mirror is labelled **logged** hours, never "your hours". It doesn't claim to be truth.

## The different-thing quota

One hour a month on something you wouldn't usually do. The app asks you to book it.

Encouragement, never a debt. Doesn't roll over. Missing it is never mentioned. Exempt
from the live-project rule by definition. Focus without this collapses into a rut.

---

## The attention budget

Five things in this spec can want the screen on open: today's spark, a morph proposal,
a composite, the live-project re-ask, and the monthly mirror. Five surfaces competing
is how "guide, not menu" dies.

**At most one interruption per app open.** Fixed priority:

1. **A deferred close-out** — the missing input is worth more than anything the app can say.
2. **The monthly mirror** — once a month, on the first open of the month.
3. **The live-project re-ask** — only when the evidence rule above has fired.
4. **A composite** — rare by construction, so it rarely competes.
5. **A morph proposal.**
6. **Today's spark** — the default, and what you get on almost every open.

Anything that loses is not queued behind the winner. It waits for another day or is
dropped. A backlog of unshown prompts becomes a notification tray, which is the thing
this app exists not to be.

## Interaction rules

- **Voice and chat, never typing.** Typing a to-do list is the friction that kills it.
- **One statement, one action, one quiet redirect.** Never a question beside two buttons
  — accept-or-reject is still a decision, and a menu of three is the switching cost you
  were avoiding.
- Plain English throughout (`PLAIN_ENGLISH_RULES`). No analyst voice.

## Offline — extend, don't rebuild

Everything works offline: capture, timer, session list, close-out, today's spark.

The infrastructure exists. Reuse it:

- `src/lib/db.ts` — Dexie cache (projects, memories, pending captures)
- `src/lib/offlineQueue.ts` — operation queue with dead-letter
- `src/lib/syncManager.ts` — `syncPendingOperations`, `setupAutoSync`

Server-side, one new table (`migrations/`):

```
sessions
  id, user_id, project_id
  started_at, ended_at, duration_minutes
  window_minutes            -- what the user said they had
  items jsonb               -- the 1-3 shapes agreed
  closeout_text             -- the voice note, verbatim
  moved boolean             -- classified from closeout_text
  source                    -- 'live' | 'ondeck' | 'shelf' | 'different-thing' | 'retro'
  created_at
```

`source` is what makes the mirror and the re-ask rule computable, and `moved` is what
MVS is measured from.

Work needed:
- Add `sessions` and `sparkResponses` tables to the Dexie schema.
- Add session ops to `QueuedOperation['type']`.
- Cache tomorrow's spark on every sync. The next move needs no extra caching: it lives
  on the project (`metadata.next_move`), so a cold offline open already has it, and Go
  starts a local session that syncs later.

**Conflicts don't exist by design.** Sessions and captures are append-only, so offline
work merges without resolution. Keep it that way.

## Cost

- Sparks: **one batched nightly call**, not per-open.
- Joint mining: weekly.
- Morph proposals: already rate-limited (one project/day).
- Cap thinking (`thinkingFragment()`) on classification, role-tagging, slot-matching.
  Never cap spark prose or morph prose — that's the creative surface.

---

## Never do

- Show time-since-last-touched as a number. "3 months" is an accusation.
- Use *should*, *still*, *overdue*, *haven't*.
- Ask the user to justify a gap.
- Score a raw capture, or show confidence numbers on capture.
- Show a graveyard, or a count of anything that isn't hours.
- Propose a move without a visible "Done when".
- Argue with a stated preference.

**Under-reach when unsure.** Too small is recoverable — you keep going and feel ahead.
Too big means stopping mid-thing and feeling behind. One oversized proposal costs more
than ten good ones earn.

---

## What this rebuild removes

"Rebuild, don't bolt on." So this is explicit about what stops existing:

**Replaced** — `ReviewRotation` and `FocusChat` (as separate components): their
jobs are absorbed by the session contract and the spark channel, and both are
gone from the codebase.

**Rebuilt in place, not replaced** — `TodaysAnswerCard` (became the session
contract under the same name), `EverythingElseMini`, `FeelingPill`. All still
exist and are still mounted on home.

**Kept, on reflection** — `ThoughtOfTheDay`. An earlier cut of this rebuild
removed it as "the spark channel already does quotes from your past," and
that reasoning was wrong: a spark asks something and wants a voice answer
back; this shows something you said and asks nothing. Different job, and it's
the page's closer, not a competing interruption. Component was reinstated —
see `HomePage.tsx`.

**Not yet retired despite the plan below** — `ProjectIdeasHome` (READ/CROSSOVER).
This doc calls for the idea generator to become joints and composites, but
`ProjectIdeasHome` is still live in `TodaysAnswerCard`'s redirect panel and
`EverythingElseMini`, and there is currently no on-demand replacement for
it — sparks are baked nightly cron-only, morphs and composites are rate-limited
proposals, not an instant "give me a new idea now" button. Retiring it means
either accepting the loss of on-demand generation or building an on-demand
path into the spark/morph/composite system first. Undecided; don't remove it
without that decision being made explicitly.

**Retired** — Fix Queue (cron already off), Power Hour, cognitive replay, the Context
Engine sidebar.

**Kept as-is, outside this rebuild** — bedtime prompts. Different job (priming
overnight thinking before sleep, not daytime execution) and the owner still wants it.
Leave `BedtimeFloatingIcon`, `BedtimePage`, and the bedtime cron path untouched.

**Kept and reused** — capture and transcription, embeddings, project labels, lists and
reading (the identity layer, and the bridge for outside-reach sparks), the offline stack,
`plain-english.ts`, `models.ts`.

**Rebuilt on new foundations** — the idea generator becomes joints and composites;
the review rotation becomes the live-project re-ask.

---

## Build order

1. **Session contract** — first-run declaration, window, 1–3 list, timer up, close-out
   (including the deferred close-out at next open). Offline-first. Nothing else works
   without `last_stopped_at`, and this alone has to be worth opening the app for.
   **Migration:** all existing projects default to `state = 'mull'`. `is_priority`
   is not auto-mapped to `live` — the user makes a fresh declaration on first run,
   per "the app never picks it." Old projects don't need to feel pre-sorted; the
   whole point is a clean re-entry into the new model.
2. **Retroactive logging + the mirror** — early, because it's the only honest scoreboard
   and it needs months of data before it says anything.
3. **Session shapes + MVS** — derivation, seeding question, measured replacement, booking
   flow when MVS exceeds real windows.
4. **Spark channel** — nightly bake, blind spot → search → collision, talk-back tracking.
5. **Slots and fragments** — roles at capture, empty slots as the dormancy model.
6. **Morph, drift, harvest** — rate-limited proposals, cite-or-silent.
7. **Joints and composites** — mine recurring joints, invert crossover to joint → pair.

The attention budget is enforced from step 1 and re-checked at every step that adds a
surface. It is the thing that quietly rots as features land.

---

## Known risks

- **Mulling becomes the product.** Sparks feel like insight, thinking feels like progress,
  and the corpus grows whether or not anything ships. Execution hours are the only defence.
- **The closed loop.** Without outside-reach sparks, this recombines you forever.
- **A wrong answer in a rare hour** is worse than no answer — you argue with it and lose
  ten minutes anyway. Low confidence → name the warm project and where you stopped, nothing more.
- **It becomes a timer app.** In v1 the session contract is most of the product, and the
  phone already has a timer that takes one tap. The moat is the re-entry playback and the
  decomposition into a finishable list. If those are mediocre, nothing else gets a chance.
- **The mirror says nothing for two months.** It needs data before it's a mirror, so v1's
  value has to come entirely from the session contract. Build the logging early, expect
  the payoff late.
- **Optimising the joy out.** Sometimes the point of the hour is to noodle. There must be
  a path that produces nothing and isn't treated as a miss.
