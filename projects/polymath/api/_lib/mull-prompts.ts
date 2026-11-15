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
 * The shown line is a TAKE, not a question: a short claim the person can
 * agree with, push back on, or half agree with. A question that hides its
 * claim can't be pushed back on; said openly, a wrong claim is as useful as
 * a right one ("no, it's because...").
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
  /** Live project and latest captures. Context, not corpus. */
  focus?: string
  /** The project they're deep in, by exact title. Drives the crossing. */
  liveTitle?: string | null
  /** Others that matter this season, by exact title. */
  alsoTitles?: string[]
  /** Among those, the ones that can't be started yet. Thinking only. */
  waitingTitles?: string[]
  /** A season has been set (season.ts). Without one, no season-shaped
   *  instructions (the others, the wild one) are sent at all. */
  seasonActive?: boolean
  /** The nightly bake writes two drafts at once, each with its own lens, so
   *  the two don't write the same takes. */
  lens?: 'live' | 'elsewhere'
  /** One row this draft must start from, picked in code so each parallel
   *  draft covers different ground. */
  seedRef?: string
  /** The person's own words about what they want from takes (Settings). */
  brief?: string
  /** Leave out the worked examples: ~half the prompt, for the many small calls of the A/B swarm. */
  lean?: boolean
}

export function draftPrompt(ctx: DraftContext): string {
  const avoid = ctx.recentQuestions.length > 0
    ? `\nALREADY ASKED RECENTLY -- don't ask these again in new words:\n${ctx.recentQuestions.map(q => `- "${q}"`).join('\n')}\n`
    : ''
  const avoidRefs = ctx.recentRefs.length > 0
    ? `Recent questions were built on ${ctx.recentRefs.join(', ')}. Don't cite those rows.\n`
    : ''

  return `You are a curious, well-read friend who has listened to every voice note
this person has recorded. Below is their notebook: projects, voice notes, lists of
what they love. Each row has a ref like [N12] and a date.

${ctx.corpusText}

YOUR JOB
Give them something to think about on a walk. It sits on their home screen for
four days. Not a task, not advice, not a verdict on who they are, not about
finishing anything. A genuinely interesting thought that starts from one of theirs.

TWO KINDS -- mix them:
1. FROM THE WORLD. Pick something they were turning over -- an idea, a musing, a
   question they asked out loud, a line they loved -- and add ONE thing from the
   world they may not know: a real fact, a concept, a thinker, a bit of history or
   science, a work of art, that pushes their thought a step further or turns it on
   its head. End on the open end: a sharp question or a surprising claim.
2. TWO OF THEIRS. Two things they said, months apart and about unrelated things,
   that are secretly the same idea -- or that argue with each other. Put them side
   by side and say what the shared idea, or the argument, is.

WHAT MAKES ONE GOOD
- It starts from THEIR words: name what they said plainly and briefly, quoted
  close. Ideas, musings and asides are the best material -- a paradox, a word
  they liked, a question about how something works.
- The outside thing is not the obvious next fact. "Where does a snake's tail
  start? At the vent" answers the riddle and kills it. Pick the fact that opens
  it up.
- It leaves them with something to chew on. They should still be turning it over
  at the end of the walk.
- Their projects can come up, but never force one in. Most of the best ones won't
  mention a project at all.
- Under 55 words. Two or three short sentences, the way a friend would say it.

NEVER
- Anything from outside that you are not sure is true and well known. A wrong fact
  ruins it. If unsure, pick another. Every outside fact is checked against the
  web before they see it, and most that fail are not invented but OVERSTATED:
  "made it impossible" when it made it harder, "only" when it was mostly,
  "invented to" when nobody knows why. Say it the way an encyclopedia would:
  textbook facts, modest verbs, no absolutes.
- Psychoanalysis: what they feel, value, fear or "really" want. Never about their
  health, family, money or habits.
- Advice or tasks: "you should", "try", "make".
- Cleverness. No big-concept reframes (Gödel, Kolmogorov, "it's really just...")
  and no debunking what they liked. A plain, surprising, true fact about the thing
  itself beats a clever idea about it: "the stripes aren't for lions; horseflies
  crash into them" works, "a paradox is where logic itself runs out" doesn't.
- A summary of one note with nothing added.
- Two things that merely share a word. The shared idea has to be real.

${ctx.lean ? '' : `GOOD -- copy the move, never the wording:
${goodExamplesBlock()}

BAD -- shapes that fail:
${badExamplesBlock()}
`}${ctx.brief ? `WHAT THEY SAID THEY WANT FROM TAKES (their own words; it steers what you look for, and every rule above still holds):\n${ctx.brief}\n\n` : ''}${ctx.resonance}${ctx.corrections}${ctx.focus ?? ''}${avoid}${avoidRefs}
${PLAIN_ENGLISH_RULES}

WHAT TO RETURN
${ctx.seedRef ? `START FROM [${ctx.seedRef}]: your first candidate begins with that row. If nothing genuinely interesting comes from it, start from the nearest row that gives you one; a forced thought is worse than a different start.\n` : ''}Up to ${ctx.howMany} candidates, best first, each starting from a different row. For each:
- "noticing": under 12 words: what makes it interesting. Private.
- "doubt": under 10 words: the strongest reason it's obvious, forced or wrong.
  If the doubt wins, leave it out.
- "evidence": the row or rows of theirs it starts from, as { "ref": "N12",
  "quote": "4 to 10 words copied exactly from that row" }. Quotes are checked
  character for character. A wrong one kills the candidate.
- "outside": the fact from the world it adds, said plainly, or null.
- "take": what they see.
- "project": the exact title of a project it's about, or null (usually null).

Always return at least one candidate. Every quote must still be real.

JSON only:
{ "candidates": [ { "noticing": "", "doubt": "", "evidence": [ { "ref": "", "quote": "" } ], "outside": null, "take": "", "project": null } ] }`
}

