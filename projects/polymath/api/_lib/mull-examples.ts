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
 *
 * The subject matter is deliberately foreign — a stone wall, a darkroom, an
 * allotment. The first draft of this file used coasters and a bio, which are
 * two of the user's actual projects, and the examples state invented facts
 * about them ("for one week in February you wrote about the coasters every
 * day"). Handed those alongside the real corpus, the model has no way to
 * tell which half it is reading, and a fact invented here arrives looking
 * exactly like one the notes supplied. The grounding gate would not catch it
 * either: the quote can come from the real connector while the surrounding
 * claim comes from the example. Nothing here may name anything the corpus
 * could plausibly contain.
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
    text: "You've said since March 2023 that a wall should look like the field it came from. Every stretch you've built is coursed and level. Which bit gets left rough?",
    quote: 'a wall should look like the field it came from',
    stake: 'The next ten feet go up uncoursed.',
  },
  {
    shape: 'ends in a choice, not an interpretation',
    text: 'You wrote that your uncle remembers the boat but not the year he sold it. The letters are filed by date and there are forty of them. Which one would you read first if the order did not matter?',
    quote: 'remembers the boat but not the year he sold it',
    stake: 'Letter eleven opens the folder.',
  },
  {
    shape: 'a rhythm that stopped; the answer is a name',
    text: "The darkroom nights stopped in August and nothing replaced them. You wrote in June that you only print when someone's waiting for one. Who was waiting?",
    quote: "you only print when someone's waiting for one",
    stake: 'He promises a print to someone before booking the next night.',
  },
  {
    shape: 'two things captured days apart and never put together',
    text: "On the 3rd you wanted a bench you'd never have to clear. On the 6th you wrote that the shed only works because you empty it every Sunday. Which one is the workshop?",
    quote: 'the shed only works because you empty it every Sunday',
    stake: 'The shed gets racking or gets emptied.',
  },
  {
    shape: 'a burst that stopped dead — asks for a fact the corpus does not hold',
    text: 'For one week in February you wrote about the allotment every day, then never again. Nothing says you gave it up. What happened that week that is not written down?',
    quote: 'wrote about the allotment every day',
    stake: 'The plot gets planted this spring or handed back.',
  },
  {
    shape: 'an article as the lens; the question is a counterfactual',
    text: 'You kept a piece about restorers leaving the damage visible. You redraw the third panel every time you open it. What would leaving it visible look like?',
    quote: 'restorers leaving the damage visible',
    stake: 'Panel three goes out with the first lines showing.',
  },
  {
    shape: "reading as register, never quoted — lists are not the user's words",
    text: "You've been reading about people who make one thing for forty years. Your list has nine things on it, all under a year old. What's the one you'd still be doing in ten?",
    quote: 'people who make one thing for forty years',
    stake: 'Eight things come off the list.',
  },
  {
    shape: 'a return after silence; a real either/or with a different action each way',
    text: 'The translation sat untouched fourteen months and you opened it last Tuesday. Before you stopped you wrote that you did not have the last line. Do you have it now, or did you miss the work?',
    quote: 'you did not have the last line',
    stake: 'He writes the last line this week, or admits he wanted the hours.',
  },
  {
    shape: 'vocabulary that drifted between early captures and late ones',
    text: 'Two years ago you wrote about making things for people. This year you write about finishing things. Nobody is named in the recent ones. Who is the next one for?',
    quote: 'making things for people',
    stake: 'The next project gets a person attached before a deadline.',
  },
  {
    shape: 'said repeatedly, never became a project; the question is the first small move',
    text: "You've written four times since 2023 that you want to read music properly, and it has never become a project. Each time you wrote it down and then wrote something else. What would you play first?",
    quote: 'you want to read music properly',
    stake: 'He books one lesson this month.',
  },
]

/** The examples as the prompt sees them. */
export function examplesBlock(): string {
  return MULL_EXAMPLES.map(
    e => `- ${e.shape}\n  "${e.text}"\n  stake: "${e.stake}"`,
  ).join('\n')
}
