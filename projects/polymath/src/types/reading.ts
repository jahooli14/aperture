/**
 * Reading Queue Types
 */

export type ArticleStatus = 'unread' | 'reading' | 'archived'

export type HighlightColor = 'yellow' | 'blue' | 'green' | 'red'

/**
 * The end-of-article verdict. This is the ONLY thing that lets an article
 * into the corpus — 'good' means it can shape project ideas, 'not_for_me'
 * means it never will, and null means the question hasn't been answered.
 */
export type ArticleResonance = 'good' | 'not_for_me'

/** Three bullets, cached on the row so the call happens once per article. */
export interface ArticleGist {
  bullets: string[]
  topics: string[]
  generated_at: string
  model?: string
}

export interface ArticleMetadata {
  gist?: ArticleGist
  /** Set when the article was too short to be worth a gist. Stops retries. */
  gist_skipped_at?: string
  [key: string]: unknown
}

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
  is_rotting?: boolean // Whether the article has been in the queue too long
  resonance?: ArticleResonance | null
  resonance_at?: string | null
  themes?: string[] | null
  metadata?: ArticleMetadata | null
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
  content?: string
  excerpt?: string
}

export interface UpdateArticleRequest {
  id: string
  status?: ArticleStatus
  tags?: string[]
}

export interface SetResonanceRequest {
  id: string
  /** null clears the verdict — that's what Undo sends. */
  resonance: ArticleResonance | null
}
