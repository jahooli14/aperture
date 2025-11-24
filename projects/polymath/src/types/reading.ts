/**
 * Reading Queue Types
 */

export type ArticleStatus = 'unread' | 'reading' | 'archived'

export type HighlightColor = 'yellow' | 'blue' | 'green' | 'red'

export interface Article {
  id: string
  user_id: string
  url: string
  title: string | null
  author: string | null
  content: string | null
  excerpt: string | null
  published_date: string | null
  read_time_minutes: number | null
  thumbnail_url: string | null
  favicon_url: string | null
  source: string | null
  status: ArticleStatus
  created_at: string
  read_at: string | null
  archived_at: string | null
  tags: string[]
  word_count: number | null
  notes: string | null
  processed?: boolean // Whether content extraction is complete
}

export interface ArticleHighlight {
  id: string
  article_id: string
  memory_id: string | null
  highlight_text: string
  start_position: number | null
  end_position: number | null
  notes: string | null
  color: HighlightColor
  created_at: string
  updated_at: string
}

export interface SaveArticleRequest {
  url: string
  title?: string
  tags?: string[]
}

export interface UpdateArticleRequest {
  id: string
  status?: ArticleStatus
  tags?: string[]
}
