import { describe, it, expect } from 'vitest'
import { mitigationFromHeaders, detectBotWallText } from './bot-wall'

describe('mitigationFromHeaders', () => {
  it('reads the Vercel challenge header', () => {
    expect(mitigationFromHeaders(new Headers({ 'x-vercel-mitigated': 'challenge' }))).toBe('Vercel')
  })

  it('reads the Cloudflare challenge header', () => {
    expect(mitigationFromHeaders(new Headers({ 'cf-mitigated': 'challenge' }))).toBe('Cloudflare')
  })

  it('ignores unrelated header values', () => {
    expect(mitigationFromHeaders(new Headers({ 'x-vercel-mitigated': 'bot-fight' }))).toBeNull()
    expect(mitigationFromHeaders(new Headers())).toBeNull()
  })

  it('works with a plain object, not just a real Headers instance', () => {
    expect(mitigationFromHeaders({ 'x-vercel-mitigated': 'challenge' })).toBe('Vercel')
    expect(mitigationFromHeaders({})).toBeNull()
  })
})

describe('detectBotWallText', () => {
  it('catches the known interstitial phrases', () => {
    expect(detectBotWallText('Just a moment...', 'Please wait while we check your browser')).not.toBeNull()
    expect(detectBotWallText('Attention Required! | Cloudflare', '')).not.toBeNull()
    expect(detectBotWallText('', 'Verify you are human to continue')).not.toBeNull()
    expect(detectBotWallText(null, 'Please enable JavaScript and cookies to continue')).not.toBeNull()
  })

  it('leaves a real article alone', () => {
    const title = 'How task composition changes agent design'
    const body = `
      Shared subtasks get reused across workflows and improve everywhere at
      once. As I spend more time working across AI, interfaces, and social
      coordination, I keep noticing the same pattern show up in different
      clothes. A paradigm that works in one domain points at analogues in
      sibling domains.
    `
    expect(detectBotWallText(title, body)).toBeNull()
  })

  it('does not false-positive on a real article that mentions "captcha" once, deep in the piece', () => {
    const body = 'x'.repeat(3000) + ' the site made him solve a captcha before signing up ' + 'y'.repeat(3000)
    // The match window is the first ~2KB, so a mention buried past that
    // point in a genuinely long article never reaches the pattern check.
    expect(detectBotWallText('A long real article', body)).toBeNull()
  })

  it('still catches a short real challenge page even with padding before it', () => {
    const body = 'Attention Required! Please complete the security check to access this site.'
    expect(detectBotWallText('Attention Required! | Cloudflare', body)).not.toBeNull()
  })
})
