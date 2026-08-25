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
- `session_shapes[]` — derived, never authored (see below)
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

**Session** — a contract: window, list, timer, close-out. Append-only.

### Stalled (defined, because composites gate on it)

A project is **stalled** when it has no logged session in 6 weeks **and** at least one
empty slot. Time alone isn't stall — a finished-shaped project sitting quietly is fine.

---

## The session

### Opening (target: two minutes)

1. **Re-entry first.** Play back `last_stopped_at` — your own words. Fastest warm-up
   there is, and the reason a cold project costs double.
2. **One guess, not a menu.** *"DJing. You wanted the transition out of track two."*
3. **Ask the one thing it can't know:** how long have you got.
4. You talk at it for ten seconds. It adjusts.
5. **Contract:** *55 minutes. Here's what done looks like.* Its obligation is not to
   exceed the window; yours is to start.

### First run — session one has no history

`WHY.md` sets the rule: **pay the user back in the session they captured in, or fail.**
The session contract must clear that bar on day one, with no `last_stopped_at`, no
shapes and no spark.

So session one is a declaration session:
1. *"What do you want to be working on?"* — voice. That sets the live project.
2. *"What do you want out of it?"* — voice.
3. *"How long have you got?"*

The payoff is immediate and is the same mechanism as every later session:
**it turns what you just said into 1–3 items with a finish line inside your window.**
Decomposition is the value, not history. History makes it faster, not real.

### Where session shapes come from (derived, never authored)

You never write a to-do list. Shapes are derived, in this order of preference:

1. **The last close-out.** "What's next" from the previous session *is* the next shape.
   This is the primary source and why close-out is non-negotiable.
2. **Empty slots.** No first track → *"find one"* is a real 20-minute shape.
3. **Decomposition**, only when the window is smaller than MVS: split the stated next
   move into a piece that fits, and say plainly that it isn't the whole thing.

A brand-new project has no shapes, so its first session is always a *start it* shape.

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

### The list

1–3 items. Never four — four is a chore list. The first item is deliberately small; it
exists to get you moving, not to be accurate. Proposed, then shaped by voice.

### The timer

- Counts **up** by default. Counts down only when you named a hard stop.
- Never interrupts, never nags, no progress bar.
- Stopping is one tap and is always fine.

### Closing — the highest-value input in the system

Timer stops → one question → thirty seconds of voice.

- Normal: *"Where'd you get to?"*
- After a short or abandoned session: *"What got in the way?"* — a bad session is data
  about conditions, and the wrong question there gets no answer.

It sets `last_stopped_at`, feeds the corpus, and makes the next session a two-minute start.

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

**Shelf life.** Only ever today's spark. Unanswered ones expire silently and are never
stacked up or re-shown — five days away should not produce five sparks. Material-fact
sparks (*"the saw's still out"*) expire after 48 hours because they make a claim about
the physical world that goes stale.

A spark is not a task. It's something you can carry on a walk and answer by voice in
thirty seconds.

### Spark types

Rotate across **types**, not just projects. Never the same type twice running.

| Type | Shape | Example |
|---|---|---|
| Noticing | An observation, no question | *"The Four Tet track — drums don't come in for 90 seconds."* |
| Transferred constraint | A rule imported across domains | *"That set worked on three sounds. What's the chapter with three scenes?"* |
| Unfinished thought | Your own, played back | *"You said the second half doesn't earn its ending. You never said what you meant."* |
| Contradiction | Two of your statements, side by side, unresolved | *"You want it quiet. You also say nothing happens in chapter 3."* |
| Scale jump | Same project, wrong altitude on purpose | *"Forget the chapter — what's the book about in one sentence, today?"* |
| Material fact | Concrete, available | *"Offcuts are still there and the saw's out."* |
| **Outside reach** | Something not from your corpus | A technique from a discipline you don't practise |

**Outside reach is not optional.** A corpus-only system can only recombine you —
sophisticated navel-gazing. If the aperture is meant to widen, something has to come in
that you didn't put there. Reading queue and RSS are the existing bridge.

### Rules

- Not always the live project. Sparking the non-live ones is the entire point.
- **Success metric: did you talk back.** Not did you agree. Store `spark_id`,
  `shown_at`, `answered_at`, `response_capture_id`. Rolling answer-rate per type weights
  type selection. Simple bandit, no ML.
- A spark that fills an empty slot fills it. That's how mull lowers MVS.
- Silence beats a weak spark. Nothing is a valid nightly output.

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
- Cache tomorrow's spark and the live project's shapes on every sync, so a cold offline
  open still has a warm project and a spark.

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
- Propose work without a visible finish line inside the stated window.
- Argue with a stated preference.

**Under-reach when unsure.** Too small is recoverable — you keep going and feel ahead.
Too big means stopping mid-thing and feeling behind. One oversized proposal costs more
than ten good ones earn.

---

## What this rebuild removes

"Rebuild, don't bolt on." So this is explicit about what stops existing:

**Replaced** — the whole home surface: `TodaysAnswerCard`, `EverythingElseMini`,
`ReviewRotation`, `ProjectIdeasHome`, `FocusChat`, `ThoughtOfTheDay`, `FeelingPill`.
Their jobs are absorbed by the session contract and the spark channel.

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
4. **Spark channel** — nightly bake, types, no-repeat rule, talk-back tracking.
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
