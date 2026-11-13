import { describe, expect, it } from 'vitest'
import { curlQuotes, opensOnSpeech, paragraphs } from './speech'

describe('paragraphs', () => {
  it('breaks between separate bits of speech', () => {
    expect(
      paragraphs('"Can I say I told you so?" "Never change, Igor." "I never will. Now, what?" "Well, someone."')
    ).toEqual(['"Can I say I told you so?"', '"Never change, Igor."', '"I never will. Now, what?"', '"Well, someone."'])
  })

  it('breaks narration from the speech that follows it', () => {
    expect(paragraphs('Igor walked into the office. "Well, well, well".')).toEqual([
      'Igor walked into the office.',
      '"Well, well, well".',
    ])
  })

  it('keeps speech that runs on from narration', () => {
    const line = 'He said "no" and left. Then he came back, saying "fine".'
    expect(paragraphs(line)).toEqual([line])
    expect(paragraphs('"Hello," she said. "Again."')).toEqual(['"Hello," she said.', '"Again."'])
    expect(paragraphs('"Hello," she said, "again."')).toEqual(['"Hello," she said, "again."'])
  })

  it('honours line breaks the writer typed', () => {
    expect(paragraphs('One.\n\nTwo.\nThree.')).toEqual(['One.', 'Two.', 'Three.'])
  })

  it('leaves unbalanced quotes alone', () => {
    expect(paragraphs('He said. "Unclosed')).toEqual(['He said. "Unclosed'])
  })

  it('handles curly quotes', () => {
    expect(paragraphs('“Yes.” “No.”')).toEqual(['“Yes.”', '“No.”'])
  })
})

describe('curlQuotes', () => {
  it('curls double and single quotes', () => {
    expect(curlQuotes('"Don\'t," he said. \'Fine\'')).toBe('“Don’t,” he said. ‘Fine’')
  })

  it('handles a quote after a dash', () => {
    expect(curlQuotes('Garbage -"sorry"')).toBe('Garbage -“sorry”')
  })
})

describe('opensOnSpeech', () => {
  it('spots a paragraph that opens on a quote', () => {
    expect(opensOnSpeech('"Hi"')).toBe(true)
    expect(opensOnSpeech('“Hi”')).toBe(true)
    expect(opensOnSpeech('Hi')).toBe(false)
  })
})
