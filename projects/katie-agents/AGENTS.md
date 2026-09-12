# The agent system

Reverse-engineered from `corpus/` — 200 notes, six months, one business development person
in the specialty insurance practice of a large professional services firm. Every component
below exists because a specific finding in `eval/answer-key.md` cannot be produced without
it.

---

## What the setting changes

She does not own the solution. Her job is to hear a client problem and route it to the
partner who can sell into it. Three consequences shape the whole design:

**Half the corpus is internal.** Saskia's casualty diagnostic, Teodora's attribution
practice, Gareth's hunt for an industrialisable process, Nils's team with nothing booked
past October — every one of those is a capability sitting idle, stated in a note, waiting
for demand that arrived months later in someone else's words. At a smaller firm the
capability side is the market. Here it is mostly the building she works in.

**Some of the best matches are illegal.** Harrow Point is an audit client. It is also the
best-qualified opportunity in the corpus (F8). The blocking fact lives outside the notes and
has to be joined in — and the finding must be surfaced *flagged*, never silently dropped.

**Her own firm contaminates the signal.** The firm publishes a market report in April; three
clients repeat its headline claim back to her by July, one of them attributing it to
"everyone" (T3). It clears every threshold the real convergence finding clears. Without
provenance tracking the system launders the firm's marketing into the firm's market view.

---

## What the corpus forced

**1. One prompt cannot do this.** The ten findings need seven structurally different
queries. Convergence looks for agreement; contradiction looks for one subject with opposite
polarity; "what stopped" is a diff between two windows with nothing to retrieve; the
dot-join is a match between two *kinds* of statement. A single "find patterns in my notes"
prompt returns F1, sometimes, and never the other nine.

**2. The rolling window has to be two windows.** F2 spans 164 days. Anything running on
eight weeks sees two of its four mentions and stays silent forever. So: a fast weekly pass
over ~8 weeks, and a slow monthly pass over everything. The slow pass holds the better
findings, because the patterns that take five months to assemble are exactly the ones she
cannot hold in her head.

**3. Count organisations, not people, and not mentions.** The loudest topic in the corpus is
one broker's system migration — five notes, three named people, one firm (T2). Meanwhile F1
is five organisations that never repeat a phrase. Counting mentions inverts the ranking;
counting *people* still falls for T2.

**4. The same word is not the same subject.** Three people say "GenAI" in four weeks and
mean a vendor complaint, an operations build and a claims product (T1).

**5. Structure has to be captured per note, not searched for later.** F7 is a problem stated
in March and a capability stated in August sharing almost no vocabulary — "battery storage"
against "BESS". F6 is an internal actuarial note in March against four client notes in four
client vocabularies. Neither is findable by similarity search. Both are trivial if each note
was already labelled *who has a problem* and *who has a capability* at the time it was written.

**6. Most notes are nothing.** 79 of the 200 contain no quoted speech at all — timesheets,
parking fines, mandatory training, `-`. Filter once, cheaply, and never let them reach a
detector.

---

## Layer 1 — Extract (per note, once, at capture)

The layer everyone skips, and the one that makes the rest possible. Each note becomes:

```
date
side              client | internal | network(member firm) | market(non-client source)
orgs[]            canonical id, not the string in the note
people[]          person id + name + role + org AS AT THIS DATE
account_flags     from the firm's systems, not the note:
                    audit_client · pursuit_active · relationship_owner
has_signal        false for the ~40% that are admin — these stop here
claims[]
  quote           verbatim, as written
  speaker         person id
  type            problem | capability | opinion | fact | commitment | admin
  subject         normalised, chosen from existing subjects where one fits
  stance          for | against | neutral
  strength        stated directly | in passing | second-hand | overheard
  provenance      original | repeats firm publication <id>
commitments[]     who owes what to whom, and whether a later note closes it
```

Five things this layer must get right:

**Verbatim quotes.** Her paraphrase is the enemy. If the extractor rewrites "forty binders
and three people" as "concerns about delegated authority capacity", F1 dies — every quote
collapses into one house style and the pattern disappears into the summary.

**People, not names.** `Fern Achebe` is Head of Cyber at Thackeray in March and CUO at
Bellwether in September. F2 breaks if those are two people, or one person still at
Thackeray. `Priya Raman` also appears as `P Raman`.

