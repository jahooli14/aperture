/**
 * The examples the draft prompt learns from.
 *
 * There were two of these — one good, one bad — and the channel's first real
 * question came out as a copy of the good one's skeleton: play back a quote,
 * "but", name a second thing, ask something abstract. One example is not an
 * example, it is a template. So there are ten, and they deliberately differ
 * in more than subject: some end in a choice, some in a name, some in a
 * counterfactual, some ask for a fact the user has and the corpus doesn't.
 *
 * `shape` says what each one is demonstrating. It is in the prompt on
 * purpose — the model reads ten questions that are not variations of each
 * other and infers that variety is the point, which is the thing a single
 * example can never teach.
 *
 * Every one of these passes `rejectionReason` (mull-examples.test.ts checks
 * it). An example the gates would throw away teaches the model to write
 * questions the gates throw away.
 */
export interface MullExample {
  /** What the shape is, in a few words. */
  shape: string
  text: string
  /** The connector's own words the question leans on. */
  quote: string
  /** What the user would DO differently depending on the answer. */
  stake: string
}

export const MULL_EXAMPLES: readonly MullExample[] = [
  {
    shape: 'a conviction held for years, against what actually gets made',
    text: "You've said since March 2023 that the best stuff happens when nobody's recording. Every project on your list ends in a file. What's the one that doesn't?",
    quote: "the best stuff happens when nobody's recording",
    stake: 'He starts the one project with no output file.',
  },
  {
    shape: 'ends in a choice, not an interpretation',
    text: 'You wrote that your dad remembers the shed but not the year. The bio has four chapters and all of them are in order. Which one would you put first if the order did not matter?',
    quote: 'remembers the shed but not the year',
    stake: 'Chapter three opens the book.',
  },
  {
    shape: 'a rhythm that stopped; the answer is a name',
    text: "The mixes stopped in August and nothing replaced them. You wrote in June that you only practise when someone's coming over. Who was coming?",
    quote: "you only practise when someone's coming over",
    stake: 'He books the next one before he records.',
  },
  {
    shape: 'two things captured days apart and never put together',
    text: 'On the 3rd you wanted a room where nothing gets thrown away. On the 6th you wrote that the flat only works because you bin everything on Sundays. Which one is the studio?',
    quote: 'the flat only works because you bin everything on Sundays',
    stake: 'The spare room gets shelves or gets emptied.',
  },
  {
    shape: 'a burst that stopped dead — asks for a fact the corpus does not hold',
    text: 'For one week in February you wrote about the coasters every day, then never again. Nothing says you decided against them. What happened that week that is not written down?',
    quote: 'wrote about the coasters every day',
    stake: 'The coasters come back on the list or come off it.',
  },
  {
    shape: 'an article as the lens; the question is a counterfactual',
    text: 'You kept a piece about restorers leaving the damage visible. You rewrite chapter nine every time you open it. What would leaving it visible look like?',
    quote: 'restorers leaving the damage visible',
    stake: 'Chapter nine ships with the seam showing.',
  },
  {
    shape: 'reading as register, never quoted — lists are not the user\'s words',
    text: "You've been reading about people who make one thing for forty years. Your list has nine things on it, all under a year old. What's the one you'd still be doing in ten?",
    quote: 'people who make one thing for forty years',
    stake: 'Eight things come off the list.',
  },
  {
    shape: 'a return after silence; a real either/or with a different action each way',
    text: 'The bio was silent fourteen months and you picked it up last Tuesday. Before you stopped you wrote that you did not have the ending. Do you have it now, or did you miss the work?',
    quote: 'you did not have the ending',
    stake: 'He writes the ending this week, or admits he wanted the company.',
  },
  {
    shape: 'vocabulary that drifted between early captures and late ones',
    text: 'Two years ago you wrote about making things for people. This year you write about finishing things. Nobody is named in the recent ones. Who is the next one for?',
    quote: 'making things for people',
    stake: 'The next project gets a person attached before a deadline.',
  },
  {
    shape: 'said repeatedly, never became a project; the question is the first small move',
    text: "You've written four times since 2023 that you want to record your mum's stories, and it has never become a project. Each time you wrote it down and then wrote something else. What would you ask her first?",
    quote: "you want to record your mum's stories",
    stake: 'He phones her and records the call.',
  },
]

/** The examples as the prompt sees them. */
export function examplesBlock(): string {
  return MULL_EXAMPLES.map(
    e => `- ${e.shape}\n  "${e.text}"\n  stake: "${e.stake}"`,
  ).join('\n')
}
