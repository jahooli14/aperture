# Polymath — distil and simplify (overnight plan, 1 Oct 2026)

Nothing has been changed or pushed. This is the plan. Three decisions at the bottom need you.

---

## 1. What's happening in your screenshot

That's the **Guide** on the project page (`InlineGuide.tsx` → `api/brainstorm.ts`). Three separate faults:

- **The grey chips are random.** After every reply, the app vector-searches *your last message* ("I did that") and shows the top titles. "I did that" means nothing on its own, so you get willow blocks and GarageBand under a book. They're not grounded, not useful, and not clickable to anything that matters.
- **The Guide doesn't know about the move.** The move ("paste section one into Claude") lives in `metadata.next_move`. The Guide works on the old task list (`metadata.tasks`) — the model SPEC.md retired. So "I did that" ticks nothing and writes no next move. It just chats.
- **"The whole book is done" got a made-up next step.** Finishing the book is the biggest event the app can hear. It should have said "that's it finished" and offered to mark it done. Instead it invented "literary agents" — nothing you've said.

Also: "done when" is peeking out under the nav bar — the session card sits behind it.

These aren't three bugs. They're one: **two engines answer "what next?" on the same page, and they don't share state.**

---

## 2. The real problem: about twenty voices

The corpus is good. But it's piped into roughly twenty separate places that each speak to you, each with its own prompt, cron, gate and UI:

| Where | Things that talk to you |
|---|---|
| Home | the move, Focus chat, ideas deck (READ + CROSSOVER, 4 sub-modes), today's spark, feeling pill, attention slot (close-out / mirror / re-ask / composite / morph / outside find / different-thing), "suggest a project" card, thought of the day, bedtime |
| Project page | Guide chat, session card, next-move panel, old step list, arc verdict, finish line, made wall, blocker, notes, lineage / "sparked by", completion ritual |
| Elsewhere | stuck move, hand-off, article gist, insight strip, drawer digest, onboarding chat, idea-engine email |

Each one is reasonable alone. Together you can't tell which one to listen to — and in your screenshot two of them disagree on the same screen.

The git log says the same thing: ~100 Polymath commits since August, over half of them `fix`. Most effort goes into keeping many generators honest, not into one being great.

---

## 3. The distilled app

**One sentence:** *Polymath turns what you capture into the next thing you make.*

**Three verbs, one surface each:**

1. **Capture** — voice note, list item, reading vote. Unchanged. This is already good.
2. **Notice** — **one question a day** (the spark). The only place the corpus talks back unprompted. Your answer can become a move on a project, or a new project. That's it.
3. **Make** — **one live project, one move.** Go → work → "where'd you get to?" → next move. The project page is the move, a log of what's done, and what you made.

Everything the corpus does should end on one of those two cards — the question or the move. If it can't, it goes.

### What that means for each piece

**Merge into the move (one "what next" engine — `next-move.ts`)**
- **Guide chat → becomes "talk to the move".** Same text box, but every reply goes through `resource=move&say`. "I did that" ticks the move and writes the next. "The whole book is done" marks it done (or closes a cycle). No task-list audits, no chips.
- **Focus chat on home** → same thing, for the live project. Delete the separate component.
- **Stuck move, hand-off, arc verdict** → already parts of the move flow. Keep, but show the arc as one line on the card, not a section.
- **Old step list (`ProjectPath`)** → hide entirely. The writer can still read it.

