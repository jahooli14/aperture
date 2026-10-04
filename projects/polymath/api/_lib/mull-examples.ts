/**
 * What the draft prompt learns from.
 *
 * The shown line is a take: facts side by side, then one committed claim
 * they can agree or disagree with. (The field is still called `question` in
 * the types; renaming it would touch every caller for no gain.)
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
 * radio play, bookbinding. Nothing here may name anything the real corpus could
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
    question: "The invites stopped once the proofs came back. The EP stopped at four demos, never sent to anyone. In March you said you love the bit before anyone has seen it. I think your projects die the moment someone else could see them.",
    stake: 'The next project gets shown to one person halfway through, on purpose, instead of never.',
  },
  {
    move: 'what they rate highest, against what they make',
    evidence: [
      { where: 'list "Films", rated 5', text: 'Paris, Texas' },
      { where: 'list "Books", rated 5', text: 'Stoner by John Williams' },
      { where: 'note, 2 June 2025', text: "everything I make has to be funny or I don't trust it" },
    ],
    question: "Your five-star shelf is Paris, Texas and Stoner. In June you said everything you make has to be funny or you don't trust it. Nothing you make looks like anything you rate highest.",
    stake: 'One sketch gets written with no joke in it.',
  },
  {
    move: 'the survivor against the dropped one -- the difference is the answer',
    evidence: [
      { where: 'project "Woodcut prints", active since 2022, last touched last week', text: 'one print, one evening, done' },
      { where: 'project "Oil portraits", paused since April 2025', text: 'needs another layer once it dries' },
    ],
    question: "The woodcuts have lasted three years: one print, one evening, done. The oil portraits have sat since April because each one needs another layer once it dries. I think you only keep what you can finish in one sitting.",
    stake: 'One portrait gets painted wet-on-wet in a single sitting.',
  },
  {
    move: 'an aside under one project that describes all of them',
    evidence: [
      { where: 'fragment under "Birthday quiz"', text: 'the best rounds are the ones where people argue' },
      { where: 'note, 9 January 2025', text: 'the choir only clicks when someone disagrees with the arrangement' },
      { where: 'project "Solo album", paused', text: 'writing and recording everything myself this time' },
    ],
    question: "The best quiz rounds are the ones where people argue. The choir only clicks when someone disagrees with the arrangement. The album is everything yourself this time. Nobody gets to argue with the album.",
    stake: 'One person hears the album demos this month and is asked to argue.',
  },
  {
    move: 'drift -- how the same thing is described early, and now',
    evidence: [
      { where: 'note, January 2024', text: 'the radio play is about my grandmother' },
      { where: 'note, August 2025', text: 'the radio play is really about the house' },
      { where: 'fragment under "Radio play", February 2026', text: 'the kitchen scenes are the only ones I reread' },
    ],
    question: "In January 2024 the radio play was about your grandmother. By August 2025 it was really about the house, and now the kitchen scenes are the only ones you reread. I think she's already out of it.",
    stake: 'She gets a scene in the kitchen, or the play is renamed for the house.',
  },
  {
    move: 'two names for one want, in places that never touch',
    evidence: [
      { where: 'project "Garden studio", active', text: 'build a proper studio at the end of the garden' },
      { where: 'fragment under "Garden studio"', text: 'the kitchen table is where it actually happens' },
      { where: 'note, 18 July 2025', text: 'I want the tools out all the time, never packed away' },
    ],
    question: "You're building a proper studio at the end of the garden. You also said the kitchen table is where it actually happens, and that you want the tools out all the time. I think you don't want a studio. You want a table you never have to clear.",
    stake: 'The studio gets planned around a table that never gets cleared.',
  },
  {
    move: 'the collision -- an occasion in their life next to something half-made',
    evidence: [
      { where: 'note, 4 February 2026', text: 'my sister gets married in May and wants everything handmade' },
      { where: 'project "Bookbinding", paused since November 2025', text: 'stitched one signature, then stopped' },
      { where: 'note, 20 August 2025', text: 'I only finish things when someone is waiting for them' },
    ],
    question: "Your sister gets married in May and wants everything handmade. The bookbinding stopped after one stitched signature. You only finish things when someone is waiting for them. I think the half-bound book is her wedding present.",
    stake: 'The guest book for the wedding gets bound, starting from the stitched signature.',
  },
]

export interface BadExample {
  question: string
  why: string
}

/** The shapes the channel actually shipped, on foreign subjects. */
export const BAD_EXAMPLES: readonly BadExample[] = [
  {
    question: 'You finish some things and drop others. I think you care about balance.',
    why: 'A platitude. Nobody could disagree with it, so there is nothing to react to, and it fits anyone.',
  },
  {
    question: 'The album stopped after four demos and never went to anyone. I think you are afraid of being heard.',
    why: 'Reads a feeling off a gap. The app can see what they dropped, not what they feel. The take is about what happens, never why they feel it.',
  },
  {
    question: 'The invites stalled at proofs. The EP stalled at demos. Maybe it could be that you might stop when it gets real.',
    why: 'Hedged three times. A claim nobody could be wrong about gets no reaction.',
  },
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
  {
    question: "For the radio play, you planned to have an actor read the grief scene, then record every line yourself so it sounds like you. What part of the grief belongs strictly to your own voice?",
    why: "Both rows are one project's plan, so nothing is put next to anything. It opens by reciting the plan, and the question hides a claim (the grief isn't already theirs) that nobody made and they can't push back on.",
  },
  {
    question: 'One card per idea was meant to stop the binders piling up. The sketch-a-day stopped after day one. In May you said ideas are worth more than gold. I think you value dreaming up projects far more than making them.',
    why: "Three facts that point three ways, the first one a plan. And the claim says what they value -- a motive nobody gave. Say what happens instead: what stopped, and when.",
  },
]

export function goodExamplesBlock(): string {
  return GOOD_EXAMPLES.map(e =>
    `- ${e.move}\n` +
    e.evidence.map(ev => `    [${ev.where}] "${ev.text}"`).join('\n') +
    `\n  TAKE: "${e.question}"\n  STAKE: "${e.stake}"`,
  ).join('\n\n')
}

export function badExamplesBlock(): string {
  return BAD_EXAMPLES.map(e => `- "${e.question}"\n  Why it fails: ${e.why}`).join('\n')
}
