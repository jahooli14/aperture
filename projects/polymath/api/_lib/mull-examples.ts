/**
 * What the draft prompt learns from (Nov 2026).
 *
 * A take is something to think about on a walk: one of their ideas taken a
 * step further with a fact from the world, or two of their ideas that turn
 * out to be the same one (or to argue). The owner picked 7 of 8 of these in
 * a blind test, against 2 of 8 for the old "facts, then a claim about you"
 * shape and the "move for a stalled project" shape.
 *
 * Subject matter is deliberately foreign -- a fact invented here, handed over
 * next to the real corpus, arrives looking exactly like one the notes
 * supplied -- and every outside fact here is true. mull-examples.test.ts runs
 * each good one through the gates.
 */

export interface ExampleEvidence {
  /** How the row appears in a corpus: kind, date, where it's filed. */
  where: string
  text: string
}

export interface MullExample {
  move: string
  evidence: ExampleEvidence[]
  /** The fact from the world it adds, if any. Must be true. */
  outside?: string
  question: string
}

export const GOOD_EXAMPLES: readonly MullExample[] = [
  {
    move: 'from the world -- a musing of theirs, and the fact that opens it up',
    evidence: [{ where: 'note, 3 March 2025', text: 'why does the bridge hum when the wind gets up' }],
    outside: 'In 1940 the Tacoma Narrows bridge twisted itself apart in a steady wind, no storm needed.',
    question: 'You wondered why the bridge hums when the wind gets up. In 1940 the Tacoma Narrows bridge twisted itself apart in a steady wind, no storm needed. What else is fine until the wind finds its note?',
  },
  {
    move: 'from the world -- a thing they love, turned on its head',
    evidence: [{ where: 'note, 9 June 2025', text: 'the best bit of a jigsaw is the last missing piece' }],
    outside: 'Japanese kintsugi mends broken bowls with gold, so the crack becomes the part you look at.',
    question: "You said the best bit of a jigsaw is the last missing piece. Japanese kintsugi mends broken bowls with gold, so the crack becomes the part you look at. Is the gap the point, not the picture?",
  },
  {
    move: 'from the world -- a line from their list',
    evidence: [{ where: 'on their "Lines" list, added 2 May 2025', text: 'the sea is the same sea everywhere' }],
    outside: 'Before satellites, sailors found how far east or west they were by carrying the time of home in a clock.',
    question: "You kept the line 'the sea is the same sea everywhere'. Sailors once worked out where they were on it by carrying the time of home in a clock. Is the sameness what lets you measure the distance?",
  },
  {
    move: 'two of theirs -- the same idea, said about unrelated things months apart',
    evidence: [
      { where: 'note, 14 March 2025', text: 'love that bread makes you wait and do nothing' },
      { where: 'note, 2 October 2025', text: 'the best bit of the quiz is when nobody knows' },
    ],
    question: "In March, bread was good because it makes you wait and do nothing. In October, the quiz was best when nobody knew the answer. Each time, the good part is the bit you can't hurry.",
  },
  {
    move: 'two of theirs -- two things they said that argue with each other',
    evidence: [
      { where: 'note, 5 April 2024', text: 'a good map is one that leaves things out' },
      { where: 'note, 20 August 2025', text: 'I want every recipe written down exactly, no guessing' },
    ],
    question: 'In April 2024 a good map was one that leaves things out. In August 2025 every recipe had to be written down exactly, no guessing. Is a recipe a map, or the opposite of one?',
  },
]

export interface BadExample {
  question: string
  why: string
}

/** The shapes that fail, on foreign subjects. */
export const BAD_EXAMPLES: readonly BadExample[] = [
  {
    question: "You wondered where a snake's tail starts. It starts at the vent, where the organs end.",
    why: 'The obvious fact. It answers their riddle and kills it -- there is nothing left to think about.',
  },
  {
    question: 'You love paradoxes and you love closing loops. I think you are scared of loose ends.',
    why: 'Psychoanalysis. It puts a feeling on them nobody gave, and it is about them, not the idea.',
  },
  {
    question: 'You liked the silent letter in "subtle". You should start a collection of silent letters.',
    why: 'Advice. A task is not a thought, and it ends the walk instead of starting one.',
  },
  {
    question: 'You mentioned ripples on the pond and a ripple effect at work. Both have ripples in them.',
    why: 'Two things that only share a word. The shared idea has to be real.',
  },
  {
    question: 'You said the cleverest thing is to leave things unsaid. Leaving things unsaid really is clever.',
    why: 'A summary of one note with nothing added. They already know what they said.',
  },
  {
    question: 'You liked the line about the sea. Borges wrote a story about a sea that remembers every ship.',
    why: 'An invented fact dressed as a real one. A wrong fact ruins the whole thing; if unsure, pick another.',
  },
  {
    question: 'You finish some things and drop others. I think you care about balance.',
    why: 'A platitude about who they are. Nobody could disagree with it, so there is nothing to think about.',
  },
]

export function goodExamplesBlock(): string {
  return GOOD_EXAMPLES.map(e =>
    `- ${e.move}\n` +
    e.evidence.map(ev => `    [${ev.where}] "${ev.text}"`).join('\n') +
    (e.outside ? `\n    OUTSIDE: ${e.outside}` : '') +
    `\n  SHOWN: "${e.question}"`,
  ).join('\n\n')
}

export function badExamplesBlock(): string {
  return BAD_EXAMPLES.map(e => `- "${e.question}"\n  Why it fails: ${e.why}`).join('\n')
}
