/**
 * The two prompts the mull channel runs on. Pure strings, no IO.
 *
 * DRAFT reads the whole corpus and proposes candidate questions, each built
 * on two or more rows it cites by ref. The rule it is built around: a
 * revelation is something the person already knows and has never said,
 * and it only comes into view when things they captured apart are put
 * side by side. One note read back is a summary with a question mark --
 * which is exactly what the old one-quote channel produced.
 *
 * JUDGE reads the survivors against their FULL evidence rows and scores
 * them, harshly. Taste lives here, not in regexes: whether a question
 * would stop someone on a walk is not a property of its words.
 */

import { PLAIN_ENGLISH_RULES } from './plain-english.js'
import { goodExamplesBlock, badExamplesBlock } from './mull-examples.js'
import type { CorpusRow } from './mull-corpus.js'
import type { Grounded } from './mull.js'

export interface DraftContext {
  corpusText: string
  howMany: number
  /** Recent questions, verbatim. */
  recentQuestions: string[]
  /** Rows a recent question was already built on. */
  recentRefs: string[]
  /** Questions that got a real answer, and what came back. */
  resonance: string
  /** Premises earlier questions got wrong, in their words. */
  corrections: string
}

export function draftPrompt(ctx: DraftContext): string {
  const avoid = ctx.recentQuestions.length > 0
    ? `\nALREADY ASKED RECENTLY -- don't ask these again in new words:\n${ctx.recentQuestions.map(q => `- "${q}"`).join('\n')}\n`
    : ''
  const avoidRefs = ctx.recentRefs.length > 0
    ? `Recent questions were built on ${ctx.recentRefs.join(', ')}. Don't cite those rows.\n`
    : ''

  return `Below is everything one person has put into a notebook app for their creative
life: projects, voice notes, things said in passing, lists of what they love,
articles they finished. Each row has a ref like [N12] and a date.

${ctx.corpusText}

YOUR JOB
Find the few things in here they can't see from inside, and ask about each one
so that they see it. The question sits on their home screen for four days. They
carry it around and answer it out loud on a walk.

WHAT A REVELATION IS
- The answer is already in them, but they have never said it, even to themselves.
- It only shows when two or more things they captured -- often months apart,
  filed in different places -- are put side by side.
- Saying the answer out loud changes what they make or do next.
A question answerable from one note alone is a summary. One they can answer in
five seconds is a quiz. One with no answer is a riddle. None of those.

WHERE TO LOOK -- read everything first, then look for:
- The same stall: two projects that stopped at the same kind of step.
- The survivors: what the things they keep going back to share, that the
  dropped ones don't.
- Two names for one want: the same wish in unrelated places, in different words.
- A pull two ways: two things they said, both meant, that can't both be true.
- Taste against output: what they rate highest, against what they make.
- Drift: how they described something early on, and how they describe it now.
- The aside: a line said in passing under one project that fits all of them.
- The missing piece: a person, place or step every note circles and none names.
These are places to look, not boxes to fill. A real corpus holds two or three
genuine ones. Find those and leave the rest.

HOW TO ASK
- Lay the evidence side by side in THEIR words, short, with when if it matters.
  Then ask. Two to four short sentences, under 60 words.
- Never say what the pattern means. No "which suggests", "this shows", "both
  are about", "it seems like". Putting the things next to each other is the
  whole move -- they make the connection, and that is the revelation.
- Ask about what sits under the evidence, not about the evidence. Not "what is
  X?" but "what does X have that Y doesn't?", "where did X go?", "who was X
  for?", "what would X look like if it had to be like Y?".
- The question sentence starts with What, Which, Who, Where, When, Why or How.
  Never yes/no. Never "X, or Y?".
- Talk about the work. You can't see whether they are avoiding, scared or stuck.
- Every name, number, date and title in the question must be in the rows you
  cite. Don't count things you haven't counted.
- Lists and articles are taste, not their words. Name the film or the article;
  don't quote it as something they said.

GOOD -- the evidence, then the question. Copy the move, never the wording:
${goodExamplesBlock()}

BAD -- shapes that have shipped before and failed:
${badExamplesBlock()}
${ctx.resonance}${ctx.corrections}${avoid}${avoidRefs}
${PLAIN_ENGLISH_RULES}
(Those examples are about voice. The question's shape still follows HOW TO ASK:
open, never yes/no, never "X, or Y?".)

WHAT TO RETURN
Up to ${ctx.howMany} candidates, best first, each built on different rows. For each:
- "noticing": the pattern, in one plain sentence. Private -- they never see it.
- "doubt": the strongest reason this is a coincidence of wording, not something
  real. If the doubt wins, leave the candidate out.
- "evidence": every row the question leans on -- at least two different
  captures (a fragment and the note it was cut from count as one) --
  as { "ref": "N12", "quote": "4 to 15 words copied exactly from that row" }.
  Quotes are checked character for character. A wrong one kills the candidate.
- "question": what they see.
- "stake": what they would do differently once they've answered. A real action.
- "project": the exact title of the project it's most about, or null.

If nothing in here holds a real one, return an empty list. An honest nothing is
better than a forced question.

JSON only:
{ "candidates": [ { "noticing": "", "doubt": "", "evidence": [ { "ref": "", "quote": "" } ], "question": "", "stake": "", "project": null } ] }`
}

function rowForJudge(r: CorpusRow): string {
  const text = r.text.length > 700 ? `${r.text.slice(0, 700)}…` : r.text
  return `    [${r.ref}] ${r.title ? `"${r.title}" ` : ''}(${r.meta}): ${text}`
}

export function judgePrompt(candidates: Grounded[], loose: boolean): string {
  const list = candidates.map((c, i) =>
    `#${i + 1}\n  QUESTION: "${c.question}"\n  CLAIMED PATTERN: ${c.noticing || '(none given)'}\n  BUILT ON:\n${c.rows.map(rowForJudge).join('\n')}`,
  ).join('\n\n')

  return `You are the last check before a question reaches one person's home screen,
where it sits for four days for them to carry around and answer on a walk.
Each candidate below comes with the full notes it was built from.

${list}

Score each from 0 to 10:
- "revelation": would answering it tell them something about their own work
  they haven't put into words? 10 = they'd stop walking. 0 = they already know,
  or it's a summary of one note.
- "truth": is the pattern really in those notes, read in full? Or is it two
  things that merely share a word, or a note read wrong? 0 = forced or false.
- "specific": could only this person be asked this? 0 = anyone could.
- "answerable": can they answer it from their own life in a few minutes of
  thought? 0 = a riddle, or a quiz answered in five seconds.
Then "verdict": "ship" or "kill", and "reason": one plain sentence.

${loose
    ? 'This is a second pass after nothing better was found, so ship anything true and askable -- but never anything false.'
    : 'Be harsh. Most candidates should be killed. They would rather see nothing than a clever-sounding question that doesn\'t land.'}

JSON only:
{ "scores": [ { "n": 1, "revelation": 0, "truth": 0, "specific": 0, "answerable": 0, "verdict": "kill", "reason": "" } ] }`
}
