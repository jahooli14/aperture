import { describe, it, expect } from 'vitest'
import { parseFind, pageMentions, htmlToText, keyWords } from './outside-find-check'
import { buildFindPrompt } from './outside-find'

const good = {
  title: 'Kintsugi repair with urushi lacquer',
  kind: 'technique',
  why: 'It fills the crack you left in the bowl instead of hiding it.',
  url: 'https://example.com/kintsugi-urushi',
}
const ask = (o: object) => parseFind(JSON.stringify(o))

describe('parseFind', () => {
  it('reads a good find, fenced or not', () => {
    expect(ask(good).find).toEqual(good)
    expect(parseFind('```json\n' + JSON.stringify(good) + '\n```').find?.title).toBe(good.title)
  })
  it('takes "nothing worth showing" as an answer', () => {
    expect(ask({ none: true })).toEqual({ find: null, reason: 'model found nothing worth showing' })
  })
  it('drops junk', () => {
    expect(parseFind('not json at all').find).toBeNull()
    expect(ask({ ...good, kind: 'course' }).find).toBeNull()
    expect(ask({ ...good, url: 'http://example.com/x' }).find).toBeNull()
    expect(ask({ ...good, url: 'nope' }).find).toBeNull()
    expect(ask({ ...good, why: '' }).find).toBeNull()
    expect(ask({ ...good, why: 'word '.repeat(40) }).find).toBeNull()
  })
  it('drops roundups', () => {
    expect(ask({ ...good, title: 'Top 10 repair techniques' }).find).toBeNull()
    expect(ask({ ...good, url: 'https://example.com/12-best-glues' }).find).toBeNull()
  })
  it('drops the analyst voice', () => {
    expect(ask({ ...good, why: 'This will unlock momentum for your process.' }).find).toBeNull()
  })
})

describe('pageMentions', () => {
  it('passes a page about the thing', () => {
    expect(pageMentions(good.title, 'A guide to kintsugi: mending with urushi and gold')).toBe(true)
  })
  it('fails a page that only resolves', () => {
    expect(pageMentions(good.title, 'Welcome to our homepage. Sign up for the newsletter.')).toBe(false)
  })
  it('ignores accents and case', () => {
    expect(pageMentions('Björk Vespertine', 'Bjork recorded VESPERTINE at home')).toBe(true)
  })
  it('handles short titles by exact match', () => {
    expect(keyWords('Ra')).toEqual([])
    expect(pageMentions('Ra', 'Sun Ra and his Arkestra')).toBe(true)
  })
})

describe('htmlToText', () => {
  it('keeps text, drops scripts and tags', () => {
    expect(htmlToText('<p>Hello <b>there</b></p><script>var x = "kintsugi"</script>').trim()).toBe('Hello there')
  })
})

describe('buildFindPrompt', () => {
  const project = {
    id: 'p', title: 'Mend the blue bowl', description: 'Fix a cracked bowl', last_closeout_text: 'glued the big piece',
    metadata: { tasks: [{ text: 'Fill the crack', order: 1 }, { text: 'Done already', done: true, order: 0 }] },
  }
  it('uses only the live project, and the open steps', () => {
    const p = buildFindPrompt(project, [])
    expect(p).toContain('Mend the blue bowl')
    expect(p).toContain('- Fill the crack')
    expect(p).not.toContain('Done already')
    expect(p).toContain('glued the big piece')
  })
  it('passes on what was not useful', () => {
    const p = buildFindPrompt(project, [{ title: 'Resin casting', verdict: 'dismissed' }, { title: 'Gold leaf', verdict: null }])
    expect(p).toMatch(/not useful[\s\S]*Resin casting/)
    expect(p).toMatch(/don't repeat:\n- Gold leaf/)
  })
})
