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

  return `Below is everything one person has put into a notebook app for their creative
life: projects, voice notes, things said in passing, lists of what they love,
articles they finished. Each row has a ref like [N12] and a date.

${ctx.corpusText}

YOUR JOB
Find the few things in here they can't see from inside, and say each one to them
as a TAKE: a short, plain claim about their work that they can agree with or push
back on. It sits on their home screen for four days. They tap yes, no or sort of,
then say what they think out loud on a walk.

WHY A TAKE AND NOT A QUESTION
- A question makes them build an answer from nothing. A claim they can react to in
  a second, and a wrong claim is worth as much as a right one: "no, it's because..."
  is the best thing they can tell you.
- A question that hides a claim ("what part of X belongs strictly to you?") is a
  claim they can't push back on. Say it out in the open, where it can be wrong.
- So it must be able to be wrong. If nobody could disagree with it ("you care
  about balance", "you value finishing and starting"), it is not a take. Kill it.

WHAT COUNTS AS EVIDENCE
- Things they did, or said in passing: what stalled, what they kept, what they
  rated, a line from a note, how they described something then and now.
- Plans, next steps and intentions ("I'm going to...", "the plan is...") are what
  they mean to do, not what they showed. Use one only as the other half of a
  contrast with what actually happened. Never build on a plan alone.
- Reach across places. At least two of the rows must come from different projects,
  or from a project and something outside it (a note, a list, an article). Two
  notes from one project's own plan are one thought.

WHAT A REVELATION IS
- It's already in them, but they have never said it, even to themselves.
- It only shows when two or more things they captured -- often months apart, filed
  in different places -- are put side by side.
- Saying it out loud changes what they make or do next.
A claim that restates one note is a summary. One they already say every day is
a quote. One nobody could disagree with is a platitude. None of those.

${ctx.liveTitle ? crossingBlock(ctx.liveTitle, ctx.alsoTitles ?? [], !!ctx.seasonActive, ctx.waitingTitles ?? []) : ''}WHERE TO LOOK -- read everything first, then look for:
- The same stall: two projects that stopped at the same kind of step.
- The survivors: what the things they keep going back to share, that the
  dropped ones don't.
- Two names for one want: the same wish in unrelated places, in different words.
- A pull two ways: two things they said, both meant, that can't both be true.
- Taste against output: what they rate highest, against what they make.
- Drift: how they described something early on, and how they describe it now.
- The aside: a line said in passing under one project that fits all of them.
- The missing piece: a person, place or step every note circles and none names.
- The collision: a person or occasion in their life next to a skill, material or
  old project they already have. Neither note mentions the other; side by side
  they suggest something to make.
These are places to look, not boxes to fill. A real corpus holds two or three
genuine ones. Find those and leave the rest.

HOW TO WRITE IT
- Two parts: the facts side by side in THEIR words (short, a date only if it
  matters), and ONE claim under 15 words. Under 55 words in all. The claim stays
  the LAST sentence, but the facts can be told any way that is natural: a
  contrast, a count, a line of theirs, a date. Vary the shape from take to take.
- Never open with "You noted", "You said", "You wrote", "You mentioned" -- they
  read as a template. Open on the thing itself: the object, the date, the
  project, a quote. And don't end on "I think" every time: most claims should be
  said flat ("The toy is the only thing you started in a hurry."). Use "I think"
  only when the claim is a bold guess.
- Commit. No "perhaps", "maybe", "might", "seems", "sort of". A hedged claim gets
  no reaction.
- Make the claim about what they make, keep, drop or say. Never about how they
  feel or why: you can't see inside them. "I think you stop the moment someone
  else could see it" is about what happens. "You're afraid of being seen" is not.
- No "you value", "you love", "you care about", "you want", "you'd rather",
  "you let yourself" -- unless that exact word is in their notes. "I think you
  value ideas more than making them" is a motive. Say what happens instead:
  "I think nothing you start in an evening gets a second evening."
- Claims that work: "X stops when Y." "You only finish what Z." "A is really B."
  "Nothing you make looks like what you rate highest." "I think X." (rarely)
- A collision is a claim too. Not "you could make X for Y" but "I think the
  half-bound book is her wedding present." They can still say no.
- Each fact has to carry the claim. Three facts that don't point the same way
  are a list, not a pattern -- drop the one that doesn't.
- Don't explain it. No "which suggests", "this shows", "both are about", "it
  seems like". Name the pattern, don't theorise about it.
- Claim only what the rows support. If they could answer "that's not what I
  said", rewrite it.
- A title is not a note. A film, book, album or project title says nothing about
  its plot or what it contains; never claim what it holds, or what choosing it
  means about them. Use it only as "you rated X", "you added X".
- An order of dates is not a story. Don't say one note "came before" another, or
  what changed between them, unless the notes themselves say so.
- No diagnosing: nothing medical, emotional or about their relationships, even
  lightly. If it needs a theory about why, it isn't a take.
- Don't open with "For <project>, you planned..." or "You said you would...".
  Open with something that happened, or a line they said.
- They will hear it as speech. Short sentences, words they would use, no jargon of
  the project. No question mark -- the claim is the last sentence.
- Every name, number, date and title must be in the rows you cite. Don't count
  things you haven't counted.
- Lists and articles are taste, not their words. Name the film or the article;
  don't quote it as something they said.

${ctx.lean ? '' : `GOOD -- the evidence, then the take. Copy the move, never the wording:
${goodExamplesBlock()}

