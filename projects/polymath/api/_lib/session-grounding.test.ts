import { describe, it, expect } from 'vitest'
import {
  stem,
  extractSpecifics,
  hasOnlyKnownSpecifics,
  evidenceHaystack,
  citationSupports,
  filterGrounded,
  type Evidence,
} from './session-grounding.js'

// The real corpus for "Graham song" as the app actually had it: a title, a
// close-out about vocals and a transition. No guitar, no mic, no click
// track anywhere.
const EVIDENCE: Evidence[] = [
  {
    id: 'e1',
    label: 'from your last close-out',
    text: 'Got the intro sorted. Next: fix the transition out of track two.',
  },
  {
    id: 'e2',
    label: 'from your note on 12 Aug',
    text: 'The second verse vocal is still flat, needs another take.',
  },
]
const TITLE = 'Graham song'

describe('extractSpecifics', () => {
  it('catches gear and model codes', () => {
    expect(extractSpecifics('Record a take using the SM57 mic')).toContain('SM57')
    expect(extractSpecifics('Set the C414 up over the kit')).toContain('C414')
  })

  it('catches numbers with units', () => {
    expect(extractSpecifics('Export as a 24-bit WAV')).toContain('24-bit')
    expect(extractSpecifics('Bounce the vocal at -3dB')).toContain('3dB')
    expect(extractSpecifics('Set the click to 120bpm')).toContain('120bpm')
  })

  it('catches proper nouns mid-sentence', () => {
    expect(extractSpecifics('Open it in Ableton and play it back')).toContain('Ableton')
  })

  it('does not treat a sentence-opening capital as a claim', () => {
    expect(extractSpecifics('Open the file and play it.')).not.toContain('Open')
    expect(extractSpecifics('Cut the intro. Play it back.')).not.toContain('Play')
  })

  it('finds nothing to check in a plainly generic move', () => {
    expect(extractSpecifics('Open the project and play it from the top.')).toEqual([])
  })
})

describe('hasOnlyKnownSpecifics', () => {
  const haystack = evidenceHaystack(EVIDENCE, TITLE)

  it('rejects the fabrications this feature actually shipped', () => {
    expect(hasOnlyKnownSpecifics('Record a fresh acoustic guitar take using the SM57 mic while listening to the click track.', haystack)).toBe(false)
    expect(hasOnlyKnownSpecifics('Export the final mix as a 24-bit WAV file.', haystack)).toBe(false)
  })

  it('allows a name the corpus genuinely knows', () => {
    // "Graham" is in the project title, so it is not an invention.
    expect(hasOnlyKnownSpecifics("Punch in a replacement line where Graham's pitch dipped.", haystack)).toBe(true)
  })

  it('allows a move with no specifics in it at all', () => {
    expect(hasOnlyKnownSpecifics('Open the project and play it from the top.', haystack)).toBe(true)
  })
})

describe('stem', () => {
  it('matches a word to its own inflections', () => {
    expect(stem('mixed')).toBe(stem('mix'))
    expect(stem('sent')).toBe(stem('send'))
    expect(stem('cutting')).toBe(stem('cut'))
    expect(stem('bounces')).toBe(stem('bounce'))
  })
})

describe('citationSupports', () => {
  const GOAL = 'Finish the Graham song and get it mixed and sent to him.'

  it('accepts an item that shares real vocabulary with its source', () => {
    expect(citationSupports('Fix the transition out of track two.', EVIDENCE[0].text)).toBe(true)
  })

  it('rejects an item pointed at an unrelated note', () => {
    expect(citationSupports('Record an acoustic guitar take.', EVIDENCE[0].text)).toBe(false)
  })

  // These are the honest inferences a well-shaped project should produce.
  // The earlier two-raw-word rule blocked all of them, which is how the
  // anti-fabrication fix turned into "useless on projects it knows well".
  it('accepts across ordinary English inflection', () => {
    expect(citationSupports('Send the rough to Graham.', GOAL)).toBe(true)
    expect(citationSupports('Get it mixed enough to send.', GOAL)).toBe(true)
  })

  it('accepts a single distinctive word in common', () => {
    expect(citationSupports('Work on the intro level.', EVIDENCE[0].text)).toBe(true)
  })

  // ...without letting an invention launder itself through a common verb.
  it('does not count a verb every item uses as a citation', () => {
    // "sort" is shared with "Got the intro sorted", and nothing else is.
    expect(citationSupports('Sort the album artwork out.', EVIDENCE[0].text)).toBe(false)
    expect(citationSupports('Take a photo of the studio.', EVIDENCE[1].text)).toBe(false)
    expect(citationSupports('Start on the second single.', EVIDENCE[0].text)).toBe(false)
  })

  it('still rejects something with nothing in common at all', () => {
    expect(citationSupports('Book a mastering engineer.', GOAL)).toBe(false)
  })
})

describe('filterGrounded', () => {
  it('drops invented items and keeps grounded ones', () => {
    const { kept, rejected } = filterGrounded(
      [
        { text: 'Open the project and play it from the top.' },
        { text: 'Record a fresh acoustic guitar take using the SM57 mic.', evidence: ['e1'] },
        { text: 'Fix the transition out of track two.', evidence: ['e1'] },
        { text: 'Take the second verse vocal again.', evidence: ['e2'] },
      ],
      EVIDENCE,
      TITLE,
    )
    expect(kept.map(k => k.text)).toEqual([
      'Open the project and play it from the top.',
      'Fix the transition out of track two.',
      'Take the second verse vocal again.',
    ])
    expect(rejected).toHaveLength(1)
    expect(rejected[0].reason).toContain('SM57')
  })

  it('carries the receipt so the item can show where it came from', () => {
    const { kept } = filterGrounded(
      [{ text: 'Fix the transition out of track two.', evidence: ['e1'] }],
      EVIDENCE,
      TITLE,
    )
    expect(kept[0].source).toBe('from your last close-out')
  })

  it('leaves a generic move sourceless rather than inventing a receipt', () => {
    const { kept } = filterGrounded(
      [{ text: 'Open the project and play it from the top.' }],
      EVIDENCE,
      TITLE,
    )
    expect(kept[0].source).toBeNull()
  })

  it('will not let a real citation launder an invented specific', () => {
    // Cites e2, which genuinely mentions the verse and the vocal — but the
    // item smuggles in a microphone that exists nowhere.
    const { kept, rejected } = filterGrounded(
      [{ text: 'Take the second verse vocal again through the SM57.', evidence: ['e2'] }],
      EVIDENCE,
      TITLE,
    )
    expect(kept).toHaveLength(0)
    expect(rejected[0].reason).toContain('invented')
  })

  it('rejects an item whose citation is real but unrelated to it', () => {
    const { kept, rejected } = filterGrounded(
      [{ text: 'Sort the album artwork out and upload it.', evidence: ['e1'] }],
      EVIDENCE,
      TITLE,
    )
    expect(kept).toHaveLength(0)
    expect(rejected[0].reason).toContain('citation does not support it')
  })
})
