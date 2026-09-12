# Katie agents

A sample corpus and the agent system reverse-engineered from it.

The problem: a business development person meets senior people, writes notes, and forgets
them. The connections worth money are between things said months apart by people who don't
know each other. She is good at the live join and structurally cannot do the March-to-August
one.

## What's here

| | |
|---|---|
| `corpus/` | 200 meeting notes. Six months (16 Mar – 11 Sep 2026), 22 fictitious client organisations, one boutique specialty insurance advisory. ~35% is genuine noise — expenses, parking fines, cancelled lunches. |
| `calendar.md` | Two weeks of upcoming meetings. The second input. |
| `eval/answer-key.md` | What's buried in the corpus. Ten findings to hit, three traps to avoid. Ground truth. |
| `AGENTS.md` | **The deliverable.** The system, derived component by component from what the answer key demands. |
| `scripts/corpus-stats.sh` | Corpus facts, computed not asserted. |

## The point of the corpus

It is a test fixture with a known answer. Ten patterns were planted deliberately, each
requiring a different kind of reasoning to find, and none stated anywhere in the notes.
Three traps were planted alongside them — things that look like patterns and aren't.

That means any proposed agent can be scored rather than admired. Change a prompt, re-run,
count how many of the ten it found and whether it fell for any of the three.

The single finding that justifies the whole build: on 24 March a risk manager describes a
£2.8m programme he can't place. On 19 August an MGA describes the exact capability, and
needs exactly that kind of client. 148 days apart, no shared vocabulary, never mentioned in
the same note. The corpus author notices on 21 August and writes: *"I'd stopped thinking
about March."*

## Reading order

1. `eval/answer-key.md` — what's in there and why each bit is hard.
2. `AGENTS.md` — what the system has to look like as a result.
3. `corpus/` — spot-check a few. Start with `2026-03-24-duraflex-graham-tull.md` and
   `2026-08-19-copperfield-ed-battery.md`.

All names, firms and events are invented.
