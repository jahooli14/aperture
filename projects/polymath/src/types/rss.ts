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

// Curated starter feeds shown in the Add-feed sheet when there's no search.
// EVERY url here was HTTP-verified live (200 + valid RSS/Atom) fetched
// DIRECT — no proxy needed — so tapping one always works. Real feeds that
// IP-block Vercel (The Verge, Wired, Ars, NYT, Guardian, Atlantic…) are
// deliberately excluded: they only succeed via the flaky free-proxy path,
// so they'd be unreliable as one-tap presets. Add those via URL instead.
// Last audited: 2026-05-22.
export const PRESET_FEEDS = [
  // AI / ML
  { title: 'Google DeepMind', feed_url: 'https://deepmind.google/blog/rss.xml', description: 'Research and announcements from DeepMind', category: 'AI' },
  { title: 'Hugging Face', feed_url: 'https://huggingface.co/blog/feed.xml', description: 'Open-source ML, models, and tooling', category: 'AI' },
  { title: 'Import AI', feed_url: 'https://jack-clark.net/feed/', description: "Jack Clark's weekly AI policy + research newsletter", category: 'AI' },
  { title: 'LessWrong', feed_url: 'https://www.lesswrong.com/feed.xml', description: 'Rationality, alignment, and AI safety', category: 'AI' },

  // Tech
  { title: 'Hacker News', feed_url: 'https://news.ycombinator.com/rss', description: 'Top stories from Hacker News', category: 'Tech' },
  { title: 'TechCrunch', feed_url: 'https://techcrunch.com/feed/', description: 'Startup and tech industry news', category: 'Tech' },
  { title: 'Engadget', feed_url: 'https://www.engadget.com/rss.xml', description: 'Consumer tech and gadgets', category: 'Tech' },
  { title: 'MIT Technology Review', feed_url: 'https://www.technologyreview.com/feed/', description: 'Deep tech, biotech, and policy', category: 'Tech' },
  { title: 'Lobsters', feed_url: 'https://lobste.rs/rss', description: 'Computing-focused link aggregator', category: 'Tech' },
  { title: 'The Pragmatic Engineer', feed_url: 'https://newsletter.pragmaticengineer.com/feed', description: 'Big Tech and startups, from the inside', category: 'Tech' },
  { title: 'Stratechery', feed_url: 'https://stratechery.com/feed/', description: 'Ben Thompson on tech strategy', category: 'Tech' },
  { title: '404 Media', feed_url: 'https://www.404media.co/rss/', description: 'Journalist-owned reporting on tech and power', category: 'Tech' },

  // Design & Dev
  { title: 'Smashing Magazine', feed_url: 'https://www.smashingmagazine.com/feed/', description: 'Web design and front-end development', category: 'Design & Dev' },
  { title: 'CSS-Tricks', feed_url: 'https://css-tricks.com/feed/', description: 'CSS, JavaScript, and web craft', category: 'Design & Dev' },
  { title: 'Simon Willison', feed_url: 'https://simonwillison.net/atom/everything/', description: 'Practical notes on LLMs, Python, and tools', category: 'Design & Dev' },
  { title: 'Overreacted', feed_url: 'https://overreacted.io/rss.xml', description: "Dan Abramov on React and JavaScript", category: 'Design & Dev' },

  // Science
  { title: 'Quanta Magazine', feed_url: 'https://www.quantamagazine.org/feed/', description: 'Maths, physics, biology, computer science', category: 'Science' },
  { title: 'ScienceDaily', feed_url: 'https://www.sciencedaily.com/rss/all.xml', description: 'Latest research across all fields', category: 'Science' },
  { title: 'Nature', feed_url: 'https://www.nature.com/nature.rss', description: 'Headline research from Nature', category: 'Science' },

  // Culture & World
  { title: 'BBC News', feed_url: 'https://feeds.bbci.co.uk/news/rss.xml', description: 'Top stories from the BBC', category: 'Culture & World' },
  { title: 'Wait But Why', feed_url: 'https://waitbutwhy.com/feed', description: 'Long-form deep dives by Tim Urban', category: 'Culture & World' },
  { title: 'Rest of World', feed_url: 'https://restofworld.org/feed/latest/', description: 'Tech and culture beyond the West', category: 'Culture & World' },
] as const

