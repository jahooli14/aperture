import { describe, it, expect } from 'vitest'
import { isTake, splitSentences } from './takeText'

describe('isTake', () => {
  it('a claim with no question mark is a take', () => {
    expect(isTake('The invites stopped at proofs. I think your projects die the moment someone could see them.')).toBe(true)
  })
  it('a line that ends on a question is not', () => {
    expect(isTake('You said one take. What would the book look like in one take?')).toBe(false)
  })
  it('their own quoted question in the facts does not make the claim a question', () => {
    expect(isTake('In March you wrote "why bother?" under the quiz. The choir kept going. I think you finish what other people turn up for.')).toBe(true)
  })
})

describe('splitSentences', () => {
  it('keeps punctuation with its sentence', () => {
    expect(splitSentences('One. Two? Three')).toEqual(['One.', 'Two?', 'Three'])
  })
})
