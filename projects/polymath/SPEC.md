# Aperture — execution spec

> This is a **rebuild** spec, not a feature list. It replaces the home surface and
> the model of what a project is. `WHY.md` is still the thesis; this is the machine.

---

## The thesis, short

Thinking time is unlimited. Execution time is scarce, unpredictable, and the
only thing that produces anything.

So: capture without limit, think across everything, but execute on one thing at
a time — and spend zero of the scarce hour deciding what to do.

An aperture gathers wide and focuses to a point. That's the mechanism, not the name.

---

## The finding this is built around

> *"I just prefer DJing at the moment, and the book I need 2 hours for, and I'd rather DJ."*

The book isn't blocked by willpower. It's blocked by **minimum session size**.
It needs two hours; two-hour blocks don't occur naturally; so it never happens.

And part of why it needs two hours is that it's always cold — a big chunk of that
block is re-entry. Keep it warm between sessions and the same work fits in 75 minutes.

That gives the mull channel a hard job, not a soft one: **mull exists to lower the
minimum session size of the things you can't currently start.**

Two consequences:

1. Every project carries a **minimum viable session** (MVS) and it's tracked, not guessed.
2. When a project's MVS is bigger than the windows you actually get, the app stops
   suggesting it and offers to **book** it instead. Some work has to be scheduled with
   the household, not waited for.

---

## Two channels

Split the portfolio by which currency it spends, not by priority.

| | Execution channel | Mull channel |
|---|---|---|
| Currency | Scarce hours | Free thinking time |
| Size | **One live project.** One on deck. | Everything else. No limit. |
| Feels like | A contract | A conversation |
| Cost of adding one | High | Zero |

Moving a project out of execution is not failure — it's "in mull right now."
The app can say that out loud: *"The book's not in play. It's still here."*

---

## Objects

**Voicing** — any capture. Never limited, never scored, never deleted, never shown
a status. This is the thing YC protects by not giving out office space: the utterance
is free, the commitment is not.

**Project** — a creative goal with a defined output. Carries:
- `tags` (labels, existing mechanism)
- `mvs_minutes` — minimum viable session, learned from real sessions
- `session_shapes[]` — real pieces of work at 20 / 60 / 120 min, each with its own finish line
- `slots[]` — named gaps (sound, venue, first track, material, deadline, collaborator).
  An empty slot is what dormancy actually is.
- `state` — live / on-deck / mull / harvested
- `last_stopped_at` — your own words from the end of the last session

**Fragment** — a voicing attached to a project with a **role**: reference, constraint,
material, deadline, obstacle, collaborator. Roles are what make accumulation useful.
A project with three references and no deadline behaves differently from the reverse.

**Joint** — a thing you've said more than once that applies across projects.
*"Contrast between clean and raw."* Corpus-derived, quoted, never invented.

**Session** — a contract. Window, list, timer, close.

---

## The session

### Opening (target: two minutes)

1. **Re-entry first.** It plays back where you got to — your own words from last time.
   Fastest possible warm-up, and the reason a cold project costs double.
2. **It states one guess**, not a menu. *"DJing. You said you wanted the transition
   out of track two working."*
3. **It asks the one thing it can't know:** how long have you got.
4. You talk at it for ten seconds. It adjusts.
5. **Contract:** *55 minutes. Here's what done looks like.* Both sides bound — its
   obligation is not to exceed the window, yours is to start.

You declare the live project explicitly. The app never picks it. It re-asks at
intervals ("still DJing?") so the declaration stays current without being a chore.

### The list

1–3 items. Never four — four is a chore list. First item deliberately small; it
exists to get you moving, not to be accurate. Generated, then shaped by voice.
**You never type a to-do list.**

### The timer

- Counts **up** by default. Counts down only when you named a hard stop.
- Never interrupts, never nags, no progress bar.
- Stopping is one tap and is always fine.
- Elapsed minutes per project is the only number the system truly needs.

### Closing — the highest-value input in the system

Timer stops → one question → thirty seconds of voice. *"Where'd you get to?"*

It is the only input recorded while the context is still in your head. It sets
`last_stopped_at`, feeds the corpus, and makes the next session a two-minute start.

**Never say "incomplete."** 22 minutes with item one done is a good session. The
framing decides whether the app gets opened next week.

### Overrides

Saturday-you wins, always. No confirmation, no "are you sure."

But the switch must be as fast as the default — the runner-up is warm too, with its
own first move and finish line. If honesty is slower than compliance, you'll stop
being honest.

The one thing the app may say, **once, as a fact and not a question**:
*"Book's one session from done."* You can ignore a fact. A question demands an answer.

Bad sessions are accepted instantly and are high-value data — they say which
conditions don't work.

---

## The mull channel

One spark, on app open. **No push notifications** — the spark is the reward for
opening the app, which is what builds the habit.

A spark is not a task. It's something you can carry on a walk and answer by voice in
thirty seconds.

### Spark types

Rotate across **types**, not just projects. Never the same type twice running.

| Type | Shape | Example |
|---|---|---|
| Noticing | An observation, no question | *"The Four Tet track — drums don't come in for 90 seconds."* |
| Transferred constraint | Import a rule across domains | *"That set worked on three sounds. What's the chapter with three scenes?"* |
| Unfinished thought | Your own, played back | *"You said the second half doesn't earn its ending. You never said what you meant."* |
| Contradiction | Two of your statements, side by side, unresolved | *"You want it quiet. You also say nothing happens in chapter 3."* |
| Scale jump | Same project, wrong altitude on purpose | *"Forget the chapter — what's the book about in one sentence, today?"* |
| Material fact | Concrete, available | *"Offcuts are still there and the saw's out."* |
| **Outside reach** | Something not from your corpus | A technique from a discipline you don't practise |

