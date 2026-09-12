# Answer key

What is deliberately buried in the 200 notes. Nothing here is stated anywhere in the
corpus — every finding has to be assembled from notes written weeks or months apart by
someone who had forgotten the earlier ones.

Ten findings to hit, three traps to avoid. Score a run on both.

---

## F1 — Delegated authority oversight cost (convergence)

**The finding:** Five organisations, five different seats in the market, independently
describe the same problem in six months. Nobody uses the same words and none of them
knows the others are saying it.

| Date | Who | Org | Seat | Their words |
|------|-----|-----|------|-------------|
| 06 Apr | Nadia Hoyle | Bellwether MGA | MGA | "three sets of homework… paperwork about paperwork" |
| 28 Apr | Ines Delacroix | Pallister Speciality | MGA | "£180,000 proving we're allowed to do the thing we were already doing" |
| 03 Jun | Marcus Deyn | Ravensbourne | Carrier | "doubled the oversight headcount… the list of things it found is not long" |
| 16 Jun | Derek Ainsworth | Castleford Mutual | Mutual | "forty binders and three people" |
| 06 Jul | Charlotte Pym | Aldgate & Vane | Broker | "same coverholder, three times over" |
| 21 Jul | Jonah Pike | Lattice Capital | Capital | "we can't diligence forty coverholders" |
| 07 Sep | Fern Achebe | Bellwether MGA | MGA (new CUO) | "four carriers and four audit regimes… six weeks and it's already the thing I complain about most" |

**Why it's hard:** there is no shared keyword. `grep "audit pack"` returns three notes and
misses Pallister, Castleford and Aldgate entirely. Requires meaning, not matching.

**Why it's worth money:** it's the one finding she can say out loud in a room — "I'm
hearing this from a carrier, two MGAs, a broker and a capital provider." Also the answer
to Aisling's question at Fenwick on 6 May, which went unanswered for five weeks.

**Bonus credit:** Ines is already building a fix (9 Jun, 22 Jul, 4 Sep) and Nadia asked
for exactly that fix (19 May). Those two were introduced, so the system should notice a
solved instance of the pattern sitting inside its own corpus.

---

## F2 — Cyber war exclusion, attribution gap (slow convergence)

**The finding:** Four organisations across underwriting, law and the buyer side describe
the same hole in the same wording — nobody can say who decides whether an attack was
state-backed.

| Date | Who | Org | Side |
|------|-----|-----|------|
| 27 Mar | Fern Achebe | Thackeray 2884 | Underwriter |
| 08 May | Eleanor Strand | Whitcombe LLP | Coverage counsel |
| 20 Jul | Beatrice Ofori | Norton Hale Logistics | Buyer |
| 07 Sep | Fern Achebe | Bellwether MGA | Underwriter (new seat) |

**Why it's hard: this one breaks the rolling window.** First and last mention are 164
days apart. Any detector running on 8 weeks of notes sees at most two of these and never
fires. This finding is the reason the system needs a second, slower pass — see
`AGENTS.md`.

**Why it's worth money:** she has an underwriter who wants to build an honest wording, a
lawyer who has litigated the ambiguity, and a buyer who cannot get a straight answer. All
three want the other two. She introduced Eleanor to Beatrice on 31 Jul. She never
connected either to Fern.

---

## F3 — Parametric (contradiction)

**The finding:** Two senior underwriters, same market, opposite views, six weeks apart.

- **19 Mar + 13 May — Marcus Deyn, Ravensbourne CUO:** building a book. "The data's
  finally good enough." On basis risk: "it's a design problem… people sold it as
  insurance when it's a hedge."
- **05 May — Ana Castellane, Harrow Point:** "a solution looking for a problem… the
  first time a client gets a nil payout on a real loss you lose the client and the
  broker tells everyone."

**Why it's hard:** convergence detectors find agreement. This is the same topic with
opposite polarity, which is a different query. A naive topic clusterer files these
together as "parametric interest" and loses the entire point.

**The resolution is also in the corpus, unnoticed:** two buyers disagree with each other.
Graham Tull (15 May) is lukewarm — "I've got a real problem, I don't need a clever one."
Beatrice Ofori (25 Aug) is the ideal buyer — "£4m of delay costs last year, none of it
insured… if someone can pay me when the port backs up I don't care what they call it."
Marcus is right about Beatrice; Ana is right about Graham. The distinction is whether the
buyer already prices the exposure.

---

## F4 — US casualty severity (lag)

**The finding:** One person calls it in April, explicitly and with reasoning. Four others
describe the same thing between May and August as if it were local to them.

