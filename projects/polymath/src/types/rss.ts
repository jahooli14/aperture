/**
 * RSS Feed Types
 */

export interface RSSFeed {
  id: string
  user_id: string
  feed_url: string
  title: string
  description: string | null
  site_url: string | null
  favicon_url: string | null
  enabled: boolean
  last_fetched_at: string | null
  created_at: string
  updated_at: string
}

export interface RSSFeedItem {
  guid: string
  feed_id: string
  title: string
  link: string
  description: string | null
  published_at: string | null
  author: string | null
  content?: string
  enclosure?: {
    url: string
    type?: string
  }
}

export interface SaveFeedRequest {
  feed_url: string
}

export interface UpdateFeedRequest {
  id: string
  enabled?: boolean
}

// Preset feeds for quick subscription
export const PRESET_FEEDS = [
  {
    title: 'Anthropic News',
    feed_url: 'https://www.anthropic.com/news/rss.xml',
    description: 'Latest updates from Anthropic',
    category: 'AI Research'
  },
  {
    title: 'OpenAI Blog',
    feed_url: 'https://openai.com/blog/rss.xml',
    description: 'OpenAI research and announcements',
    category: 'AI Research'
  },
  {
    title: 'Hacker News',
    feed_url: 'https://news.ycombinator.com/rss',
    description: 'Top stories from Hacker News',
    category: 'Tech News'
  },
  {
    title: 'TechCrunch',
    feed_url: 'https://techcrunch.com/feed/',
    description: 'Latest tech news and startups',
    category: 'Tech News'
  },
  {
    title: 'The Verge',
    feed_url: 'https://www.theverge.com/rss/index.xml',
    description: 'Technology, science, art, and culture',
    category: 'Tech News'
  }
] as const
