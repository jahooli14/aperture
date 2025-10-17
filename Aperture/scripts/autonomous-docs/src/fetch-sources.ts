import Parser from 'rss-parser'
import { Article, Source } from './types.js'
import { subDays, isAfter, parseISO } from 'date-fns'

export class SourceFetcher {
  protected parser: Parser
  protected userAgent = 'AutonomousDocs/1.0 (+https://github.com/aperture-docs)'

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': this.userAgent
      }
    })
  }

  async fetchSource(source: Source, maxArticles: number = 50): Promise<Article[]> {
    if (!source.enabled) {
      return []
    }

    try {
      console.log(`Fetching ${source.name}...`)

      const feed = await this.parser.parseURL(source.url)
      const cutoff = subDays(new Date(), 7) // Last 7 days

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

        // Enforce per-source limit
        if (articles.length >= maxArticles) {
          console.log(`  Reached limit of ${maxArticles} articles for ${source.name}`)
          break
        }
      }

      console.log(`  Found ${articles.length} relevant articles from ${source.name}`)
      return articles

    } catch (error) {
      console.error(`Error fetching ${source.name}:`, error)
      return []
    }
  }

  async fetchAllSources(sources: Source[], maxPerSource: number = 50): Promise<Article[]> {
    console.log(`Fetching from ${sources.filter(s => s.enabled).length} sources (max ${maxPerSource} per source)...`)

    const promises = sources.map(source => this.fetchSource(source, maxPerSource))
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

// Web scraper for sources without RSS feeds
export class WebScrapeFetcher extends SourceFetcher {
  async fetchSource(source: Source, maxArticles: number = 50): Promise<Article[]> {
    if (source.type !== 'web-scrape') {
      return super.fetchSource(source, maxArticles)
    }

    if (!source.scrapeConfig) {
      console.error(`Web scrape source ${source.name} missing scrapeConfig`)
      return []
    }

    try {
      console.log(`Web scraping: ${source.name}...`)

      const response = await fetch(source.url, {
        headers: {
          'User-Agent': this.userAgent
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const html = await response.text()

      // Use cheerio-like parsing or simple regex extraction
      // For now, we'll use a simple approach with the fetch API
      const articles = await this.parseWebPage(html, source, maxArticles)

      console.log(`  Found ${articles.length} articles from ${source.name}`)
      return articles

    } catch (error) {
      console.error(`Error scraping ${source.name}:`, error)
      return []
    }
  }

  private async parseWebPage(html: string, source: Source, maxArticles: number): Promise<Article[]> {
    // For Anthropic News, we can extract JSON-LD or Open Graph data
    // This is a simple implementation - for production, use a proper HTML parser

    const articles: Article[] = []
    const cutoff = subDays(new Date(), 30) // 30 days for web scraping

    // Extract all links that look like news articles
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
    const matches = [...html.matchAll(linkPattern)]

    for (const match of matches) {
      const href = match[1]
      const linkText = match[2].replace(/<[^>]*>/g, '').trim()

      // Filter for news URLs (e.g., /news/something)
      if (!href.includes('/news/') || href === '/news' || href === '/news/') {
        continue
      }

      // Build full URL
      const fullUrl = href.startsWith('http')
        ? href
        : new URL(href, source.url).toString()

      // Check keywords in link text
      const text = linkText.toLowerCase()
      const hasRelevantKeywords = source.keywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      )

      if (!hasRelevantKeywords && linkText.length > 10) {
        // If link text is substantial, still check if it's a news article
        if (!linkText.match(/^[A-Z]/) || linkText.length < 15) {
          continue
        }
      }

      const article: Article = {
        id: this.generateArticleId(fullUrl, new Date()),
        title: linkText || 'Untitled',
        url: fullUrl,
        content: '', // Will be fetched when needed
        summary: linkText,
        publishDate: new Date(), // Will be extracted from article page if needed
        source: source.id,
        sourceAuthority: source.authority
      }

      articles.push(article)

      if (articles.length >= maxArticles) {
        break
      }
    }

    return articles
  }
}

// Reddit RSS feeds have specific formatting
export class RedditSourceFetcher extends WebScrapeFetcher {
  async fetchSource(source: Source, maxArticles: number = 50): Promise<Article[]> {
    if (!source.url.includes('reddit.com')) {
      return super.fetchSource(source, maxArticles)
    }

    try {
      console.log(`Fetching Reddit: ${source.name}...`)

      const feed = await this.parser.parseURL(source.url)
      const cutoff = subDays(new Date(), 7)

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

        // Enforce per-source limit
        if (articles.length >= maxArticles) {
          console.log(`  Reached limit of ${maxArticles} articles for ${source.name}`)
          break
        }
      }

      console.log(`  Found ${articles.length} relevant Reddit posts from ${source.name}`)
      return articles

    } catch (error) {
      console.error(`Error fetching Reddit ${source.name}:`, error)
      return []
    }
  }
}