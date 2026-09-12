# The agent system

Reverse-engineered from `corpus/` — 200 notes, six months, one boutique advisory. Every
component below exists because a specific finding in `eval/answer-key.md` cannot be
produced without it. Nothing here is included because it sounded good.

---

## What the corpus forced

Six things became non-negotiable once there were real notes to run against.

**1. One prompt cannot do this.** The ten findings need six structurally different
queries. Convergence (F1) looks for agreement; contradiction (F3) looks for the same
subject with opposite polarity; "what stopped" (F5) is a diff between two time windows
with nothing to retrieve; the dot-join (F6) is a match between two *kinds* of statement.
A single "find interesting patterns in my notes" prompt returns F1, occasionally, and
never returns the other nine.

**2. The rolling window has to be two windows.** F2 spans 164 days. Anything running on
eight weeks of notes sees two of its four mentions and stays silent forever. So: a fast
weekly pass over ~8 weeks, and a slow monthly pass over everything. The slow pass is where
the best finding lives, because the findings that take five months to assemble are exactly
the ones she cannot hold in her head.

**3. Count organisations, not mentions.** The single loudest topic in the corpus is
Aldgate & Vane's system migration — four notes, two people, one building (T2). Meanwhile
F1 is five organisations that never repeat a phrase. Mention-counting inverts the ranking
completely.

**4. The same word is not the same subject.** Three people say "AI" in four weeks and mean
a vendor complaint, an operations build, and a claims product (T1). Clusters need
disambiguating on what the claim is *about*, not what it contains.

**5. Structure has to be captured per note, not searched for later.** F6 is a problem
stated in March and a capability stated in August, sharing almost no vocabulary — "battery
storage" against "BESS". No similarity search over raw notes finds that pair. It is only
findable if each note was already labelled *who has a problem* and *who has a capability*
at the time it was written.

**6. Most notes are nothing.** About 70 of the 200 are expenses, parking fines, cancelled
lunches and `-`. They should be filtered once, cheaply, and never reach a detector.

---

## Layer 1 — Extract (per note, once, at capture)

The layer everyone skips, and the one that makes the rest possible. Each note becomes:

```
date
orgs[]            resolved to canonical id, not the string in the note
people[]          resolved id + name + role + org AS AT THIS DATE
has_signal        false for the ~35% that are admin — these stop here
claims[]
  quote           verbatim, as written, never paraphrased
  speaker         person id
  type            problem | capability | opinion | fact | commitment | admin
  subject         normalised topic, chosen from existing subjects where one fits
  stance          for | against | neutral — only meaningful on opinions
  strength        stated directly | mentioned in passing | second-hand
commitments[]     who owes what to whom, and whether a later note closes it
```

Four things this layer must get right:

**Verbatim quotes.** Her paraphrase is the enemy. If the extractor rewrites "forty binders
and three people" as "concerns about delegated authority capacity", F1 dies — every quote
collapses into the same house style and the pattern disappears into the summary. Store what
was said.

**People, not names.** `Fern Achebe` is Head of Cyber at Thackeray in March and CUO at
Bellwether in September (F7). `Priya Raman` appears as `P Raman` and `Priya`. Resolve to a
person with a role *history*, or F2 splits into two half-patterns that each fall below
threshold.

**Subject reuse over subject invention.** Hand the model the existing subject list and tell
it to prefer a match. Free-text subjects rot into forty singletons that cluster nothing —
this is the same failure as free-text tags anywhere else.

**Strength.** "Overheard at lunch, didn't join in" (17 Apr) is not evidence. T3 depends on
it: the cyber hiring shortage looks like four mentions and is one named org plus a corridor
conversation. Without a strength field the system cannot tell the difference.

Cost: one pass per note, ~200 calls for the back catalogue, then a handful a day. Idempotent
— safe to re-run.

---

## Layer 2 — Six detectors

Each is a separate scheduled job with its own threshold and its own silence condition.

