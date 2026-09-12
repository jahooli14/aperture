# Katie agents

A sample corpus and the agent system reverse-engineered from it.

**The person:** business development in the specialty insurance practice of a large
professional services firm. She meets very senior people at carriers, syndicates, MGAs,
brokers, reinsurers and corporate risk buyers, hears their problems, and connects them to
the partner or practice that can solve them.

**The problem:** she writes the notes and then forgets them. The connections worth money sit
between things said months apart by people who don't know each other — and, at a firm this
size, between a client's problem and a colleague's capability that was mentioned once in a
coffee in March.

## What's here

| | |
|---|---|
| `corpus/` | 200 notes. Six months (16 Mar – 11 Sep 2026), 22 fictitious client organisations plus the internal firm. About 40% is genuine noise — timesheets, mandatory training, parking fines, `-`. |
| `calendar.md` | Two weeks ahead. Client and internal meetings both. |
| `eval/answer-key.md` | What's buried in the corpus. Ten findings to hit, four traps to avoid. Ground truth. |
| `AGENTS.md` | **The design.** Seven detectors, four gates, derived component by component from what the answer key demands — updated with what actually running them found. |
| `layer1/` | The corpus, hand-extracted into structured claims, accounts and commitments — what a real capture pipeline would produce automatically. |
| `scripts/detect.mjs` | The seven detectors, as deterministic code, run against `layer1/`. |
| `scripts/score.mjs` | Scores a detector run against the answer key — recall on the ten findings, precision on the four traps, plus a guard ablation. |
| `scripts/corpus-stats.sh` | Corpus facts, computed not asserted. |
| `eval/results.md` | Run 1: 14/14 recall, 0/4 traps, and the seven bugs the run found that the design alone didn't catch. |
| `demo/throughline.html` | A working mock-up of the weekly digest and meeting prep, built from Run 1's actual output — not a wireframe. |

## The point of the corpus

It's a test fixture with a known answer. Ten patterns were planted deliberately, each needing
a different kind of reasoning, none stated anywhere in the notes. Four traps were planted
alongside them — things that look like patterns and aren't.

That means any proposed agent can be scored rather than admired. Change a prompt, re-run,
count what it found and whether it fell for anything.

**Two findings make the case.** On 24 March a risk manager describes a £2.8m programme he
can't place. On 19 August an MGA describes exactly that capability and needs exactly that
client — 148 days apart, no shared vocabulary, never in the same note. And on 24 March an
actuarial partner describes a diagnostic she's built and can't find buyers for; four clients
ask for precisely it between June and September, one of them in writing.

The corpus author notices the first one herself, too late, and writes it down on 21 August:
*"by August I had stopped thinking about March. We have four hundred of these conversations a
year across the sector team and no memory of any of them beyond whoever was in the room."*

**Three things only this setting produces.** An internal capability sitting idle while the
demand accumulates in someone else's notes. A best-qualified opportunity that independence
rules make unsellable, which must be surfaced flagged rather than dropped. And the firm's own
market report echoing back from three clients five weeks after the breakfast briefing, looking
exactly like a market trend.

## Reading order

1. `eval/answer-key.md` — what's in there and why each bit is hard.
2. `AGENTS.md` — what the system has to look like as a result.
3. `corpus/` — spot-check. Start with `2026-03-24-duraflex-graham-tull.md`,
   `2026-03-24-internal-saskia-boateng.md`, `2026-08-19-copperfield-ed-battery.md`.
4. `eval/results.md` — run `node scripts/score.mjs` yourself, or read what running it once
   already found: the design was wrong in seven places, all of them bugs that made findings
   disappear or traps fire, none of them things a read-through of `AGENTS.md` alone caught.
5. `demo/throughline.html` — what it looks like on a Monday. Every quote in it is checked
   verbatim against the note it cites (word-for-word; a bracketed letter marks the one
   allowed edit — capitalising a quote lifted from mid-sentence). Two entries are drawn from
   narration rather than speech and are labelled as such rather than styled like a quote.

All names, firms, partners and events are invented. The firm itself is deliberately unnamed.
