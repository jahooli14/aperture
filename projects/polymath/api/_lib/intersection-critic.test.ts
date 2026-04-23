/**
 * Unit tests for the deterministic side of the intersection critic.
 *
 * Each failure case here maps directly to a real card the previous pipeline
 * shipped. If these stay green, the same cringe can't ship again.
 */

import { describe, it, expect } from 'vitest'
import { validateCandidate, validateSpark } from './intersection-critic'

// A known-good candidate that should pass every rule. Used as a baseline —
// most tests mutate one field and check that the mutation alone trips the
// validator.
const GOOD = {
  crossover_title: 'signal detection across domains',
  hook: 'You keep solving the same problem in three different disguises.',
  the_pattern:
    'Your Pupils app spots meaningful change in a stream of nearly-identical baby photos, and your Polymath graph spots meaningful links in scattered voice notes. Same mechanism, two domains.',
  the_experiment:
    'Sketch one diagram showing the shared signal-detection loop in both apps and pin it above your desk.',
  first_steps: [
    'Open your Pupils alignment notes and list three tricky edge cases you solved last month.',
    'Open your Polymath graph code and find the similarity-threshold function you last edited.',
    'Draft a one-paragraph memo naming the shared pattern and email it to yourself.',
  ],
}

describe('validateCandidate — happy path', () => {
  it('passes a well-formed candidate', () => {
    const result = validateCandidate(GOOD)
    expect(result.ok).toBe(true)
    expect(result.reasons).toEqual([])
  })
})

describe('hook opening', () => {
  it('rejects hook starting with "Your" (possessive)', () => {
    // From card 1: "Your replaced-objects story tracks sanity slipping..."
    const result = validateCandidate({ ...GOOD, hook: 'Your replaced-objects story tracks sanity slipping item by item.' })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('Your'))).toBe(true)
  })

  it('rejects hook starting with "You\'re"', () => {
    const result = validateCandidate({ ...GOOD, hook: "You're building a tool that finds patterns in noise." })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('You\'re'))).toBe(true)
  })

  it('rejects hook with conditional modal', () => {
    const result = validateCandidate({ ...GOOD, hook: 'You could build a tool that handles both at once.' })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('conditional'))).toBe(true)
  })

  it('rejects hook starting with "I\'m looking at"', () => {
    // From card 5 (SPARK): "I'm looking at your 'Going Analogue' story..."
    const result = validateCandidate({ ...GOOD, hook: "I'm looking at your Going Analogue story and your game theory notes." })
    expect(result.ok).toBe(false)
  })

  it('rejects hook starting with "It feels like"', () => {
    const result = validateCandidate({ ...GOOD, hook: 'It feels like you keep writing about the same theme.' })
    expect(result.ok).toBe(false)
  })
})

describe('banned openers on hook and pattern', () => {
  it('rejects "If you combine..." in the_pattern', () => {
    const result = validateCandidate({ ...GOOD, the_pattern: 'If you combine your Pupils app with your Polymath graph, you get signal detection in both.' })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('banned opener'))).toBe(true)
  })

  it('rejects "Imagine a..." opener', () => {
    const result = validateCandidate({ ...GOOD, hook: 'You notice a pattern. Imagine a tool that does this automatically.' })
    // hook starts with "You" + verb so the opener check on hook passes —
    // it's the_pattern we need to test. Try pattern opening.
    const p = validateCandidate({ ...GOOD, the_pattern: 'Imagine a tool that stitches both together.' })
    expect(p.ok).toBe(false)
    // but the first assertion also should pass because hook starts "You"
    expect(result.ok).toBe(true)
  })
})