**`side`.** Without it, F5 and F6 are invisible — both depend on matching an internal
capability to external demand, and on knowing that a practice's idle capacity is a different
kind of fact from a client's problem.

**`account_flags`, joined from firm systems.** Independence status is never stated as a rule
in the notes; it appears as three passing remarks and one check run two months late. F8
requires the join.

**`provenance`.** The only defence against T3. A claim that postdates the firm's own
publication, matches its language, and comes from someone on its distribution list is not
market signal. Flag it at extraction, because by the third telling ("everyone says") the
tell is gone.

Cost: one pass per note. ~200 calls for the back catalogue, a handful a day after.
Idempotent.

---

## Layer 2 — Seven detectors

Each is a separate job with its own threshold and its own silence condition.

### D1 · Convergence — *what are several unconnected people saying?*
**Produces F1.** Clusters claims by subject; requires **≥3 independent organisations** and
at least two rated *stated directly*. Runs weekly over 8 weeks and monthly over everything
— the monthly pass is what catches F2.

Evidence is narrower than eligibility: a claim only counts toward convergence if it is
**attributed** (a named person at a named external organisation) and is a **problem or a
view**. An overheard corridor remark is not an organisation, and an internal partner
describing her own service line is not a market signal — both let T4 through until fixed.

Guards, in measured order of how much they earn their place (see `eval/results.md`):
`provenance` (sole defence against T3), `orgCount` (sole defence against T2),
`attribution` and `subjectSense` (redundant pair against T4), then `strength` and
`externalOnly`, which block nothing on their own against this corpus's traps.

### D2 · Contradiction — *who disagrees, and neither knows?*
**Produces F3.** Same subject, opposed stance, both *stated directly*, both senior. One or
two a quarter. The highest value per unit of volume — it is the only output here she cannot
get any other way.

### D3 · First voice — *who called this before everyone else?*
**Produces F4.** Takes a D1 cluster, orders by date, fires when the earliest claim leads the
next by 30+ days and later speakers don't cite it. **A candidate first voice must have stated
it outright** — allowing a hunch mentioned in passing both names the wrong person and drags
the lead time under the threshold, which is how F4 was missed by a single day on the first
run. Output names a **person**, not a topic:
"Klaus Beringer said this in April; four people have since said it back to you in their own
words." Cross-references `side` so an independent internal source (Hal Brennan, with data)
attaches to the same finding.

This one changes her behaviour more than any other — it tells her whose call to weight.

### D4 · What stopped — *what has gone quiet?*
**Produces F5.** Quarter-over-quarter subject frequency diff. Fires on a subject with 4+
mentions across 3+ orgs in one window that **declines by ~80% with nothing stated directly**
in the next. Not strict zero: one passing mention in an August note was enough to suppress F5
entirely on the first run. A comparison, not a search — no retrieval finds an absence.

At this firm it has a second leg: cross-reference against internal capacity. "Clients
stopped talking about the June deadline" is a curiosity. "Clients stopped talking about the
June deadline and the partner who hired three people for it has nothing booked past October"
is a conversation with Nils.

### D5 · Problem ↔ capability — *the dot-join*
**Produces F6, F7, F9's raw material, and most of F10. The reason to build any of this.**

Maintains three live registers from Layer 1: open **client problems**, open **client
capabilities**, open **internal capabilities**. On every new note, match the new side against
the full standing register on the other — whole corpus, no window, because F7's halves are
148 days apart and F6's are five months apart.

**Event-driven, not scheduled.** A capability landing on 19 August against a 1 October
renewal is worth days. Weekly batching nearly cost that one.

**One capability against N needs is one finding, not N.** Ungrouped, Gareth Lowry's six
matches and Ines Delacroix's six buried Duraflex↔Copperfield under 28 alerts. Group by
capability, list every matched organisation once, rank by sellable demand (audit-clean
first) then by how long the pair sat unnoticed.

Match on the described need, not on vocabulary. "Nobody will write my battery storage" and
"we're opening a BESS book and don't know who the buyers are" share almost no words and are
the same finding. "I can't tell whether that's skill or lag" and "a diagnostic that tests
severity assumptions against external claims data" share none at all.