### D1 · Convergence — *what are several unconnected people saying?*
**Produces F1.** Clusters claims by subject, then requires **≥3 independent organisations**
and at least two rated *stated directly*. Runs twice: weekly over 8 weeks, monthly over the
full corpus. The monthly pass is what catches F2.

Guards: organisation count, not mention count (kills T2). Same-subject not same-word (kills
T1). Below three orgs it says nothing — never "a possible emerging theme".

### D2 · Contradiction — *who disagrees with whom, and neither knows?*
**Produces F3.** Same subject, opposed stance, both rated *stated directly*, both senior.
Rare by design — one or two a quarter. The most valuable single output per unit of volume,
because it is the only thing on this list she genuinely cannot get anywhere else.

### D3 · First voice — *who called this before everyone else?*
**Produces F4.** Takes a D1 cluster, orders it by date, and reports the gap. Fires when the
earliest claim leads the next by 30+ days and the later speakers don't cite the first.
Output names a *person*, not a topic: "Klaus Beringer said this in April; four people have
since said it back to you in their own words."

This one changes her behaviour more than any other — it tells her whose call to weight.

### D4 · What stopped — *what has gone quiet?*
**Produces F5.** Quarter-over-quarter subject frequency diff. Fires on a subject with 4+
mentions across 3+ orgs in one window and zero in the next. Structurally a comparison, not
a search — nothing in the corpus states this and no retrieval will find it.

### D5 · Problem ↔ capability — *the dot-join*
**Produces F6, F7, F10. The reason to build any of this.**

Maintains two live registers from Layer 1: open **problems** (who needs something) and open
**capabilities** (who can do something). On every new note, match the new side against the
full standing register on the other — whole corpus, no window, because F6's two halves are
148 days apart.

**Event-driven, not scheduled.** A capability landing on 19 August against a problem with a
1 October renewal is worth days. Weekly batching nearly cost this one.

Vacancies and departures are the same shape: a job opening is a problem, a senior person
leaving is a capability. That's F7 for free — one MGA hiring a CUO in May, one senior
underwriter leaving in June, same detector, flagged in June instead of learned from a press
release in August.

Match on the described need, not on vocabulary. "Nobody will write my battery storage" and
"we're opening a BESS book and don't know who the buyers are" share almost no words and are
the same finding.

### D6 · Open loops — *what did you promise, and who's gone quiet?*
**Produces F8, F9.** Two passes over the commitments register: promises made and not closed,
and organisations with an open thread and no contact in 60+ days. Weekly.

The dormancy half must say *what was left open*, not just count days. "Yusuf raised a
retainer on 29 April and you said you'd come back to him" is actionable; "no contact in 135
days" is a CRM field.

---

## Layer 3 — Delivery

Three channels, deliberately few.

**Monday digest** — whatever D1/D2/D3/D4/D6 produced. Typically two or three items, often
none. Format per item: one line naming the finding, the quotes with names and dates, one
line on what is now possible. No analysis paragraph.

**Dot-join alert** — D5 only, sent when it fires. The only interrupt, because it is the only
time-sensitive output.

**Meeting prep, three days ahead** — the briefing, plus one question to carry around. The
question is *drawn from standing findings that touch this organisation*, never generated
fresh for the meeting. That's the change the corpus argues for: per-meeting question
generation has nothing to work from and invents; pattern-first generation has F1–F10 to draw
on and only has to choose.

If nothing touches the org, the briefing goes out without a question. Most meetings don't
deserve one.

### Worked example — from `calendar.md`, delivered Monday 14 September

> **Tue 15 Sep · Marcus Deyn, Ravensbourne**
> Last seen 12 Aug. Parametric launches Q4; he's asked for buyer introductions three
> times (13 May, 3 Jun, 12 Aug) and you've made one. Beatrice Ofori meeting is set.
>
> *To carry:* Ana Castellane thinks parametric fails on basis risk — "the buyer thinks
> they bought insurance and they bought a bet" (5 May). Marcus's answer is that he's
> selling a hedge, not insurance (13 May). Your two buyers split exactly along that line:
> Graham Tull wants a real answer to a real problem (15 May), Beatrice already loses £4m a
> year to port delays and doesn't care what it's called (25 Aug). The question isn't
> whether parametric works. It's whether Marcus can tell those two buyers apart before he
> launches.