BAD -- shapes that have shipped before and failed:
${badExamplesBlock()}
`}${ctx.brief ? `WHAT THEY SAID THEY WANT FROM TAKES (their own words; it steers what you look for, and every rule above still holds):\n${ctx.brief}\n\n` : ''}${ctx.resonance}${ctx.corrections}${ctx.focus ?? ''}${avoid}${avoidRefs}
${PLAIN_ENGLISH_RULES}
(Those examples are about voice. The shape still follows HOW TO WRITE IT: facts,
then one committed claim, no question mark.)

WHAT TO RETURN
${ctx.seedRef ? `START FROM [${ctx.seedRef}]. Every candidate leans on that row plus at least one other row that looks nothing like it on the surface. If [${ctx.seedRef}] has no honest partner, start from the nearest row that does; a forced link is worse than a different start.\n` : ''}${ctx.lens === 'live' ? 'THIS ROUND: lean on the project they are deep in and the ones that matter this season.\n' : ctx.lens === 'elsewhere' ? 'THIS ROUND: stay away from the project they are deep in and the ones that matter this season. Find what runs across everything else: other projects, notes, list items. Prefer the two captures that look least alike on the surface.\n' : ''}Up to ${ctx.howMany} candidates, best first, each built on different rows. For each:
- "noticing": the pattern, under 12 words. Private -- they never see it.
- "doubt": under 10 words: the strongest reason this is a coincidence of
  wording, not something real, or that they would just say "no, that's not it".
  If the doubt wins, leave the candidate out.
- "evidence": every row the take leans on -- at least two different
  captures (a fragment and the note it was cut from count as one) --
  as { "ref": "N12", "quote": "4 to 10 words copied exactly from that row" }.
  Quotes are checked character for character. A wrong one kills the candidate.
- "take": what they see.
- "stake": under 12 words: what they would do differently if it's right. A real action.
- "project": the exact title of the project it's most about, or null.

Always return at least one candidate. If nothing here is strong, return the best
of what there is and let your doubt say so. Every quote must still be real.

JSON only:
{ "candidates": [ { "noticing": "", "doubt": "", "evidence": [ { "ref": "", "quote": "" } ], "take": "", "stake": "", "project": null } ] }`
}

/** The Venn: each person is a different overlap of things, and the middle is
 *  what only they can see. The best take here is the live project met with
 *  something else of theirs. */
