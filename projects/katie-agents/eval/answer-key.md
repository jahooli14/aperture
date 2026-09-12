# Answer key

What is buried in the 200 notes. Nothing here is stated anywhere in the corpus — every
finding has to be assembled from notes written weeks or months apart by someone who had
forgotten the earlier ones.

The setting matters. She is a business development person in the specialty insurance
practice of a large professional services firm. She does not own the solution: her job is
to hear a client problem and connect it to a partner who can sell into it. That creates
three kinds of finding a smaller firm doesn't have — internal capability sitting unused,
independence rules that block the best matches, and several colleagues in the same client's
building who don't know about each other.

Ten findings to hit, four traps to avoid.

---

## F1 — Delegated authority oversight cost (convergence, external)

Five client organisations, five different seats, six months, no shared vocabulary.

| Date | Who | Org | Seat | Their words |
|------|-----|-----|------|-------------|
| 06 Apr | Nadia Hoyle | Bellwether MGA | MGA | "three sets of homework… paperwork about paperwork" |
| 28 Apr | Ines Delacroix | Pallister Speciality | MGA | "£180,000 proving we're allowed to do the thing we were already doing" |
| 03 Jun | Marcus Deyn | Ravensbourne | Carrier | "doubled the oversight headcount… the list of things it found is not long" |
| 16 Jun | Derek Ainsworth | Castleford Mutual | Mutual | "forty binders and three people" |
| 06 Jul | Charlotte Pym | Aldgate & Vane | Broker | "same coverholder, three times over" |
| 08 Jun | Jonah Pike | Lattice Capital | Capital | "we can't diligence forty coverholders" |
| 21 Jul | Marc Deschamps | Paris member firm | Network | two French MGA clients, same complaint |
| 07 Sep | Fern Achebe | Bellwether MGA | New CUO | "six weeks and it's already what I complain about most" |

**Why it's hard:** no shared keyword. `grep "audit pack"` returns three notes and misses
Pallister, Castleford and Aldgate entirely. Needs meaning, not matching.

**The Big Four payoff, and the miss.** On **12 May** Gareth Lowry (Managed Services) asked
her for exactly this: *"Give me a process that every firm in a sector does separately,
badly, and hates. That's what we industrialise."* She wrote *"I have a feeling I already
have it and haven't seen it"* — and then didn't see it. By September she had eight sources
across five client organisations, two member firms and every seat in the distribution
chain, and Gareth still had no proposition.

That is the answer to Rupert's repeated question about a differentiated specialty
proposition (13 Apr, 15 Jun, 8 Sep), and to Aisling Byrne's on 11 June.

**Bonus:** Ines is already building the fix (23 Jun, 22 Jul) and Nadia asked for that exact
fix on 22 Jun. The system should notice a solved instance of its own pattern in the corpus.

---

## F2 — Cyber war exclusion, attribution gap (slow convergence + unused internal capability)

Four organisations across underwriting, law and the buyer side, describing one hole: nobody
can say who decides whether an attack was state-backed.

| Date | Who | Org | Side |
|------|-----|-----|------|
| 27 Mar | Fern Achebe | Thackeray 2884 | Underwriter |
| 08 May | Eleanor Strand | Whitcombe LLP | Coverage counsel |
| 20 Jul | Beatrice Ofori | Norton Hale Logistics | Buyer |
| 07 Sep | Fern Achebe | Bellwether MGA | Underwriter, new seat |

**Why it's hard: it breaks the rolling window.** First and last are 164 days apart. Any
detector running on eight weeks sees at most two and never fires.

**The finding underneath the finding.** On **23 April** Teodora Iliev (Forensics) described
what her team sells: *"We do attribution for governments and for boards. We write the report
that says, to an evidential standard, this was probably these people… It's the only real
version of that answer anyone can buy."* She has **zero insurance carrier clients** and
asked where the sector might need her.

Four clients have an attribution problem nobody can answer. One partner sells attribution
for a living. Five months, never connected. Katie's own note that day: *"something about
this is important and I haven't joined it up yet."*

Compounding miss: on **9 June** she spent an hour with the Cyber partner (Hema Sundaram)
planning sector strategy and the subject never came up — *"I didn't raise it because I was
thinking about something else."* The system should have put it in front of her that morning.

---

## F3 — Parametric (contradiction)

