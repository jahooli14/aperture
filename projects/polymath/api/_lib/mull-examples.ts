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
    move: 'a line meets a project -- who it is for',
    evidence: [
      { where: 'note, 2 April 2025', text: 'the quilt got done because Nan was coming at Easter' },
      { where: 'project "Rag rug", started January 2025, never touched since', text: 'just something to have around' },
    ],
    question: 'The quilt only got finished because Nan was coming at Easter. The rag rug is just something to have around. Who is the rug for?',
  },
  {
    move: 'two lines cross -- the same move, opposite directions',
    evidence: [
      { where: 'project "Ferry play"', text: 'every scene ends back at the harbour' },
      { where: 'project "Lighthouse stories"', text: 'each story starts one island further out' },
    ],
    question: 'Every scene of the ferry play ends back at the harbour. Each lighthouse story starts one island further out. Are they one story told in opposite directions?',
  },
  {
    move: 'a line meets a project -- taste against what they make',
    evidence: [
      { where: 'on their "Films" list, rated 5', text: 'Rear Window' },
      { where: 'note, 14 January 2026, about "Ferry play"', text: 'the second act keeps explaining itself' },
    ],
    question: "Rear Window is your five-star film, and nobody in it explains anything. The ferry play's second act keeps explaining itself. What would the captain do if she couldn't speak?",
  },
  {
    move: 'two lines cross -- what they say about one thing, against another',
    evidence: [
      { where: 'note, 5 April 2024', text: 'a good map is one that leaves things out' },
      { where: 'note, 20 August 2025', text: 'I want every recipe written down exactly, no guessing' },
    ],
    question: 'A good map leaves things out. Every recipe has to be written down exactly, no guessing. Is a recipe a map, or the opposite of one?',
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