describe('first_steps shorthand', () => {
  it('rejects "from your X list" shorthand', () => {
    // From card 1: "Pick one specific personality type from your Long Now list"
    const result = validateCandidate({
      ...GOOD,
      first_steps: [
        'Pick one specific personality type from your Long Now list and name it.',
        GOOD.first_steps[1],
        GOOD.first_steps[2],
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('shorthand'))).toBe(true)
  })

  it('rejects "from your X notes" shorthand', () => {
    // From card 3: "Pick one specific sandwich recipe from your sandwich theory notes"
    const result = validateCandidate({
      ...GOOD,
      first_steps: [
        'Pick one specific sandwich recipe from your sandwich theory notes this evening.',
        GOOD.first_steps[1],
        GOOD.first_steps[2],
      ],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects "one specific X" boilerplate', () => {
    const result = validateCandidate({
      ...GOOD,
      first_steps: [
        'Choose one specific personality and spend ten minutes writing their reaction.',
        GOOD.first_steps[1],
        GOOD.first_steps[2],
      ],
    })
    expect(result.ok).toBe(false)
  })

  it('rejects step that is too short', () => {
    const result = validateCandidate({
      ...GOOD,
      first_steps: [
        'Schedule stuck time.',
        GOOD.first_steps[1],
        GOOD.first_steps[2],
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('too short'))).toBe(true)
  })

  it('rejects when fewer than 3 steps', () => {
    const result = validateCandidate({ ...GOOD, first_steps: [GOOD.first_steps[0]] })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('first_steps'))).toBe(true)
  })
})

describe('banned words and cringe phrases', () => {
  it('rejects "massive flex"', () => {
    // From card 4 (SPARK): "is a massive flex that directly combines..."
    const result = validateCandidate({
      ...GOOD,
      the_pattern: 'Building this would be a massive flex that combines your dev skills with your design taste.',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('cringe'))).toBe(true)
  })

  it('rejects "deeply fascinated"', () => {
    // From card 1: "You are deeply fascinated by how tiny, accumulated tweaks..."
    const result = validateCandidate({
      ...GOOD,
      the_pattern: 'You are deeply fascinated by how tiny changes accumulate into new realities.',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects jargon word "paradigm"', () => {
    const result = validateCandidate({
      ...GOOD,
      the_pattern: 'Your work represents a new paradigm for creative tooling, spanning both projects.',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('paradigm'))).toBe(true)
  })

  it('rejects "at the intersection of" cliche', () => {
    const result = validateCandidate({
      ...GOOD,
      the_pattern: 'Your work sits at the intersection of engineering and narrative design across both apps.',
    })
    expect(result.ok).toBe(false)
  })
})

describe('title rules', () => {
  it('rejects title with "profound"', () => {
    // From card 3: "profound meaning in mundanity"
    const result = validateCandidate({ ...GOOD, crossover_title: 'profound meaning in mundanity' })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('title'))).toBe(true)
  })

  it('rejects title with "unconventional"', () => {
    // From card 2: "unconventional translation layers"
    const result = validateCandidate({ ...GOOD, crossover_title: 'unconventional translation layers' })
    expect(result.ok).toBe(false)
  })

  it('rejects -ness abstract nouns in title', () => {
    const result = validateCandidate({ ...GOOD, crossover_title: 'the strangeness of everyday objects' })
    expect(result.ok).toBe(false)
  })

  it('rejects title longer than 7 words', () => {
    const result = validateCandidate({
      ...GOOD,
      crossover_title: 'the hidden thread running through every piece of your work',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('too long'))).toBe(true)
  })
})

describe('pattern vs experiment paraphrase', () => {
  it('rejects when experiment just restates the pattern', () => {
    // Modeled on card 1's paraphrase failure. Pattern says "drift creates new reality";
    // experiment says "write about drift creating new reality".
    const result = validateCandidate({
      ...GOOD,
      the_pattern:
        'Your replaced-objects story tracks sanity drifting item by item, your vivid dreams book tracks identity drifting across nights.',
      the_experiment:
        'Write a scene where sanity drifts item by item across a night of vivid dreams in your replaced-objects draft.',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('overlap'))).toBe(true)
  })
})

describe('missing fields', () => {
  it('rejects missing hook', () => {
    const result = validateCandidate({ ...GOOD, hook: '' })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('hook'))).toBe(true)
  })

  it('rejects missing the_experiment', () => {
    const result = validateCandidate({ ...GOOD, the_experiment: '' })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('the_experiment'))).toBe(true)
  })
})

// ----- SPARK schema (title + description + reasoning) --------------------

