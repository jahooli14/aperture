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
  /** For a drawn knockout decided on penalties, the team that actually went through. */
  advancer?: string | null
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

export interface MatchOdds {
  home: string
  away: string
  /** Whichever of the two teams Paddy Power prices shorter. */
  favorite: string
  /** Fractional odds for the favorite, e.g. "4/11". */
  fractional: string
}

export interface OddsResponse {
  configured: boolean
  odds: MatchOdds[]
}