Two senior underwriters, same market, opposite views, six weeks apart.

- **19 Mar + 13 May — Marcus Deyn, Ravensbourne CUO:** building a book. On basis risk:
  *"it's a design problem… people sold it as insurance when it's a hedge. We're selling it
  as a hedge."*
- **05 May — Ana Castellane, Harrow Point:** *"a solution looking for a problem… the buyer
  thinks they bought insurance and they bought a bet."*

**Why it's hard:** convergence detectors find agreement. This is one subject with opposite
polarity — a different query. A naive topic clusterer files these together as "parametric
interest" and loses the entire point.

**The resolution is also in the corpus, unnoticed.** The two buyers split exactly along the
disagreement. Graham Tull is lukewarm — *"I've got a real problem, I don't need a clever
one"* (15 May). Beatrice Ofori is the ideal buyer — *"£4m of delay costs last year, none of
it insured… if someone can pay me when the port backs up I don't care what they call it"*
(25 Aug). Marcus is right about Beatrice; Ana is right about Graham. The variable is whether
the buyer already prices the exposure.

---

## F4 — US casualty severity (lag, and a second independent source)

One person calls it in April with reasoning. Four others describe it between May and August
as if it were local to them.

| Date | Who | Org | How they framed it |
|------|-----|-----|--------------------|
| **21 Apr** | **Klaus Beringer** | **Trans-Meridian Re** | Named it. *"This will show up at one-one… almost nobody is saying this."* |
| 20 May | Sofia Marchetti | Kestrel Re | *"the numbers look too good"* — nervous, can't say why |
| 16 Jun | Derek Ainsworth | Castleford Mutual | *"the lawyers have got more organised"* |
| 24 Jun | Ivan Kroll | Pemberton | rates moving, *"the markets aren't explaining it"* |
| 02 Jul / 11 Aug | Giles Overton | Thackeray | tightened terms twice; reserves up — *thinks it's his book* |

**The internal half, missed.** On **13 July** Hal Brennan (New York) arrived at the same
conclusion independently from the US primary side, *with a dataset on nuclear verdicts he'd
share with UK clients*, and no route into the UK market. She met him on a network call she
notes she "usually skips" (16 Apr).

**Why it's worth money:** it identifies a *source*, not a topic. She acted on Klaus twice by
accident — Sofia (26 Jun) and Derek (13 Jul) — and both were the best outcomes of her year.
Dame Rosalind Hyde at Calloway said on 18 Aug that she is *"not certain about the
assumptions"* behind her casualty reserves, and has never met either man.

---

## F5 — The June regulatory deadline (the thing that stopped)

**Present, Mar–May:** Rob Gilder 18 Mar · Derek Ainsworth 30 Mar · Piotr Zawada 15 Apr ·
Ines Delacroix 28 Apr · Peter Ngo 6 May — five organisations in seven weeks.

**Absent from July.** Zero mentions across ~70 notes. Alun Price, for whom it was half the
April call, doesn't mention it on 1 Jul. Derek "never wants to hear about it again" (16 Jun).

**Why it's hard:** structurally a diff between two windows, not a search. Nothing in any
note states it, so there is nothing to retrieve.

**Why it matters here, specifically.** Nils Ekström **hired three people** for this work
(25 Mar) and said in March it would fall off a cliff. On 2 Jun: *"I need a second act and I
don't have one."* On 8 Sep his hires have nothing booked past October. Meanwhile F1 is a
regulatory-adjacent proposition with eight sources that nobody has assembled, and Nils asked
her directly on 2 Jun what she was hearing that was "regulatory-shaped". She *"gave him
nothing useful."*

The finding is not "clients stopped talking about the deadline." It is: **a practice with
idle capacity, and demand for the adjacent thing sitting in her notes.**

---

## F6 — Saskia's casualty diagnostic (internal capability ↔ four client problems)

**24 Mar — Saskia Boateng, Actuarial Partner**, in a coffee Katie requested: they have built
a diagnostic that tests a carrier's casualty severity assumptions against external claims
data. Two engagements, both via audit relationships. *"I don't meet these people. You do."*

Then, over the next five months, four clients describe the exact problem it solves:

