export type TurnMode = 'rotation' | 'open'
export type StoryStatus = 'active' | 'finished' | 'archived'

export interface Profile {
  user_id: string
  display_name: string
}

export interface Member {
  user_id: string
  role: 'owner' | 'writer'
  turn_order: number
  notify: boolean
  joined_at: string
  display_name: string
}

export interface Story {
  id: string
  title: string
  blurb: string | null
  created_by: string
  turn_mode: TurnMode
  next_author_id: string | null
  status: StoryStatus
  max_members: number
  created_at: string
  updated_at: string
  last_line_at: string | null
}

export interface Line {
  id: string
  author_id: string
  body: string
  position: number
  created_at: string
  chapter_title: string | null
  display_name: string
  /** Shown immediately on send, before the server has confirmed it. */
  pending?: boolean
}

export interface StoryStats {
  lineCount: number
  wordCount: number
  authors: { user_id: string; lines: number; words: number }[]
  chapters: { title: string; position: number }[]
  startedAt: string | null
  lastLineAt: string | null
  daysRunning: number
  daysSinceLastLine: number | null
  longestGapDays: number
  averageWordsPerLine: number
}

export interface StorySummary extends Story {
  members: { user_id: string; turn_order: number; display_name: string }[]
  last_line: { author_id: string; body: string; display_name: string } | null
  whose_turn: string | null
  can_write: boolean
}

export interface StoryDetail {
  story: Story
  members: Member[]
  stats: StoryStats
  whose_turn: string | null
  can_write: boolean
}

export interface IndexEntry {
  name: string
  note: string
  lines: number[]
}

export interface StoryIndex {
  people: IndexEntry[]
  places: IndexEntry[]
  threads: IndexEntry[]
}

export interface StoryIndexResponse {
  index: StoryIndex | null
  generated_at: string | null
  up_to_position: number
  last_position: number
  behind_by: number
  available: boolean
  enough_lines: boolean
  storage_ready: boolean
  key_env_names?: string[]
}
