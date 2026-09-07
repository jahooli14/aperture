import { describe, it, expect } from 'vitest'
import { parseHTML } from 'linkedom'
import { stripLinkDenseBlocks, stripLinkOnlyLists, stripLinkFarms } from './link-density'

function doc(html: string) {
  return parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`).document
}

describe('stripLinkDenseBlocks', () => {
  it('removes a paragraph that is nothing but two links stitched together', () => {
    const d = doc('<p><a href="/a">Tech</a> <a href="/b">Science</a> <a href="/c">Culture</a></p>')
    stripLinkDenseBlocks(d)
    expect(d.querySelectorAll('p').length).toBe(0)
  })

  it('leaves a normal sentence with one inline citation alone', () => {
    const d = doc('<p>Task composition beats one big prompt, as <a href="/x">this piece</a> argues at length.</p>')
    stripLinkDenseBlocks(d)
    expect(d.querySelectorAll('p').length).toBe(1)
  })

  it('leaves a sentence with two links alone when they are a minority of the text', () => {
    const d = doc(
      '<p>The report, published by <a href="/a">Quanta</a> and picked up by <a href="/b">Nature</a>, ' +
      'runs to nearly a thousand words on how the two teams reached the same conclusion independently.</p>'
    )
    stripLinkDenseBlocks(d)
    expect(d.querySelectorAll('p').length).toBe(1)
  })

  it('removes a table cell that is just a row of links', () => {
    const d = doc('<table><tr><td><a href="/1">1</a> <a href="/2">2</a> <a href="/3">3</a></td></tr></table>')
    stripLinkDenseBlocks(d)
    expect(d.querySelectorAll('td').length).toBe(0)
  })

  it('ignores a block with only one link, however dense', () => {
    const d = doc('<p><a href="/x">Read the full report here</a></p>')
    stripLinkDenseBlocks(d)
    expect(d.querySelectorAll('p').length).toBe(1)
  })
})

describe('stripLinkOnlyLists', () => {
  it('removes a nav-shaped list where every item is just a link', () => {
    const d = doc(`<ul>
      <li><a href="/tech">Tech</a></li>
      <li><a href="/science">Science</a></li>
      <li><a href="/culture">Culture</a></li>
      <li><a href="/world">World</a></li>
    </ul>`)
    stripLinkOnlyLists(d)
    expect(d.querySelectorAll('ul').length).toBe(0)
  })

  it('leaves a real reading list alone — items have more than the link', () => {
    const d = doc(`<ul>
      <li><a href="/1">Flowers for Algernon</a> — still the one that got me</li>
      <li><a href="/2">Never Let Me Go</a> — read it in a weekend</li>
      <li><a href="/3">Klara and the Sun</a> — the ending wrecked me</li>
    </ul>`)
    stripLinkOnlyLists(d)
    expect(d.querySelectorAll('ul').length).toBe(1)
  })

  it('leaves a short list alone even if link-only — three is the floor for a nav guess', () => {
    const d = doc('<ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>')
    stripLinkOnlyLists(d)
    expect(d.querySelectorAll('ul').length).toBe(1)
  })

  it('leaves a list with real multi-link items alone', () => {
    const d = doc(`<ul>
      <li><a href="/1">Part one</a> and <a href="/1b">its follow-up</a> cover the setup</li>
      <li><a href="/2">Part two</a> and <a href="/2b">its follow-up</a> cover the payoff</li>
      <li><a href="/3">Part three</a> and <a href="/3b">its follow-up</a> cover the fallout</li>
    </ul>`)
    stripLinkOnlyLists(d)
    expect(d.querySelectorAll('ul').length).toBe(1)
  })
})

describe('stripLinkFarms (both passes together)', () => {
  it('cleans a realistic article that has both a link-farm paragraph and a nav list, keeping the prose', () => {
    const d = doc(`
      <article>
        <p>Task composition beats one big prompt, and the pattern shows up
        everywhere once you start looking for it.</p>
        <p><a href="/a">Tech</a> <a href="/b">Science</a> <a href="/c">Culture</a> <a href="/d">World</a></p>
        <ul>
          <li><a href="/1">Home</a></li>
          <li><a href="/2">About</a></li>
          <li><a href="/3">Contact</a></li>
        </ul>
        <p>As I spend more time working across AI, interfaces and social
        coordination, I keep noticing the same shape in different clothes.</p>
      </article>
    `)
    stripLinkFarms(d)
    const remainingParagraphs = Array.from(d.querySelectorAll('p')).map((p: any) => p.textContent.trim())
    expect(remainingParagraphs).toEqual([
      'Task composition beats one big prompt, and the pattern shows up\n        everywhere once you start looking for it.',
      'As I spend more time working across AI, interfaces and social\n        coordination, I keep noticing the same shape in different clothes.',
    ])
    expect(d.querySelectorAll('ul').length).toBe(0)
  })
})
