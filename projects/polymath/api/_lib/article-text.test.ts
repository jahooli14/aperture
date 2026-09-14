import { describe, it, expect } from 'vitest'
import { articleBody, articleEmbeddingText, htmlToText, EMBED_CHAR_BUDGET } from './article-text.js'

// What the RSS ingest actually stores: excerpt capped at 100 characters for
// the card UI, the real text in `content` as HTML.
const feedRow = {
  title: 'The long way round',
  excerpt: 'A short feed blurb, cut at a hundred characters by the ingest, which is all any RSS row ev',
  content: '<p>People who take the long way round are not being slow. They are refusing to accept that the shortest path is the same as the best one, and that refusal costs them years.</p>',
}

describe('htmlToText', () => {
  it('strips tags and decodes entities', () => {
    expect(htmlToText('<p>it isn&#8217;t about talent &amp; never was</p>'))
      .toBe('it isn’t about talent & never was')
  })

  it('drops script and style bodies rather than reading them as prose', () => {
    const text = htmlToText('<p>real text</p><script>trackEvent("view")</script><style>.x{color:red}</style>')
    expect(text).toBe('real text')
  })

  it('returns empty rather than throwing on rubbish', () => {
    expect(typeof htmlToText('<<<not really html')).toBe('string')
  })
})

describe('articleBody', () => {
  it('prefers the real text over the capped excerpt', () => {
    expect(articleBody(feedRow)).toContain('refusing to accept that the shortest path')
    expect(articleBody(feedRow)).not.toContain('cut at a hundred characters')
  })

  it('falls back to the excerpt when content is a scrap of markup', () => {
    expect(articleBody({ excerpt: 'the excerpt', content: '<p>short</p>' })).toBe('the excerpt')
    expect(articleBody({ excerpt: 'the excerpt', content: null })).toBe('the excerpt')
  })
})

describe('articleEmbeddingText', () => {
  it('embeds the article, not the feed teaser', () => {
    const text = articleEmbeddingText(feedRow)
    expect(text).toContain('The long way round')
    expect(text).toContain('refusing to accept that the shortest path')
  })

  it('keeps the title when the body is truncated', () => {
    const long = { title: 'Kept', excerpt: null, content: `<p>${'word '.repeat(20000)}</p>` }
    const text = articleEmbeddingText(long)
    // gemini-embedding-001 silently truncates past its token limit, so the
    // cut happens here and the title survives it.
    expect(text.length).toBeLessThanOrEqual(EMBED_CHAR_BUDGET)
    expect(text.startsWith('Kept')).toBe(true)
  })

  it('still produces something for an article with no body at all', () => {
    expect(articleEmbeddingText({ title: 'Just a title', excerpt: null, content: null }))
      .toBe('Just a title')
  })
})