const GOOD_SPARK = {
  title: 'offline postman puzzle piece',
  description: 'A short game you play with friends using physical coasters as puzzle tokens.',
  reasoning:
    'You keep writing fiction about offline worlds in your Going Analogue draft, and your saved list includes three books about game theory. The coasters you painted last month are the missing piece — a physical token that could actually run the game for real.',
}

describe('validateSpark — happy path', () => {
  it('passes a well-formed SPARK suggestion', () => {
    const result = validateSpark(GOOD_SPARK)
    expect(result.ok).toBe(true)
    expect(result.reasons).toEqual([])
  })
})

describe('SPARK reasoning opener', () => {
  it('rejects "I\'m looking at your..." observer voice', () => {
    // From card 5: "I'm looking at your 'Going Analogue' story..."
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: "I'm looking at your Going Analogue story alongside your love of game theory and those painted coasters.",
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('observer voice'))).toBe(true)
  })

  it('rejects "It feels like you..." hedged voice', () => {
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: "It feels like you're writing fiction about what you actually want to do in real life.",
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('hedged'))).toBe(true)
  })

  it('rejects "Imagine a..." hypothetical opener', () => {
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: "Imagine a site that loops you through the same essay twice via invisible Penrose stairs.",
    })
    expect(result.ok).toBe(false)
  })

  it('rejects "So," filler opener', () => {
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: 'So, you keep writing about offline worlds across three different notes and one list item.',
    })
    expect(result.ok).toBe(false)
  })
})

describe('SPARK mashup tells', () => {
  it('rejects "directly combines your X with your Y"', () => {
    // From card 4: "directly combines your dev skills with your narrative design philosophy"
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning:
        'You keep writing about Penrose stairs and narrative loops. Building the site directly combines your dev skills with your narrative design philosophy.',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('mashup tell'))).toBe(true)
  })

  it('rejects "fuses your X"', () => {
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: 'You keep circling the same question. This fuses your book editor work with your voice notes.',
    })
    expect(result.ok).toBe(false)
  })
})

describe('SPARK cringe phrases', () => {
  it('rejects "massive flex"', () => {
    // From card 4 verbatim
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: 'You keep building infinite-loop interfaces across three projects. Shipping this site would be a massive flex.',
    })
    expect(result.ok).toBe(false)
    expect(result.reasons.some(r => r.includes('cringe'))).toBe(true)
  })

  it('rejects "deeply fascinated"', () => {
    const result = validateSpark({
      ...GOOD_SPARK,
      reasoning: 'You are deeply fascinated by how Penrose stairs trick the eye in your writing and your design work.',
    })
    expect(result.ok).toBe(false)
  })
})

describe('SPARK title rules', () => {
  it('rejects title with flowery phrase', () => {
    const result = validateSpark({ ...GOOD_SPARK, title: 'the profound postman' })
    expect(result.ok).toBe(false)
  })

  it('rejects title too long', () => {
    const result = validateSpark({
      ...GOOD_SPARK,
      title: 'a long hypothetical name for a single weekend project idea',
    })
    expect(result.ok).toBe(false)
  })
})

describe('SPARK description vs reasoning paraphrase', () => {
  it('rejects when reasoning just restates the description', () => {
    const text =
      'You keep writing fiction about offline worlds and saving books about game theory. You keep writing fiction about offline worlds and saving books about game theory.'
    const result = validateSpark({
      ...GOOD_SPARK,
      description: 'A game about offline worlds using painted coasters.',
      reasoning: text,
    })
    // The reasoning above is self-duplicating; description is unrelated length-wise.
    // So the real test is reasoning overlapping description heavily:
    const tight = validateSpark({
      title: 'offline coaster game',
      description: 'You keep writing fiction about offline worlds using painted coasters as physical tokens for a game.',
      reasoning: 'You keep writing fiction about offline worlds using painted coasters as physical tokens for a game.',
    })
    expect(tight.ok).toBe(false)
    expect(tight.reasons.some(r => r.includes('overlap'))).toBe(true)
    // Avoid lint warning about unused var
    expect(result).toBeDefined()
  })
})
