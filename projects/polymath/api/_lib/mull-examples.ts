/**
 * What the draft prompt learns from.
 *
 * Every GOOD example puts two or more things from a corpus next to each
 * other -- captured months apart, filed in different places -- and asks
 * about what sits underneath them. That is the mechanism the whole channel
 * now runs on. The old examples each replayed ONE note and asked about it,
 * and the channel faithfully produced one-note questions: summaries with a
 * question mark ("What is 'a piece they need to create'?").
 *
 * Each good example carries its evidence, so the model sees the move and
 * not just the result. They differ in more than subject -- a shared stall,
 * taste against output, drift, two names for one want -- because one
 * example is a template, not an example.
 *
 * Subject matter is deliberately foreign: letterpress, a choir, woodcuts, a
 * radio play. Nothing here may name anything the real corpus could
 * plausibly contain -- a fact invented here, handed over next to the real
 * corpus, arrives looking exactly like one the notes supplied.
 *
 * The BAD examples are the real failure shapes, moved onto foreign subjects
 * the same way. mull-examples.test.ts checks every good one clears the
 * gates against its own evidence and every bad one's shape is named.
 */

export interface ExampleEvidence {
  /** How the row appears in a corpus: kind, date, where it's filed. */
  where: string
  text: string
}

export interface MullExample {
  move: string
  evidence: ExampleEvidence[]
  question: string
  stake: string
}

export const GOOD_EXAMPLES: readonly MullExample[] = [
  {
    move: 'the same stall, in two projects that have nothing else in common',
    evidence: [
      { where: 'project "Letterpress wedding invites", paused, last touched 3 May 2025', text: 'stopped once the proofs came back' },
      { where: 'project "Sea shanty EP", paused', text: 'four songs demoed, never sent to anyone' },
      { where: 'note, 12 March 2025', text: 'I love the bit before anyone has seen it' },
    ],
    question: "The invites stopped once the proofs came back. The EP stopped at four demos, never sent to anyone. In March you said you love the bit before anyone has seen it. What changes about a thing for you once someone else has seen it?",
    stake: 'The next project gets shown to one person halfway through, on purpose, instead of never.',
  },
  {
    move: 'what they rate highest, against what they make',
    evidence: [
      { where: 'list "Films", rated 5', text: 'Paris, Texas' },
      { where: 'list "Books", rated 5', text: 'Stoner by John Williams' },
      { where: 'note, 2 June 2025', text: "everything I make has to be funny or I don't trust it" },
    ],
    question: "Your five-star shelf is Paris, Texas and Stoner. In June you said everything you make has to be funny or you don't trust it. What would you make if it was allowed to be sad?",
    stake: 'One sketch gets written with no joke in it.',
  },
  {
    move: 'the survivor against the dropped one -- the difference is the answer',
    evidence: [
      { where: 'project "Woodcut prints", active since 2022, last touched last week', text: 'one print, one evening, done' },
      { where: 'project "Oil portraits", paused since April 2025', text: 'needs another layer once it dries' },
    ],
    question: "The woodcuts have lasted three years: one print, one evening, done. The oil portraits have sat since April because each one needs another layer once it dries. What would an oil portrait look like if it had to be finished in one evening?",
    stake: 'One portrait gets painted wet-on-wet in a single sitting.',
  },
  {
    move: 'an aside under one project that describes all of them',
    evidence: [
      { where: 'fragment under "Birthday quiz"', text: 'the best rounds are the ones where people argue' },
      { where: 'note, 9 January 2025', text: 'the choir only clicks when someone disagrees with the arrangement' },
      { where: 'project "Solo album", paused', text: 'writing and recording everything myself this time' },
    ],
    question: "The best quiz rounds are the ones where people argue. The choir only clicks when someone disagrees with the arrangement. The album is everything yourself this time. Who gets to disagree with the album?",
    stake: 'One person hears the album demos this month and is asked to argue.',
  },
  {
    move: 'drift -- how the same thing is described early, and now',
    evidence: [
      { where: 'note, January 2024', text: 'the radio play is about my grandmother' },
      { where: 'note, August 2025', text: 'the radio play is really about the house' },
      { where: 'fragment under "Radio play", February 2026', text: 'the kitchen scenes are the only ones I reread' },
    ],
    question: "In January 2024 the radio play was about your grandmother. By August 2025 it was really about the house, and now the kitchen scenes are the only ones you reread. Where did she go?",
    stake: 'She gets a scene in the kitchen, or the play is renamed for the house.',
  },
  {
    move: 'two names for one want, in places that never touch',
    evidence: [
      { where: 'project "Garden studio", active', text: 'build a proper studio at the end of the garden' },
      { where: 'fragment under "Garden studio"', text: 'the kitchen table is where it actually happens' },
      { where: 'note, 18 July 2025', text: 'I want the tools out all the time, never packed away' },
    ],
    question: "You're building a proper studio at the end of the garden. You also said the kitchen table is where it actually happens, and that you want the tools out all the time. What does the kitchen table have that the studio drawings don't?",
    stake: 'The studio gets planned around a table that never gets cleared.',
  },
]

export interface BadExample {
  question: string
  why: string
}

/** The shapes the channel actually shipped, on foreign subjects. */
export const BAD_EXAMPLES: readonly BadExample[] = [
  {
    question: "Your outline centres on a keeper sorting through a lighthouse full of letters. What is 'the one thing the keeper has to find'?",
    why: 'Reads one note back and asks them to define their own phrase. Nothing is put next to it, so there is nothing to discover.',
  },
  {
    question: 'You wrote four months ago about new walking boots while working on the canal photos. Does the boots idea replace the project, or is it part of it?',
    why: 'A filing question. Answered in two seconds, changes nothing. Two things that happen to share a month are not a pattern.',
  },
  {
    question: 'You kept a note about bells while planning the harbour mural. Does the harbour sound loud or quiet at dawn?',
    why: 'The note never reaches the question. It could be asked of anyone and they would learn nothing about their own work.',
  },
  {
    question: 'Your love of ambient music and your pottery both seem to be about patience. How might patience shape your next piece?',
    why: 'Explains the link instead of showing it, and the link is a word, not a pattern. Nobody is surprised by their own answer.',
  },
]

export function goodExamplesBlock(): string {
  return GOOD_EXAMPLES.map(e =>
    `- ${e.move}\n` +
    e.evidence.map(ev => `    [${ev.where}] "${ev.text}"`).join('\n') +
    `\n  QUESTION: "${e.question}"\n  STAKE: "${e.stake}"`,
  ).join('\n\n')
}

export function badExamplesBlock(): string {
  return BAD_EXAMPLES.map(e => `- "${e.question}"\n  Why it fails: ${e.why}`).join('\n')
}