function crossingBlock(title: string, also: string[], seasonActive: boolean, waiting: string[]): string {
  return `THE ONE THAT MATTERS MOST -- THE CROSSING
They are deep in "${title}" right now. A take from inside it only tells them
what they already know. The thing nobody else could say is where it overlaps with
the rest of them. Make your FIRST candidate a crossing:
- Put something they did or said about "${title}" next to something else of
  theirs: a note about another project, a person, a place, a habit, something
  that annoyed them. Neither mentions the other.
- Something from one of their lists counts too -- a film, book, album or place
  they chose. Name it; don't quote it as something they said.
- The best one is all three: the project, a note about something else, and a
  list item. Three unlike things that only meet in this one person. Look for that
  first, and settle for two only when three don't hold together.
- The claim is about "${title}": what it needs, what it's doing, what it is
  really about. They should be able to use it the next time they sit down to it.
- The other things must not be about "${title}" at all. If they are, it isn't a
  crossing.
- Someone else with the same project would have different notes and lists, so a
  crossing can only be theirs. That is the test.
Only if no crossing holds up, write the best take you honestly can. Never force
one: a false crossing is worse than none.
${seasonActive && also.length > 0 ? `
ALSO THIS SEASON: ${also.map(t => `"${t}"`).join(' and ')}. They matter too, just less. Where a real
one holds, make a candidate a crossing for each, built the same way (that project
next to something else of theirs). Leave one out rather than force it.
${waiting.length ? `They can't start ${waiting.map(t => `"${t}"`).join(' or ')} yet. A take about ${waiting.length > 1 ? 'those' : 'it'} is for thinking, never for doing: it
must not tell them to make, start, cut, buy or try anything, and its "stake" must not either.
` : ''}` : ''}${seasonActive ? `
THE WILD ONE: if one holds, include a candidate that is about NONE of the projects named
above. Two or three things of theirs that meet somewhere else entirely, cited from
rows that are not about those projects. It doesn't have to help anything, but it has to be
true and specific to them. The same honesty rules apply: their words, cited, nothing
invented. If nothing real holds, leave the wild one out. Never force it.
` : ''}
`
}

function rowForJudge(r: CorpusRow): string {
  const text = r.text.length > 700 ? `${r.text.slice(0, 700)}…` : r.text
  return `    [${r.ref}] ${r.title ? `"${r.title}" ` : ''}(${r.meta}): ${text}`
}

export function judgePrompt(candidates: Grounded[], liveTitle?: string | null): string {
  const list = candidates.map((c, i) =>
    `#${i + 1}\n  SHOWN TO THEM: "${c.question}"\n  CLAIMED PATTERN: ${c.noticing || '(none given)'}\n` +
    `  THE WRITER'S OWN DOUBT: ${c.doubt || '(none given)'}\n  BUILT ON:\n${c.rows.map(rowForJudge).join('\n')}`,
  ).join('\n\n')

  return `You are the last check before a take reaches one person's home screen,
where it sits for four days. They will tap yes, no or sort of, then say what they
think out loud on a walk. Each candidate below comes with the full notes it was
built from.

${list}

Score each from 0 to 10:
- "revelation": would reacting to it show them something about their own work
  or life they haven't put together -- a pattern, or two things of theirs that
  belong together? 10 = they'd stop walking. 0 = they already know, or it's a
  summary of one note.
- "truth": is the pattern really in those notes, read in full? Or is it two
  things that merely share a word, or a note read wrong? Weigh the writer's own
  doubt: if it's right, truth is low. 0 = forced or false.
- "specific": could only this person be shown this? 0 = it fits anyone.
- "answerable": could they react at once AND have something to say after? 0 = a
  platitude nobody could disagree with, or a riddle.
- "overreach": true if it says more than the notes show: a feeling, a motive or
  value put on them ("you value", "you're scared"), a reason WHY they did
  something that nobody gave, or a plan read back as if it were something they
  did. Naming a pattern in what happened ("stops whenever someone could see
  it") is not overreach -- that is the take's whole job, and it is allowed to
  be wrong. An overreaching take is always a kill, however sharp.
Kill it outright if all its evidence is one project's own plan or next steps,
even from two notes: that is a summary, not something side by side.
${liveTitle ? `- "crosses": true only if the take puts "${liveTitle}" next to a note or list item
  of theirs about something ELSE, with neither mentioning the other. A take built
  from things all about "${liveTitle}", or all about one other thing, is false.
  This only decides the order; it never makes a take ship.
` : ''}Then "verdict": "ship" or "kill", and "reason": under 8 words.

Every take is shown in order of score, best first, so score honestly: a weak
one gets a low number, not a kind one. Never inflate. "verdict" is your gut
call only; it doesn't remove anything.

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
