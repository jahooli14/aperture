import Parser from 'rss-parser'
import { Article, Source } from './types.js'
import { subDays, isAfter, parseISO } from 'date-fns'

export class SourceFetcher {
  protected parser: Parser
  private userAgent = 'AutonomousDocs/1.0 (+https://github.com/aperture-docs)'

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': this.userAgent
      }
    })
  }

  async fetchSource(source: Source): Promise<Article[]> {
    if (!source.enabled) {
      return []
    }

    try {
      console.log(`Fetching ${source.name}...`)

      const feed = await this.parser.parseURL(source.url)
      const cutoff = subDays(new Date(), 1) // Last 24 hours

      const articles: Article[] = []

      for (const item of feed.items) {
        if (!item.title || !item.link) continue

        // Parse publication date
        let publishDate: Date
        try {
          publishDate = item.pubDate ? new Date(item.pubDate) : new Date()
        } catch {
          publishDate = new Date()
        }

        // Only include recent articles
        if (!isAfter(publishDate, cutoff)) continue

        // Check if title/content matches keywords
        const text = `${item.title} ${item.contentSnippet || item.content || ''}`.toLowerCase()
        const hasRelevantKeywords = source.keywords.some(keyword =>
          text.includes(keyword.toLowerCase())
        )

        if (!hasRelevantKeywords) continue

        const article: Article = {
          id: this.generateArticleId(item.link, publishDate),
          title: item.title,
          url: item.link,
          content: item.content || item.contentSnippet || '',
          summary: item.contentSnippet || this.extractSummary(item.content || ''),
          publishDate,
          source: source.id,
          sourceAuthority: source.authority
        }

        articles.push(article)
      }

      console.log(`  Found ${articles.length} relevant articles from ${source.name}`)
      return articles

    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error)
      return []
    }
  }

  async fetchAllSources(sources: Source[]): Promise<Article[]> {
    console.log(`Fetching from ${sources.filter(s => s.enabled).length} sources...`)

    const promises = sources.map(source => this.fetchSource(source))
    const results = await Promise.allSettled(promises)

    const allArticles: Article[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value)
      } else {
        console.error(`Failed to fetch ${sources[index].name}:`, result.reason)
      }
    })

    // Remove duplicates based on URL
    const uniqueArticles = this.deduplicateArticles(allArticles)

    console.log(`Total articles found: ${uniqueArticles.length}`)
    return uniqueArticles
  }

  protected generateArticleId(url: string, publishDate: Date): string {
    // Create a stable ID based on URL and date
    const urlHash = url.slice(-20) // Last 20 chars of URL
    const dateStr = publishDate.toISOString().slice(0, 10) // YYYY-MM-DD
    return `${dateStr}-${urlHash.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
  }

  private extractSummary(content: string): string {
    // Strip HTML and get first ~200 chars
    const text = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    return text.length > 200 ? text.slice(0, 200) + '...' : text
  }

  private deduplicateArticles(articles: Article[]): Article[] {
    const seen = new Set<string>()
    return articles.filter(article => {
      const key = article.url.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
}

// Reddit RSS feeds have specific formatting
export class RedditSourceFetcher extends SourceFetcher {
  async fetchSource(source: Source): Promise<Article[]> {
    if (!source.url.includes('reddit.com')) {
      return super.fetchSource(source)
    }

    try {
      console.log(`Fetching Reddit: ${source.name}...`)

      const feed = await this.parser.parseURL(source.url)
      const cutoff = subDays(new Date(), 1)

      const articles: Article[] = []

      for (const item of feed.items) {
        if (!item.title || !item.link) continue

        let publishDate: Date
        try {
          publishDate = item.pubDate ? new Date(item.pubDate) : new Date()
        } catch {
          publishDate = new Date()
        }

        if (!isAfter(publishDate, cutoff)) continue

        // Reddit titles often contain the full context
        const text = item.title.toLowerCase()
        const hasRelevantKeywords = source.keywords.some(keyword =>
          text.includes(keyword.toLowerCase())
        )

        if (!hasRelevantKeywords) continue

        // Extract score from Reddit RSS if available
        const scoreMatch = item.contentSnippet?.match(/(\d+) points/) || item.content?.match(/(\d+) points/)
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0

        // Filter low-engagement posts (less than 10 upvotes)
        if (score < 10) continue

        const article: Article = {
          id: this.generateArticleId(item.link, publishDate),
          title: item.title,
          url: item.link,
          content: item.content || `Reddit post with ${score} upvotes`,
          summary: `Reddit discussion: ${item.title} (${score} upvotes)`,
          publishDate,
          source: source.id,
          sourceAuthority: Math.min(source.authority + (score / 1000), 1.0) // Boost authority for high-engagement posts
        }

        articles.push(article)
      }

      console.log(`  Found ${articles.length} relevant Reddit posts from ${source.name}`)
      return articles

    } catch (error) {
      console.error(`Error fetching Reddit ${source.name}:`, error)
      return []
    }
  }
}