import { describe, it, expect } from 'vitest'


describe('minimal is Flash-Lite only', () => {
  it('keeps minimal on Flash-Lite and uses low elsewhere', async () => {
    const { thinkingFragment } = await import('./gemini-thinking.js')
    const level = (f: unknown) => (f as { thinkingConfig?: { thinkingLevel?: string } }).thinkingConfig?.thinkingLevel
    expect(level(thinkingFragment('minimal', 'gemini-flash-lite-latest'))).toBe('MINIMAL')
    expect(level(thinkingFragment('minimal', 'gemini-4-hydrogen'))).toBe('LOW')
    expect(level(thinkingFragment('minimal'))).toBe('MINIMAL')
    expect(level(thinkingFragment('low', 'gemini-4-hydrogen'))).toBe('LOW')
  })
})