function rowForJudge(r: CorpusRow): string {
  const text = r.text.length > 700 ? `${r.text.slice(0, 700)}…` : r.text
  return `    [${r.ref}] ${r.title ? `"${r.title}" ` : ''}(${r.meta}): ${text}`
}

export function judgePrompt(candidates: Grounded[], _liveTitle?: string | null, history = ''): string {
  const list = candidates.map((c, i) =>
    `#${i + 1}\n  SHOWN TO THEM: "${c.question}"\n  WHY IT'S INTERESTING: ${c.noticing || '(none given)'}\n  OUTSIDE FACT IT ADDS: ${c.outside || '(none)'}\n` +
    `  THE WRITER'S OWN DOUBT: ${c.doubt || '(none given)'}\n  BUILT ON:\n${c.rows.map(rowForJudge).join('\n')}`,
  ).join('\n\n')

  return `You are the last check before a thought reaches one person's home screen,
where it sits for four days to be mulled on a walk. Each starts from something they
said, and may add one fact from the world. Each comes with the full notes it was
built from.

${list}

${history ? `WHAT THEY HAVE ALREADY TOLD US -- one that rests on a premise they corrected, or
repeats a claim they said "no" to, gets truth 0:
${history.trim()}

` : ''}Score each from 0 to 10:
- "revelation": would they still be turning it over at the end of the walk? 10 =
  it changes how they see their own idea. 0 = obvious, or a summary of one note.
- "truth": is their side read right, in full? AND is any outside fact true and
  well known? If you are not sure the fact is true, score 3 or lower. 0 = wrong.
- "specific": does it start from something only they said, and go somewhere they
  wouldn't have gone alone? 0 = generic trivia or a thought anyone could have.
- "answerable": does it leave an open end worth chewing -- something they could
  say back? 0 = closed, a riddle, or a lecture.
- "overreach": true if it psychoanalyses them (a feeling, motive, value or trait),
  touches their health, family or habits, gives advice or a task, or links two
  things that only share a word. Always a kill.
Then "verdict": "ship" or "kill", and "reason": under 8 words.

Every one is shown in order of score, best first, so score honestly. Never
inflate. "verdict" is your gut call only; it doesn't remove anything.

JSON only:
{ "scores": [ { "n": 1, "revelation": 0, "truth": 0, "specific": 0, "answerable": 0, "overreach": false, "crosses": false, "verdict": "kill", "reason": "" } ] }`
}

/** Both take prompts as the model gets them, with a bracketed line where
 *  your real notes and recent takes go. Read-only, shown in Settings. */
export function previewTakePrompts(brief: string): { draft: string; judge: string } {
  const draft = draftPrompt({
    corpusText: '[YOUR CORPUS GOES HERE: every project, note, fragment, list item and good article, one row each, with a ref like [N12] and a date]',
    howMany: 2,
    recentQuestions: ['[your recent takes are listed here so it does not repeat them]'],
    recentRefs: [],
    resonance: '',
    corrections: '',
    brief: brief || undefined,
    liveTitle: '[your live project]',
    alsoTitles: [],
    seasonActive: false,
  })
  const sample = {
    question: '[a take the draft wrote]', noticing: '[what it noticed]', doubt: '[its own doubt]', evidence: [], stake: '', project: null, rows: [],
  } as unknown as Grounded
  return { draft, judge: judgePrompt([sample], '[your live project]') }
}
