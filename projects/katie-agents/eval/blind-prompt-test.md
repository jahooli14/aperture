# Blind prompt test — Opus 5, one prompt, no pipeline

Run once, [date of this session]. A fresh general-purpose agent (model: opus), with no
access to this repo beyond `corpus/*.md`, given a single well-written prompt and asked to
find the same five shapes of pattern described in `AGENTS.md`. Its output was then scored
against `answer-key.md` by the session that built both.

This is a genuine test against the claim that a coded, multi-detector pipeline is required.
It is not: it is honest evidence that a good prompt does most of the work, with specific,
checked gaps.

## Score

- **8 / 10** planted findings (F1–F10) found cleanly, fully cited.
- **1 partial** — F7 (Duraflex↔Copperfield) found with every fact correct, but classified
  as "not a pattern to report" under a 3+-organisation rule that the test prompt itself
  applied too bluntly to a two-party match. Arguably the prompt-writer's error, not the
  model's.
- **1 miss** — F9 (nobody owns Calloway). The quote is in the corpus, verified present. It
  requires joining two internal notes, months apart, sharing only an organisation's name
  and no topic — a pure structural join, not something a semantic read is well-suited to
  notice unprompted.
- **4 / 4 traps avoided**, including T3 (the firm's own report echoing back as market
  consensus) — the hardest one, caught with the correct mechanism named unprompted:
  *"Three people appearing to converge on a view all trace back to one organisation — your
  own firm ... that is the firm hearing its own echo."*
- **2 findings not in the answer key at all**: Saskia Boateng predates Klaus as the actual
  first mover (a real catch the corpus author missed when writing the key), and a
  cross-account policy-admin thread (Aldgate, Stanhope, Calloway) tied to a technology
  practice's stated capacity date — real, though its status as a *deliberately planted*
  signal versus a coincidence of writing style across fictional firms is genuinely unclear
  and stated as such.
- **All spot-checked quotes verbatim**, including ones in findings outside the answer key
  (checked by grep against the source notes, not eyeballed).

## What this changes

Two of the four claimed advantages of a coded pipeline over "just ask a good model" did not
survive this test and should not be repeated as if they still hold:

- "You can't write a prompt for what you don't know to ask" — wrong. One prompt, five
  named categories, all five worked.
- "An absence has nothing to retrieve" — wrong. Told explicitly to look for silences, it
  found the deadline-drops-off finding cleanly.

What held up, evidenced rather than asserted:

- The prompt that produced this result was real engineering — five categories, an explicit
  organisation-count threshold, an explicit instruction to name (not silently drop) a
  same-organisation false pattern, an explicit default to silence. That is close to a spec.
  Most of the value is in writing and maintaining *that*, not in a pipeline.
- One good run is not a validated process. This was run once. Whether it is stable week to
  week — whether T3 gets caught every time, not just this time — is untested, and is
  precisely what a scored harness against a fixed answer key is for.
- It missed the one finding that needs no semantic reasoning at all, only a join on
  organisation name across unrelated internal notes. Cheap to catch in code, free of any
  model call, and a careful prose read still slid past it.

## Recommendation this changes

Build order revised: start with the prompt above (see `demo/throughline.html`, "The prompt
we actually used"), not a coded pipeline. Add code only for what this test actually
exposed — a structural join on organisation name across internal notes, and a periodic
re-run against this same corpus to catch drift a single good result can't reveal.
