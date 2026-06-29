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
  minute?: string | null
}

export interface LiveScorer {
  name: string
  team: string
  goals: number
  assists: number
}

export interface Goal {
  name: string
  minute: string
}

export interface MatchGoals {
  home: string
  away: string
  homeScorers: Goal[]
  awayScorers: Goal[]
}

export interface ScoresResponse {
  configured: boolean
  matches: LiveMatch[]
  scorers: LiveScorer[]
  goals?: MatchGoals[]
  message?: string
}
