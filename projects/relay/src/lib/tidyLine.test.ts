import { describe, expect, it } from 'vitest'
import { capitaliseOpening } from './tidyLine'

describe('capitaliseOpening', () => {
  it('capitalises a lowercase start', () => {
    expect(capitaliseOpening('freedom is a wonderful asset')).toBe('Freedom is a wonderful asset')
  })

  it('looks past an opening quote', () => {
    expect(capitaliseOpening('"don\'t you remember?" he said')).toBe('"Don\'t you remember?" he said')
  })

  it('leaves everything else alone', () => {
    expect(capitaliseOpening('Already fine')).toBe('Already fine')
    expect(capitaliseOpening('3,4, Johnny was never prompt')).toBe('3,4, Johnny was never prompt')
    expect(capitaliseOpening('iPhone rang')).toBe('iPhone rang')
    expect(capitaliseOpening('')).toBe('')
  })
})