**The outside-reach type is not optional.** A corpus-only system can only recombine
you — sophisticated navel-gazing. If the aperture is meant to widen, something has to
come in that you didn't put there. Reading queue and RSS are the existing bridge.

### Rules

- Not always the live project. Sparking the non-live ones is the entire point.
- **Success metric: did you talk back.** Not did you agree. A spark that produces
  forty seconds of voice worked. One you scrolled past didn't. That's the training signal.
- A spark answering a project's empty slot fills it. That's how mull lowers MVS.
- Silence beats a weak spark. Nothing is a valid output.

---

## How projects change

### Morph

A project is not a static description. Fragments accumulate; the project recomputes
over them. The model writes the sentence, the structure does the thinking.

- Cite or stay silent. The link is a quoted capture, never an invented causal story.
- **One morph per project per 14 days, one project per day, strongest evidence only.**
  Four projects changed overnight and you trust none of them. The rate limit is the product.
- A morph is a **proposal** on the review card, never a silent rewrite.
- Every morph has a one-tap *"that's not it"* — and that rejection is itself a capture.

### Negative signal

Captures must be able to **subtract**: close a slot, shrink scope, fork, or kill.
A system that only accretes turns forty projects into forty bloated ones.

### Drift and death

- Drift = distance between the project as written and your last 90 days of capture.
  High drift + adjacent chatter → reshape. High drift + silence → let it go.
- **Death is harvest, not deletion.** A dead project releases its fragments — timber,
  collaborator, the one good constraint it found — back into the pool for everything else.
- The user is never asked to confirm a kill. It decays quietly.
- Voicings are never deleted. Only commitments are revocable.

### Composites

Two projects fuse when the corpus supplies the joint.

The current crossover goes *pair → link*: hand the model two projects, it must invent a
bridge, so it always does. That's where forced mashups come from. Invert it:

> **joint → pair.** "Here's a thing you keep saying. Which two projects does it apply to?"

The model's job shrinks from inventing a connection to applying a stated one, and a bad
output is visibly bad because the joint is a quote you can check.

Three conditions, all required:

1. The joint is quoted and has **recurred**. Once is a coincidence.
2. **Both projects are stalled.** Fusing two healthy ones is a distraction.
3. The composite **inherits real material** from both — your timber, your deck
   dimensions — so it starts specified instead of at zero.

Prefer the **bridge object** (one small thing that unblocks two stalls) over the grand
fusion. Fusion must be reversible: if the composite flops, both parents come back intact.

Best joints come from ideas that died. Nothing was at stake when you said them, so
they're the purest taste signal you have.

---

## The mirror

Monthly. Hours in the chair, per project.

- **Zeros shown only for the priority project.** "8 hours DJing, 0 on the book" is the
  nudge that flips you back. A full list of zeros is a guilt wall and gets the app closed.
- No streaks, no capture counts, no project counts, no completion percentages.

> **The only number the app ever shows is execution time.** Whatever you count is what
> you'll optimise, and counting captures turns you into a person who captures.

## The different-thing quota

One hour a month on something you wouldn't usually do. The app asks you to book it.

Framed as encouragement, never as a debt. It does not roll over, and missing it is
never mentioned. Focus without this collapses into a rut; new skills only come from
the edges.

---

## Interaction rules

- **Voice and chat, never typing.** Typing a to-do list is the friction that kills it.
- **Everything works offline.** Capture, timer, session list, close-out. Sync later.
  Sessions happen in sheds, at decks, on walks.
- One statement, one action, one quiet redirect. Never a question next to two buttons —
  accept-or-reject is still a decision, and a menu of three is the switching cost you
  were trying to avoid.
- Plain English throughout (`PLAIN_ENGLISH_RULES`). No analyst voice.

## Never do

- Show time-since-last-touched as a number. "3 months" is an accusation.
- Use *should*, *still*, *overdue*, *haven't*.
- Ask the user to justify a gap.
- Score a raw capture, or show confidence numbers on capture.
- Show a graveyard, or a count of anything that isn't hours.
- Propose work without a visible finish line inside the stated window.
- Argue with a stated preference.

**Under-reach when unsure.** Too small is recoverable — you keep going and feel ahead.
Too big means you stop mid-thing and feel behind. One oversized proposal costs more
than ten good ones earn.

---

## Build order

1. **Session contract** — declare live project, window, 1–3 list, timer up, close capture.
   Offline-first. Nothing else works without `last_stopped_at`.
2. **Session shapes + MVS** — real 20/60/120 pieces per project; learn MVS from actuals;
   booking flow when MVS exceeds the windows you get.
3. **Spark channel** — types, rotation, no-repeat rule, talk-back metric. On app open only.
4. **Mirror + quota** — monthly hours, zeros for priority only, the different-thing hour.
5. **Slots and fragments** — roles on capture, empty slots as the dormancy model.
6. **Morph, drift, harvest** — rate-limited proposals, cite-or-silent.
7. **Joints and composites** — mine recurring joints, invert crossover to joint → pair.

---

## Known risks

- **Mulling becomes the product.** Sparks feel like insight, thinking feels like progress,
  and the corpus grows whether or not anything ships. Execution hours are the only defence.
- **The closed loop.** Without the outside-reach spark, this recombines you forever.
- **Wrong answer in a rare hour** is worse than no answer — you argue with it and lose ten
  minutes anyway. Low confidence → just name the warm project and where you stopped.
- **Optimising the joy out.** Sometimes the point of the hour is to noodle. There must be a
  path that produces nothing and isn't treated as a miss.

## Open questions

- Does the live-project re-ask have a natural cadence, or does it ride the weekly review?
- Where does a "booked" 2-hour block live — real calendar, or inside the app?
- How is MVS seeded before there's session history to learn from?