| Date | Who | What they said |
|------|-----|----------------|
| 26 Jun | Sofia Marchetti, Kestrel Re | *"I can't tell whether that's skill or lag"* |
| 18 Aug | Dame Rosalind Hyde, Calloway | *"adequate on the current assumptions and I'm not certain about the assumptions"* |
| 27 Aug | Derek Ainsworth, Castleford | asked whether anyone could **test** his assumptions rather than worry at him |
| 01 Sep | Ana Castellane, Harrow Point | *"we've assumed three points of claims inflation. If it's eight we've got a different plan"* — and asked directly |
| 09 Sep | Sofia again | now wants assumptions tested before she writes a line, **and will pay** |

Saskia asked for leads again on a sector call on **11 Aug**, which Katie was "half-listening"
to. Actuarial utilisation was soft the whole time.

**Why it's hard:** the capability note is internal, in March, and uses actuarial vocabulary.
The demand notes are external, across five months, in four different client vocabularies,
and none of them says "reserving diagnostic". Only structure captured at the time connects
them — this is not a similarity search.

---

## F7 — Duraflex ↔ Copperfield (client-to-client dot-join)

- **24 Mar — Graham Tull, Duraflex:** four sites of lithium battery storage, a £5m sublimit
  against an exposure north of £40m, nobody will write it. *"If anyone will write this
  properly I'll move the whole programme."* £2.8m of premium. Renews 1 October.
- **19 Aug — Ed Maslin, Copperfield:** opening a BESS book in Q4, two underwriters hired out
  of a renewables team, £25m line secured. *"We have no relationships with the brokers who
  touch this business and we don't know who the buyers are."*

**148 days apart. Never in the same note. Almost no shared vocabulary** — "battery storage"
against "BESS". Neither party knows the other exists.

**Why it's worth money here:** it isn't a fee. It's the favour that opens an account the
risk practice has failed to enter for two years (24 Mar), and by 3 Sep Graham is asking
*"what else don't I know I could buy."*

Katie wrote the case for the whole system herself on 21 August: *"Graham told me his problem
on 24 March… by August I had stopped thinking about March. We have four hundred of these
conversations a year across the sector team and no memory of any of them beyond whoever was
in the room."*

---

## F8 — The best match is an audit client (independence)

Harrow Point Speciality is a **statutory audit client** (18 Mar, 16 Apr, 11 May). Most
advisory work is prohibited outright.

It is also, on the evidence of the corpus, the single best-qualified opportunity in it: Ana
Castellane asks directly on 1 Sep whether the firm can test her claims inflation assumption,
which is precisely Saskia's diagnostic (F6). Rob Gilder asked for help on the June deadline
(16 Apr). Jonah Pike wanted an introduction to exactly this carrier (2 Apr).

**Why it's hard:** the blocking fact is not in the notes as a rule, only as three passing
remarks and one check she ran two months late — *"I should have known it in March"* (11 May).
It has to be joined to the finding from outside.

**The required behaviour is to surface it flagged, not to suppress it.** The corpus contains
two non-audit clients with the same need (Kestrel, Castleford) and one prospect (Calloway).
A system that silently drops Harrow Point has hidden the reason its best-looking match is
dead; a system that surfaces it unflagged is walking her into an independence breach.

---

## F9 — Nobody owns Calloway Global (account fragmentation)

Three people from the firm in one client's building, discovered by the client.

- **19 May** — Nils Ekström is in a regulatory pursuit with Dame Rosalind Hyde, and asks
  Katie to *"stay out of the way so we present one face."*
- **10 Jun** — Callum Fraser mentions a policy admin pursuit at the same client, running
  since March, through their COO. *"Yes, different part of the business,"* and they left it.
- **18 Aug** — Dame Rosalind, unprompted: *"I've had three different people from your firm
  in this building this year and I don't know whether they talk to each other. One of them
  asked me a question I'd already answered for someone else."*
- **8 Sep** — nobody in the room can say who owns the relationship. It turns out to be Nils
  formally and Callum in practice, *and neither knew that.*

**Why it's hard:** the two halves are internal notes three weeks apart that each look
routine. The detector isn't about topics at all — it's the same organisation appearing in
two unconnected internal threads.

**Findable in June.** It was found in August by the client.

---

## F10 — Open loops, dormancy, and one unmade match

**Dormant with an unresolved commitment.** Yusuf Baptiste: four contacts 19 Mar – 29 Apr,
then **135 days of silence**. Not just silence — on 29 Apr he raised a retained arrangement
and she said "let's talk when the launch settles". Two unanswered follow-ups (18 Jun,
15 Jul). Third-party intel on 18 Aug: the facility had a slow start.

