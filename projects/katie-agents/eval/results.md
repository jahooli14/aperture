# Run 1 — results

`node scripts/score.mjs`. Full output in `run-output.txt`.

```
SCORE  recall 14/14  |  traps fired 0/4  |  total findings 43
```

## What this actually tests, and what it doesn't

**It does not test extraction.** I wrote the corpus, planted the patterns, and then did
Layer 1 by hand knowing where everything was. `layer1/claims.tsv` is therefore a best case:
every quote is correctly typed, every subject correctly normalised, every person resolved
across a job change. A real Layer 1 run will be worse, and the gap between the two is
entirely untested here.

**It does test the detector design**, which is the half most likely to be wrong — thresholds,
guards, and whether the seven detectors produce the ten findings at all. That half was
wrong in seven places, all found by running it.

---

## What running it changed

| # | Bug | Fix |
|---|-----|-----|
| 1 | **T4 fired.** An overheard remark with no named speaker counted as one of the three organisations. | Convergence evidence must be attributed. `attribution` guard. |
| 2 | **T4 also fired** because an internal partner describing her own service line counted as market evidence. | Evidence must be external and a problem or a view, not a capability pitch. `externalOnly` guard. |
| 3 | **D4 missed F5 entirely.** The rule was "zero mentions in the later window"; one passing mention in an August note killed it. | Decline ratio plus no strongly-stated mention, rather than strict zero. |
| 4 | **D3 named the wrong first voice for F4.** It picked Ivan Kroll's vague March hunch ("more a feel") over Klaus, which then put Klaus 29 days later — one day under the 30-day threshold. F4 was missed. | A candidate first voice must have said it outright. Klaus now leads by 64 days. |
| 5 | **D5 produced 28 findings for 7 real matches** — one capability against N problems emitted N separate alerts, burying Duraflex↔Copperfield under Gareth Lowry's six. | Group by capability; one finding listing every matched need, ranked by sellable demand then by how long it sat. |
| 6 | **D1 and D3 fired on a junk cluster** because one subject conflated "we are their auditor" with "who owns Calloway". | Split the subject. Vocabulary hygiene is load-bearing. |
| 7 | **Fern Achebe echoed herself** — correct entity resolution across her job change, but she appeared in her own echo list. | Exclude the first voice's own person from echoes. |

Findings dropped from 66 to 43 in the process, with recall going **up**, not down.

---

## Guard ablation

All guards off, then re-enabled one at a time. This is the part that says whether the
guards in `AGENTS.md` earn their place, or are decoration.

```
all guards off        traps through: T2, T3, T4
  only provenance     blocks: T3
  only orgCount       blocks: T2
  only attribution    blocks: T4
  only subjectSense   blocks: T4
  only strength       blocks: -
  only externalOnly   blocks: -
```

**provenance and orgCount are each the sole defence against a trap.** Remove either and a
trap fires with everything else intact.

T3 is the one worth looking at. With provenance off:

```
[D1] Convergence (slow, full): Half of Lloyd's managing agents gone by 2030
     4 independent organisations, 4 claims
[D3] First voice: rupert-vance on Half of Lloyd's managing agents gone by 2030
     Led the next speaker by 57 days. Since echoed by 3: piotr-zawada, ivan-kroll, tobias-greer
```

The system reports the firm's own unsourced marketing number as a four-organisation market
trend, and then names the partner who published it as the man who called it early. That is
the failure the provenance field exists to prevent, and nothing else catches it.

**Two guards did not earn their place on this evidence.** `strength` and `externalOnly`
block nothing on their own — each is redundant with another guard for every trap here.
Keep them on (they cost nothing and the redundancy is cheap insurance), but they are not
justified by this corpus and `AGENTS.md` overstated them.

**T1 is not a real test as extracted.** It never fires, even with every guard off — two of
the three "GenAI" claims are typed `capability`, so D1's problem-or-view filter removes them
before any guard runs. A corpus that tested T1 properly would have three people *complaining*
about three different AI things.

---

## Known weaknesses the run exposed

**43 findings is not a weekly digest.** D6 alone emits 17 — every unclosed commitment and
every dormant account, every week, forever. It needs a decay rule or it becomes wallpaper
within a month. D1's 11 includes several true-but-dull clusters ("project cargo flow").
Ranking and a hard cap are missing from the spec.

**Every internal match rests on a hand-curated link.** 3 of 7 D5 findings — including
Teodora→cyber and Gareth→binder oversight — only connect because `subjects.tsv` declares
`forensic-attribution ~ cyber-war-attribution` and `managed-services-proposition ~
da-oversight-cost`. Client-to-client matching works on subject identity alone (Duraflex↔
Copperfield needs no link). Internal matching does not, because a practice describes what it
sells in different words from how a client describes what hurts.

That is a real operating cost: the subject vocabulary has to be maintained *with the
practices*, not derived from client notes alone. If nobody curates it, the internal half of
the system — which is most of its value at a firm this size — quietly stops working, and
fails silent rather than loud.
