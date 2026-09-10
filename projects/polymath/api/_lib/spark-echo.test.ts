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