**Introduction debts, both directions:**

| Opened | Owed to | What | Closed? |
|--------|---------|------|---------|
| 24 Mar | Graham Tull | someone who writes BESS | 20 Aug — **21 weeks** |
| 19 Mar | Yusuf Baptiste | two broker intros | one done, one never |
| 3 Apr | Charlotte Pym | intro to Orwell Marine | 6 weeks late |
| 25 Mar | Nils Ekström | CRO introductions | never |
| 23 Apr | Teodora Iliev | where the sector needs forensics | never |
| 12 May | Gareth Lowry | an industrialisable process | never (see F1) |
| 6 May | Aisling Byrne | unsolved problems she keeps hearing | weak answer, 11 Jun |

**The match nobody made.** On **29 May** Simon Petrakis (Hexley) states his MGA acquisition
criteria: owned distribution, £30m+ GWP. On **10 Jul** Miriam Oyelaran (Deals) asks for MGA
sell-side targets in almost the same words. On **22 Jul** Ines Delacroix says Pallister's
shareholders are *"not not interested"* — £80m GWP, professional lines, owns its
distribution, clean FCA thematic. Three notes, one obvious triangle, never drawn.

---

# Traps — a run that reports any of these has failed

## T1 — "GenAI" is three subjects wearing one word

23 Mar Ivan Kroll (hated a vendor's tool) · 15 Apr Piotr Zawada (submission triage) ·
17 Apr Val Nkemelu (claims fraud). Three organisations in four weeks — clears a naive
threshold. One is a complaint, one an operations build, one a claims product. **Not a
pattern.**

## T2 — Aldgate & Vane's migration is one account, not a market

Charlotte 17 Mar · Duncan Reith 20 Apr · Charlotte 20 May · Priyanka Vale 15 Jun ·
Charlotte 6 Jul. Five notes, **three named people, one organisation** — deliberately built
to defeat a detector that counts people rather than firms. The loudest topic in the corpus
by volume and it means nothing beyond one building. Katie says so herself on 15 Jun: *"I
have no more insight than I had in March, I've just heard it three times."*

## T3 — The firm's own report coming back as market signal

**This is the trap the setting creates, and the most dangerous one.**

On 14 Apr the firm publishes a specialty outlook whose headline claim is that consolidation
will halve the number of Lloyd's managing agents by 2030. Katie's note: *"I have no idea
whether that's true. Nobody I've asked internally knows where the number came from."* It is
presented to ~40 clients at a breakfast on 12 May and emailed to ~300.

Then three clients say it back to her:

- 10 Jun, Piotr Zawada — *"your report says half the managing agents disappear by 2030"*
- 24 Jun, Ivan Kroll — repeats it, attributing it to *"everyone"*
- 15 Jul, Tobias Greer — *"you lot are saying half the managing agents go by 2030"*

Three organisations, five weeks, one claim, stated directly. **It will clear every threshold
F1 clears.** It is her own marketing echoing back, and by the third telling one client has
already laundered it into "everyone says". All three were at the briefing or on the
distribution list.

The tell is available: the claim postdates the publication, matches its language, and every
speaker is a recipient. A system that reports this as an emerging market view is worse than
useless — it will feed the firm's own number back into the firm's next report.

## T4 — Below threshold, should stay silent

- **Lloyd's modernisation:** 7 Apr (overheard) and 7 May (Ines, in passing). Two weak
  mentions of something people have said for a decade.
- **Cyber hiring shortage:** 17 Apr (overheard, unattributed), then 21 May, 2 Jul and 21 Jul
  — all Giles Overton. Looks like four mentions; is one named organisation plus a corridor
  conversation.

---

# Scoring

**Recall** — F1–F10 found, with correct citations.
**Precision** — T1–T4 not reported. T3 is the one that separates a usable system from a
plausible one.
**Grounding** — every finding cites note, date and speaker, and the quote appears verbatim
in the cited note. Uncited scores zero even when true.
**Independence** — F8 surfaced *with* the flag. Silently dropped or unflagged both fail.
**Silence** — run it over a quiet fortnight. It should return nothing.

A run that reports F1 and T3 with equal confidence is worse than one that reports neither.
