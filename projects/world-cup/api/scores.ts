import type { VercelRequest, VercelResponse } from '@vercel/node'

// Proxies live World Cup data from football-data.org so the browser never sees
// the API key and CORS is avoided. Set FOOTBALL_DATA_API_KEY in Vercel.
//
// Free-tier docs: https://www.football-data.org/documentation/quickstart
// Competition code for the FIFA World Cup is "WC".

interface FeedTeam {
  name: string | null
  shortName?: string | null
  tla?: string | null
}

interface FeedMatch {
  id: number
  utcDate: string
  status: string
  stage: string
  venue?: string | null
  homeTeam: FeedTeam
  awayTeam: FeedTeam
  score: {
    winner: string | null
    fullTime: { home: number | null; away: number | null }
  }
}

interface FeedScorer {
  player: { name: string | null }
  team: { name: string | null }
  goals: number | null
  assists: number | null
  penalties: number | null
}

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

const COMP = 'https://api.football-data.org/v4/competitions/WC'

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

function bbcScorers(team: any): Goal[] {
  const out: Goal[] = []
  for (const a of team?.actions ?? []) {
    if (a?.actionType !== 'goal') continue
    out.push({ name: a.playerName ?? '', minute: a?.actions?.[0]?.timeLabel?.value ?? '' })
  }
  return out
}

// Goalscorers per match from BBC Sport (the free football-data tier has none).
async function fetchBbcGoals(): Promise<MatchGoals[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const dates = [today, fmt(new Date(now.getTime() - 86_400_000))]
  const byPair: Record<string, MatchGoals> = {}

  for (const d of dates) {
    try {
      const url =
        'https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures' +
        `?selectedStartDate=${d}&selectedEndDate=${d}&todayDate=${today}&urn=urn:bbc:sportsdata:football`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!r.ok) continue
      const data: any = await r.json()
      const wc = (data.eventGroups ?? []).filter((g: any) =>
        (g.displayLabel ?? '').includes('World Cup')
      )
      const events: any[] = []
      const walk = (o: any) => {
        if (Array.isArray(o)) o.forEach(walk)
        else if (o && typeof o === 'object') {
          if (o.home?.fullName && o.away?.fullName) events.push(o)
          Object.values(o).forEach(walk)
        }
      }
      walk(wc)
      for (const e of events) {
        const home = e.home.fullName as string
        const away = e.away.fullName as string
        byPair[`${home}|${away}`.toLowerCase()] = {
          home,
          away,
          homeScorers: bbcScorers(e.home),
          awayScorers: bbcScorers(e.away),
        }
      }
    } catch {
      /* BBC unavailable — just skip goals */
    }
  }
  return Object.values(byPair)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_API_KEY

  // Cache at the edge for 15s (well under the feed's 10 req/min limit) so live
  // scores refresh quickly without hammering the upstream API.
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30')

  if (!key) {
    res.status(200).json({
      configured: false,
      matches: [] as LiveMatch[],
      scorers: [] as LiveScorer[],
      message:
        'No FOOTBALL_DATA_API_KEY set. Add a free key from football-data.org in your Vercel env vars to see live scores.',
    })
    return
  }

  const headers = { 'X-Auth-Token': key }

  try {
    const [matchesResp, scorersResp, goals] = await Promise.all([
      fetch(`${COMP}/matches`, { headers }),
      fetch(`${COMP}/scorers?limit=20`, { headers }),
      fetchBbcGoals(),
    ])

    const matches: LiveMatch[] = []
    if (matchesResp.ok) {
      const data = (await matchesResp.json()) as { matches?: FeedMatch[] }
      for (const m of data.matches ?? []) {
        matches.push({
          id: m.id,
          utcDate: m.utcDate,
          status: m.status,
          stage: m.stage,
          home: m.homeTeam?.name ?? m.homeTeam?.shortName ?? 'TBD',
          away: m.awayTeam?.name ?? m.awayTeam?.shortName ?? 'TBD',
          homeScore: m.score?.fullTime?.home ?? null,
          awayScore: m.score?.fullTime?.away ?? null,
          venue: m.venue ?? null,
        })
      }
    }

    const scorers: LiveScorer[] = []
    if (scorersResp.ok) {
      const data = (await scorersResp.json()) as { scorers?: FeedScorer[] }
      for (const s of data.scorers ?? []) {
        scorers.push({
          name: s.player?.name ?? 'Unknown',
          team: s.team?.name ?? '',
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
        })
      }
    }

    res.status(200).json({ configured: true, matches, scorers, goals })
  } catch (err) {
    res.status(200).json({
      configured: true,
      matches: [] as LiveMatch[],
      scorers: [] as LiveScorer[],
      message: 'Could not reach the live feed. Showing predictions only.',
    })
  }
}
