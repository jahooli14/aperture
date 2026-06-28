export interface LiveMatch {
  id: number
  utcDate: string
  status: string // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  stage: string
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  venue: string | null
}

export interface LiveScorer {
  name: string
  team: string
  goals: number
  assists: number
}

export interface ScoresResponse {
  configured: boolean
  matches: LiveMatch[]
  scorers: LiveScorer[]
  message?: string
}