> **Thu 17 Sep · Klaus Beringer, Trans-Meridian Re**
> Last seen 8 Jul. Two introductions you made off the back of him — Sofia Marchetti and
> Derek Ainsworth — both changed their plans as a result.
>
> *To carry:* you now have four people describing his April thesis back to you as their
> own observation — Sofia (20 May), Derek (16 Jun), Ivan (24 Jun), Giles (2 Jul and 11
> Aug). Giles thinks it's his own book. Meanwhile Ana Castellane is pricing a new casualty
> book at three points of claims inflation (1 Sep) and has never met Klaus.

Both are assembled entirely from notes. Neither states anything the corpus doesn't.

---

## Layer 4 — The gate

**Citation or it doesn't ship.** Every claim in every output carries note + date + speaker,
and the quote must appear verbatim in the cited note. An uncited finding is dropped, not
softened. This is the whole difference between a system she trusts and one she stops
reading after three weeks.

**Plain English or it doesn't ship.** "Market participants are expressing concern regarding
delegated authority oversight burden" is dropped. "Five people have told you the same thing
about binder audits and none of them know" ships.

**Silence is a valid output.** Most weeks, most detectors return nothing. A digest that
always finds something is inventing, and the invented ones are indistinguishable from the
real ones until she acts on one and it isn't there.

---

## The eval loop

This is why the corpus exists. `eval/answer-key.md` is the ground truth:

- **Recall:** how many of F1–F10 does a run produce, with correct citations?
- **Precision:** does it report T1, T2 or T3? Any one of those is a failed run.
- **Grounding:** does every quote appear verbatim in the note it cites?
- **Silence:** run it over a quiet fortnight. Does it return nothing?

Change a prompt, re-run, compare. Without this you are tuning on vibes, and every version
will feel like an improvement.

Suggested pass mark before it goes near real notes: **F1, F3, F4 and F6 found; zero traps
reported.** F6 alone justifies the build.

---

## What not to build

- **A chat interface over the notes.** She can already search. The value is the thing she
  wouldn't have thought to ask for.
- **Per-note summaries.** The notes are already short. Summarising them destroys the
  verbatim quotes that everything else depends on.
- **Relationship scores, sentiment, engagement health.** Numbers that go up and down and
  change nothing.
- **A second brain.** The test for any proposed feature: *does it end in an output, or does
  it just make the notes more interesting to look at?* Five of the six findings above end in
  a named introduction or a specific question. That's the bar.

---

## Build order

1. **Layer 1 over the back catalogue.** No outputs yet. Check the extraction by hand on
   twenty notes — especially that quotes are verbatim and Fern Achebe is one person.
2. **D5 plus the dot-join alert.** Smallest build, biggest single finding, and it justifies
   everything after it. If D5 finds F6 in a corpus where the author missed it for five
   months, the case is made.
3. **D1 and D6, Monday digest.** The weekly rhythm.
4. **Meeting prep** on top of the standing findings.
5. **D2, D3, D4** last. Highest quality per item, lowest volume, and they need the subject
   vocabulary from steps 1–3 to be stable first.

---

## Notes for a Copilot build

- Layer 1 fits an agent triggered on file-add in the notes folder. It is the only component
  that needs to run at capture.
- The extracted claims and registers need to live somewhere queryable — a list, a table,
  anything structured. Not a folder of prose. Copilot's grounding is semantic search, which
  answers "find mentions of X" and cannot answer "what recurs", because there is no X yet.
  D1 and D4 read the structured claims, not the notes.
- D5's registers are small — a few hundred rows over six months — so they fit in context in
  full. No retrieval needed on the highest-value detector.
- Scheduled agents for D1/D2/D3/D4/D6; the event trigger only for D5.
- Client-confidential material across named accounts is exactly the category most firms
  restrict. Worth confirming what an agent may be pointed at before building on it.
