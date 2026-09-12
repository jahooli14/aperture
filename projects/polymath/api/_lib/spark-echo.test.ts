import { describe, it, expect } from 'vitest'
import { motifWords, repeatedMotifs, echoesRecent, avoidBlock } from './spark-echo.js'

describe('motifWords', () => {
  it('keeps the words that name the subject', () => {
    expect(motifWords('Watching ripples multiply into reflections')).toEqual(
      expect.arrayContaining(['watching', 'ripple', 'multiply', 'reflection']),
    )
  })

  it('drops filler and short words', () => {
    const words = motifWords('That is the thing about this project, really')
    expect(words).toEqual([])
  })

  it('treats a plural and its singular as the same motif', () => {
    expect(motifWords('ripples')).toEqual(motifWords('ripple'))
  })

  it('leaves double-s words alone', () => {
    expect(motifWords('glass')).toEqual(['glass'])
  })
})

describe('repeatedMotifs', () => {
  it('names only what has come round more than once', () => {
    const motifs = repeatedMotifs([
      'A quiet sense of infinity in the water.',
      'The water keeps folding back on itself.',
      'The bench needs a second coat.',
    ])
    expect(motifs).toContain('water')
    expect(motifs).not.toContain('infinity')
    expect(motifs).not.toContain('bench')
  })
})

describe('echoesRecent', () => {
  // The bug this exists for: three days running about water and infinity,
  // each a different spark type about a different project.
  const history = [
    'Watching ripples multiply into reflections gives a quiet sense of infinity.',
    'The water in the pool scene goes on forever — infinity again.',
  ]

  it('blocks a motif that has already recurred', () => {
    expect(echoesRecent('A sense of infinity, held in one frame.', history)).toBe(true)
  })

  it('blocks a question that shares two distinctive words with one recent spark', () => {
    expect(echoesRecent('What if the pool scene were shot dry?', [history[1]])).toBe(true)
  })

  it('lets one shared word through — a coincidence is not a repeat', () => {
    expect(echoesRecent('The pool table needs re-felting before winter.', [history[1]])).toBe(false)
  })

  it('lets a genuinely different subject through', () => {
    expect(echoesRecent('You commit to one take on the mixes. What if a chapter had to?', history)).toBe(false)
  })

  it('is silent with no history', () => {
    expect(echoesRecent('Anything at all about infinity.', [])).toBe(false)
  })

  it('does not flag a spark made only of filler', () => {
    expect(echoesRecent('That is the thing about this project.', history)).toBe(false)
  })
})

describe('avoidBlock', () => {
  it('is empty when nothing has been asked yet', () => {
    expect(avoidBlock([])).toBe('')
  })

  it('quotes the recent questions verbatim so a synonym swap is visible', () => {
    const block = avoidBlock(['The water goes on forever.', 'Water again, in the second chapter.'])
    expect(block).toContain('The water goes on forever.')
    expect(block).toContain('water')
    expect(block).toContain('spark": null')
  })
})

describe('what counts as "a recent question"', () => {
  it('a project title is not a motif', () => {
    // The forgotten offer is "you set down <project> N months ago". Its
    // distinctive words are the project's NAME, so leaving it in the echo
    // history makes every real question about that project an echo of it.
    // fetchRecentSparkTexts filters to type='mull' for this reason; the
    // pure check below shows what happens if it does not.
    const forgottenOffer = 'You set down Social Coaster Memory Framework 3 months ago.'
    const realQuestion =
      'The Social Coaster Memory Framework has sat since March. You wrote that the loft boxes never got opened. What would you keep if you only kept one?'
    expect(echoesRecent(realQuestion, [forgottenOffer])).toBe(true)
    expect(echoesRecent(realQuestion, [])).toBe(false)
  })
})

describe('the channel\'s own framing is not a motif', () => {
  it('two questions about different things are not echoes', () => {
    // Taken from a real bake: four drafts written, this one dropped with
    // "shared: wrote, actually". Every mull question plays back the user's
    // words ("You wrote that...") and the prompt requires a real date, so
    // that framing is in every draft. Counted as motif it spends both
    // strikes before the question has said anything.
    const aboutCoasters =
      'You wrote that a memory needs to be trapped in a physical object right after it happens, but you are actually spending hours designing t-shirts for four friends. When does the moment become real?'
    const aboutBios =
      'You wrote in March that you would actually rather ask the same question twice than a new one. What do you learn the second time?'
    expect(echoesRecent(aboutCoasters, [aboutBios])).toBe(false)
  })

  it('still catches two questions reaching for the same image', () => {
    const first = 'The ripples multiply outward and the reflection never settles.'
    const second = 'What if the reflection in those ripples is the whole point?'
    expect(echoesRecent(second, [first])).toBe(true)
  })
})