**Merge into the question (one "what's worth making" engine — the mull pipeline)**
- **Morphs, composites, the ideas deck, the outside find** are all "the corpus proposes something". Four pipelines, four crons, four UIs. Make them shapes the spark drafter can return: *a question*, *a reshape of project X*, *a new project from A + B*. One gate, one judge, one slot.
- "Ask me something else" stays the on-demand button. That solves the reason the ideas deck was kept (it's the only on-demand generator) — the spark reroll becomes it.

**Cut from the screen** (code can stay until you're sure)
- Feeling pill, different-thing nudge, insight strip, drawer digest, lineage / "sparked by", `/timeline`, `/replay`, `/fixes`, `/favourites`.
- The attention slot shrinks to two things: a missed close-out, and the monthly mirror.

**Keep as-is**
- Capture, lists, reading + the vote, the gist, made wall, notes, the mirror, bedtime (you want it), idea-engine email (not Polymath).

### Home after

1. The move (live project) — Go.
2. Today's question — answer by voice, or "ask me something else".
3. Other projects — one row.
4. Now consuming.

Four sections. Thought of the day is the open question (see decisions).

### Project page after

1. The move — Go, or talk to it.
2. What you've done (the log) + the one arc line.
3. What you made.
4. Notes.

Four sections, down from eleven.

---

## 4. Order of work

Each step ships alone and leaves the app working.

1. **Fix the Guide** (small, tonight-sized). Remove the chips. Route its replies through the move so "I did that" and "it's done" actually change the project. Fix the nav overlap. This alone makes the screenshot make sense.
2. **Delete dead code.** 23 components nothing imports — I tried to delete them overnight and the sandbox blocked it, so it needs your OK:
   `ui/{tooltip,badge,progressive-loading,premium-section,skeleton,select}`, `projects/{ProjectListRow,ProjectPickerDialog,ProjectLineage,PinnedTaskList,ProjectCarousel,ProjectProperties,SpotlightCard}`, `PWAUpdateNotification`, `PageHeader`, `SwipeableCard`, `SmartActionDot`, `connections/ConnectionsList`, `memories/ThemeEditor`, `onboarding/{EmptyState,WelcomeModal,FoundationalPrompts,DemoDataBanner}`.
3. **Trim the project page** to the four sections above.
4. **Trim home** to four sections; Focus chat goes.
5. **Fold morph / composite / ideas deck / outside find into the spark drafter.** Biggest step. Do it last, once 1–4 have shown the simpler shape is right.
6. **Rewrite CLAUDE.md and SPEC.md** to match — they're long because the app is. Target: half the length.

---

## 4b. Two targets, two channels

The app has two jobs, and they pull in opposite directions:

| | Make more (creativity) | Think new things (original thought) |
|---|---|---|
| What blocks it | Re-entry cost. Two-hour sessions that never happen. | Recombining what you already think. Taking the first answer. Hearing only yourself. |
| Shape of the work | Narrow: one project, one move | Wide: everything, wandering |
| When it happens | The scarce hour | Walks, bed, reading — unlimited |
| App surface | The move | The question |
| Honest measure | Hours, things made | Things you said that you'd never said before |

SPEC.md already has two channels (execution / mull). These ARE the two targets. Keep them apart in time — never ask the hour to wander, never ask the walk to converge — and join them at one point only: **an original thought counts when it becomes a move.** Otherwise mulling becomes the product.

**The rule for target two: the app asks, you think.** If the app has the idea, it isn't your original thought. Test for every feature: *who had the idea?*
- Fails: the idea cards (READ / CROSSOVER) — the model proposes projects. Morphs and mash-ups when they hand you the answer. The Guide inventing "literary agents".
- Passes: the question, the follow-up, the close-out prompt, bedtime.

This settles decision 2 below: the idea cards go.

**What would actually drive original thought**
1. **Measure it, privately.** Today the question's success is "did you answer". Better: did your answer say something new — far from your nearest past capture in the vector space, and not a restatement of the question. Feed the new ones to the drafter as examples of what works. Never show the number (the only number on screen stays hours).
2. **Push past the first answer.** The first answer is the common one. Add a third follow-up reason beside `correction` and `next_step`: `push` — "that's the obvious answer; what's the one you'd be embarrassed to say?" Still two turns, never more.
3. **Let something in from outside.** Everything recombines your own corpus — SPEC calls this the closed loop. Some questions should collide your words with something you haven't said or read: the weekly outside find, an unread list item, or the Idea Engine's frontier ideas (today an island that never touches your thoughts).
4. **Give it a night.** Bedtime is a second question generator with its own four types, scoring and feedback loop. Make bedtime *the same question* (or its banked sibling) instead: sleep on it, answer it in the morning note. One generator, and incubation built in.
5. **Show your own originals back.** Thought of the day picks a random resurfaced note. Make it the most original thing you've said — a note far from everything else in the corpus. That gives it a real job and keeps it (decision 3).

**What drives making (target one)** — mostly already built: one move, Go, close-out. One addition: the close-out's *"what's bugging you"* is the best seed for a question, since friction during making is where new thoughts start. Have the drafter weight it first.

**The loop between them:** making produces friction → friction seeds a question → the answer is a new thought → the new thought becomes a move → making.

---

## 5. Decisions only you can make

1. **Guide: merge into the move, or delete it?** Merge keeps "talk to your project" but on the right engine. Delete is simpler — the move card already has "not this" and a say-box. *I'd merge.*
2. **Ideas deck: OK to replace with the spark reroll?** CLAUDE.md says don't remove it without your call. This is that call.
3. **Thought of the day: keep?** It's a closer that asks nothing. Nice, but it's one more voice. *I'd cut it once the spark is reliably good.*

Say "go on 1 and 2" (or whatever) and I'll start with step 1.