**Client-to-client matching works on subject identity. Internal matching does not.** A
practice describes what it sells in different words from how a client describes what hurts,
so every internal match in the run needed a curated link in the subject vocabulary
(`forensic-attribution ~ cyber-war-attribution`, `managed-services-proposition ~
da-oversight-cost`). That vocabulary has to be maintained *with the practices*, not derived
from client notes alone — and if it isn't, the internal half of the system stops working
silently rather than loudly.

Vacancies and departures are the same shape — a job opening is a problem, a senior person
leaving is a capability. That gets Fern Achebe's move flagged in June from two notes the
corpus already contains, instead of learned from a press release in August.

### D6 · Open loops — *what did you promise, and who's gone quiet?*
**Produces F10.** Two passes over the commitments register: promises not closed, and
organisations with an open thread and no contact in 60+ days.

The dormancy half must say *what was left open*. "Yusuf raised a retainer on 29 April and
you said you'd come back to him" is actionable; "no contact in 135 days" is a CRM field.
Tracks debts in both directions — six of the seven unclosed commitments in the corpus are
owed to **internal partners**, not clients.

### D7 · Account coherence — *who else from the firm is in this building?*
**Produces F9.** Not a topic detector at all. Groups internal notes by client organisation
and fires when one account appears in two or more unconnected internal threads, or when the
named relationship owner appears in none of them.

Would have fired on Calloway Global on **10 June**, from two routine internal notes three
weeks apart. The client found it instead, in August, and said so.

---

## Layer 3 — Delivery

Three channels and, unlike a smaller firm, **two audiences**.

**Monday digest, to her** — whatever fired, **ranked and hard-capped at three**. The first
run emitted 43 findings, 17 of them from D6 alone: every unclosed commitment and every
dormant account, every week, forever. Without a cap and a decay rule on repeats, the digest
is wallpaper inside a month. One line naming the finding, the quotes with names and dates,
one line on what is now possible. No analysis paragraph.

**Capability alerts, to the partner** — when D5 matches demand to an internal capability, the
partner who owns it hears about it too. Saskia asked for casualty leads in March and again
on a sector call in August; four qualified ones accumulated in Katie's notes in between.
Routing that through one person's memory is the failure mode the whole firm has.

**Meeting prep, three days ahead** — the briefing, plus one question to carry around. The
question is *drawn from standing findings that touch this organisation*, never generated
fresh for the meeting. That is the change the corpus argues for: per-meeting generation has
nothing to work from and invents; pattern-first generation has F1–F10 to draw on and only
has to choose. If nothing touches the account, the briefing goes without a question.

### Worked example — from `calendar.md`, delivered Monday 14 September

> **Thu 17 Sep · Klaus Beringer, Trans-Meridian Re**
> Last seen 8 Jul. Two introductions off the back of him — Sofia Marchetti and Derek
> Ainsworth — both changed their plans as a result.
>
> *To carry:* four people have now described his April thesis back to you as their own
> observation — Sofia (20 May), Derek (16 Jun), Ivan (24 Jun), Giles (2 Jul and 11 Aug).
> Giles thinks it's his own book. Hal Brennan in New York reached the same conclusion
> independently on 13 Jul and has verdict data he'll share with UK clients. You have never
> put those two in a room. Dame Rosalind Hyde is "not certain about the assumptions" behind
> Calloway's casualty reserves (18 Aug) and has met neither.

> **Wed 16 Sep · Nadia Hoyle, Bellwether MGA**
> Last seen 29 Jul. Fourth carrier live; fourth audit pack requested. Her CUO is Fern
> Achebe, who you have known since March.
>
> *To carry:* Nadia is the fourth of eight sources on binder oversight cost — carrier, MGA,
> mutual, broker, capital, and two French MGAs via Marc Deschamps. Gareth Lowry asked you on
> 12 May for "a process that every firm in a sector does separately, badly, and hates." This
> is it, and Nadia and Ines Delacroix are already building the fix themselves.

Both assembled entirely from notes. Neither states anything the corpus doesn't.

---

## Layer 4 — The gates

**Citation or it doesn't ship.** Note, date, speaker, and the quote must appear verbatim in
the cited note. An uncited finding is dropped, not softened. This is the difference between a
system she trusts and one she stops reading after three weeks.