| Date | Who | Org | How they framed it |
|------|-----|-----|--------------------|
| **21 Apr** | **Klaus Beringer** | **Trans-Meridian Re** | **Named it. "This will show up at one-one… almost nobody is saying this."** |
| 20 May | Sofia Marchetti | Kestrel Re | "the numbers look too good" — nervous, can't say why |
| 16 Jun | Derek Ainsworth | Castleford Mutual | "the lawyers have got more organised" |
| 24 Jun | Ivan Kroll | Pemberton | rates moving, "the markets aren't explaining it" |
| 02 Jul / 11 Aug | Giles Overton | Thackeray | tightened terms twice; reserves up — "thinks it's his book" |

**Why it's hard:** needs time-ordering inside a cluster and an answer to "who was first",
which is a different output from "what recurs". Also needs to survive four people
describing one phenomenon in four vocabularies, none of them Klaus's.

**Why it's worth money:** it identifies a source worth listening to, not just a topic.
She acted on this twice by accident (Sofia on 26 Jun, Derek on 13 Jul) and both were the
best outcomes of her year — Sofia restructured a mandate, Derek rewrote a board paper.
The system should have told her to do it in May, and should now be pointing at Ana
Castellane, who is building a casualty plan on three points of claims inflation (1 Sep)
and has not met Klaus.

---

## F5 — ESG underwriting criteria (the thing that stopped)

**The finding:** Dominant March–April, gone by June. Nobody announces this.

**Present:** Ana Castellane 18 Mar · Meredith Sowande 26 Mar · Jonah Pike 2 Apr ·
Alun Price 8 Apr · Yusuf Baptiste 14 Apr — five orgs in four weeks.

**Absent:** zero mentions after mid-May, across ~90 notes. The same people, on the same
topics, stop raising it — Jonah 8 Jun, Meredith 12 Jun, Alun 1 Jul. The only trace is
Ana on 1 Sep mentioning that Harrow Point's sustainability lead left in July and has not
been replaced.

**Why it's hard:** it is structurally a diff between two windows, not a search. Nothing
in any single note says "nobody talks about this anymore". A retrieval-based system
cannot find an absence, because there is nothing to retrieve.

**Why it's worth money:** Meredith *bought* an ESG advisory arm in March on the thesis
that every RFP would have a sustainability section. Someone should ask her how that's
going.

---

## F6 — Duraflex ↔ Copperfield (the forgotten dot-join)

**The finding, in full:**

- **24 Mar — Graham Tull, Duraflex:** four sites with lithium battery storage, a £5m
  sublimit against an exposure north of £40m, nobody will write it. "If anyone will write
  this properly I'll move the whole programme." £2.8m of premium. Renews 1 October.
- **19 Aug — Ed Maslin, Copperfield:** opening a BESS book in Q4, two underwriters hired
  out of a renewables team, £25m line secured. "We have no relationships with the brokers
  who touch this business and we don't know who the buyers are."

**148 days apart. Never mentioned in the same note. Neither party knows the other exists.**

**Why it's hard:** it needs per-note structure — this person has a *problem*, that person
has a *capability* — captured at the time, then matched later. It is not a similarity
search: the two notes barely share vocabulary (Graham says "battery storage", Ed says
"BESS"). It also needs to survive Ed refusing to name the class in April and July.

**Why it's worth money:** it is the entire job. She wrote it down herself on 21 August:
*"Graham told me his problem on 24 March. Ed told me his five months later… I'd stopped
thinking about March."* The system exists to close that gap. This is the finding the
whole build is justified by.

**Secondary:** Aisling at Fenwick was told about the battery problem on 11 June and
correctly said it was a capacity problem, not a technology one. The capacity arrived ten
weeks later.

---

## F7 — Fern Achebe's move (entity tracking)

Rumour 14 May (unconfirmed, two sources) → confirmed by Fern 2 Jun, destination withheld
→ announced 26 Aug → new seat 7 Sep.

**The catch:** the other half was in the corpus the whole time. Nadia said Bellwether was
hiring a CUO on **19 May** and "closer than it was" on **22 Jun**, and the hire was done
but unnamed on **29 Jul**. A system tracking open facts should have flagged a possible
match in June — one senior cyber underwriter leaving, one MGA hiring a CUO, same market,
overlapping timeline. The note on 26 Aug records that she felt "slightly stupid".

**Also required:** the same person is `Fern Achebe` at Thackeray and at Bellwether. F2
breaks if her March and September comments are treated as two people, or as one person
still at Thackeray.

---

