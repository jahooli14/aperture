import { describe, it, expect } from 'vitest'
import { parseFactCheck } from './fact-check.js'

describe('parseFactCheck', () => {
  it('reads a fenced answer', () => {
    const r = parseFactCheck('```json\n{"verdict":"true","why":"Sources agree.","topic":"Dazzle camouflage","url":"https://en.wikipedia.org/wiki/Dazzle_camouflage"}\n```')
    expect(r).toMatchObject({ verdict: 'true', topic: 'Dazzle camouflage', url: 'https://en.wikipedia.org/wiki/Dazzle_camouflage' })
  })
  it('anything unreadable or unknown is unsure, never true', () => {
    expect(parseFactCheck('I think so').verdict).toBe('unsure')
    expect(parseFactCheck('{"verdict":"probably"}').verdict).toBe('unsure')
    expect(parseFactCheck('{"verdict":"false"}').verdict).toBe('false')
  })
  it('drops a link that is not https', () => {
    expect(parseFactCheck('{"verdict":"true","url":"http://x.com","topic":"x"}').url).toBe('')
    expect(parseFactCheck('{"verdict":"true","url":"not a url","topic":"x"}').url).toBe('')
  })
})