**Independence or it doesn't ship.** Any finding naming an audit client carries the flag, with
the non-audit alternatives named alongside it. Never suppressed — hiding the reason the best
match is dead is its own failure.

**Provenance or it doesn't ship.** Claims traceable to the firm's own published material are
excluded from every convergence count. If a finding survives only because of them, it dies.

**Plain English or it doesn't ship.** "Market participants are expressing concern regarding
delegated authority oversight burden" is dropped. "Five clients have told you the same thing
about binder audits and none of them know" ships.

**Silence is a valid output.** Most weeks, most detectors return nothing. A digest that
always finds something is inventing, and the invented ones are indistinguishable from the
real ones until she acts on one and it isn't there.

---

## The eval loop

This is why the corpus exists. `eval/answer-key.md` is ground truth:

- **Recall:** how many of F1–F10, with correct citations?
- **Precision:** does it report T1–T4? T3 is the one that separates a usable system from a
  plausible one.
- **Grounding:** does every quote appear verbatim in the note it cites?
- **Independence:** is F8 surfaced *with* its flag?
- **Silence:** run it over a quiet fortnight. Nothing should come back.

Change a prompt, re-run, compare. Without this you are tuning on vibes and every version
feels like an improvement.

Suggested pass mark before it touches real notes: **F1, F4, F6 and F7 found; T3 not
reported; F8 flagged.**

Run 1 scored **14/14 recall, 0/4 traps** — see `eval/results.md`, which also records the
seven bugs the run found and the two guards this corpus does *not* justify. Note what that
number does and doesn't cover: Layer 1 was done by hand by someone who knew where the
patterns were, so extraction quality is untested and a real run will be worse.

---

## What not to build

- **A chat interface over the notes.** She can already search. The value is the thing she
  wouldn't have thought to ask for.
- **Per-note summaries.** The notes are already short, and summarising destroys the verbatim
  quotes everything depends on.
- **Relationship scores, sentiment, engagement health.** Numbers that move and change nothing.
- **Anything that competes with the CRM.** The CRM records that a meeting happened. This
  records what was said. Different jobs; don't merge them.

The test for any proposed feature: *does it end in an output, or does it just make the notes
more interesting to look at?* Nine of the ten findings end in a named introduction, a
specific question, or a partner conversation. That's the bar.

---

## Build order

1. **Layer 1 over the back catalogue.** No outputs yet. Hand-check twenty notes — especially
   that quotes are verbatim, that Fern Achebe is one person, and that internal notes are
   labelled as such.
2. **D5 plus capability alerts.** Smallest build, two biggest findings (F6, F7), and the only
   one that pays a partner directly. If it finds the Duraflex match in a corpus where the
   author missed it for five months, the case is made internally.
3. **D7.** Cheap — it needs no semantics at all, just organisation names across internal
   notes — and it prevents the specific embarrassment of a client telling a CRO that three
   people from the firm don't talk to each other.
4. **D1 and D6, Monday digest.** The weekly rhythm. D1 needs the provenance gate from day one.
5. **Meeting prep** on top of standing findings.
6. **D2, D3, D4** last. Highest quality per item, lowest volume, and they need the subject
   vocabulary from the earlier steps to be stable.

---

## Notes for a Copilot build

- Layer 1 fits an agent triggered on file-add in the notes folder — the only component that
  must run at capture.
- Extracted claims and registers need somewhere queryable — a list, a table, anything
  structured. Not a folder of prose. Copilot grounds by semantic search, which answers "find
  mentions of X" and cannot answer "what recurs", because there is no X yet. D1 and D4 read
  the structured claims, not the notes.
- D5's registers are small — a few hundred rows over six months — so they fit in context in
  full. No retrieval on the highest-value detector.
- `account_flags` and the publication list are the two joins that come from firm systems
  rather than from her. Both are small and both are what make F8 and T3 possible. Neither
  needs to be live; monthly is fine.
- Scheduled agents for D1/D2/D3/D4/D6/D7; event trigger only for D5.
- Client-confidential material across named accounts, with audit-client status attached, is
  about as sensitive as internal data gets. What an agent may be pointed at is a
  conversation to have before building, not after.