## F8 — Nine Elms has gone quiet (dormancy with an open thread)

Yusuf Baptiste: four contacts 19 Mar – 29 Apr, then nothing. **135 days silent.**

Not just silence — an unresolved commitment. On 29 Apr he raised a retained arrangement
and she said "let's talk when the launch settles". Two unanswered follow-ups (18 Jun,
15 Jul). Third-party intel on 18 Aug: Ivan heard the facility had a slow start.

A dormancy detector that only counts days since last contact is half the finding. The
useful version says *what was left open*.

---

## F9 — Unpaid introduction debts (open loops)

Commitments made in a note and never closed. Requires tracking an action across notes.

| Opened | Owed to | What | Closed? |
|--------|---------|------|---------|
| 19 Mar | Yusuf Baptiste | two broker intros | Charlotte 8 Apr ✓, Ivan never — Yusuf noticed (14 Apr) |
| 17 Mar | Charlotte Pym | someone who survived a PAS migration | never |
| 3 Apr | Charlotte Pym | intro to Orwell Marine | 3 weeks late, done 20 Apr |
| 6 May | Aisling Byrne | "what problems keep coming up that nobody's solved" | answered 11 Jun, 5 weeks |
| 27 Apr | Hannah Leith | broker flow | done 6 Jul, 10 weeks |
| 24 Mar | Graham Tull | someone who writes BESS | done 20 Aug, **21 weeks** |

---

## F10 — Cross-firm matches still open on 11 September

Present in the corpus, never actioned. A live system should be surfacing these now.

1. **Klaus Beringer ↔ Ana Castellane.** She is pricing a new casualty book at three
   points of claims inflation (1 Sep). He thinks that number is badly wrong. The two
   people he has already changed the mind of both called it the most useful conversation
   of their year.
2. **Fern Achebe ↔ Eleanor Strand.** Fern wants to build a cyber wording a buyer can
   read (7 Sep). Eleanor has litigated the exact ambiguity and watched it settle
   unresolved (31 Jul).
3. **Ed Maslin ↔ Charlotte Pym / Meredith Sowande.** Ed needs broker distribution for
   BESS (19 Aug, 2 Sep). Both brokers are actively building specialty and have taken
   every introduction offered.
4. **Simon Petrakis ↔ Pallister.** Hexley pays 1.25% for MGAs with owned distribution,
   £30m+ (10 Jul). Ines said the founders are "not not interested" (22 Jul). Nobody has
   put those two facts together — including the person who wrote both notes.
5. **Marcus Deyn ↔ Alun Price / Severn.** Untested. Marcus wants buyer validation; Alun
   has process-risk exposure and a market he's short of. Lower confidence than the above.

---

# Traps — a run that reports any of these has failed

## T1 — "AI" is three different subjects wearing one word

- 23 Mar, Ivan Kroll (Pemberton): hated a vendor's submission-reading tool.
- 15 Apr, Piotr Zawada (Bellwether): building submission triage.
- 17 Apr, Val Nkemelu (Sandbrook): claims fraud detection.

Three orgs, inside four weeks, one keyword — it will clear a naive convergence
threshold. It is not a pattern. One is a complaint about a vendor, one is an operations
build, one is a claims product. **Must not be reported as "AI is coming up a lot."**

## T2 — Aldgate & Vane's system migration is one firm, not a market

Charlotte 17 Mar, Duncan 20 Apr, Charlotte 27 May, Duncan again 24 Jul. Four notes, two
people, **one organisation.** Loudest single topic in the corpus by volume and it means
nothing beyond one building. Any detector counting *mentions* rather than *independent
organisations* fires here.

## T3 — below-threshold noise that should stay silent

- **Lloyd's modernisation:** 7 Apr (overheard, one named source) and 7 May (Ines, in
  passing). Two weak mentions. Everyone has said this for a decade. Silent.
- **Cyber hiring shortage:** 17 Apr (overheard, unattributed), 21 May / 2 Jul / 21 Jul
  (all Giles Overton, one org). Looks like four mentions; is one named organisation plus
  a corridor conversation. Silent, or lowest confidence with the count stated honestly.

---

# Scoring

**Recall** — F1–F10 found, in six months of notes, with correct citations.
**Precision** — T1–T3 not reported.
**Grounding** — every finding cites note + date + person, and the quote appears verbatim
in the cited note. An uncited finding scores zero even if it is true.
**Silence** — a run over a quiet fortnight should return nothing. A system that always
finds something has failed differently.

A run that reports F1 and T1 with equal confidence is worse than one that reports
neither, because it teaches her to stop reading.
