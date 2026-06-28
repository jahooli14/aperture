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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_API_KEY

  // Cache at the edge for 30s so rapid polling doesn't burn the rate limit.
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')

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
    const [matchesResp, scorersResp] = await Promise.all([
      fetch(`${COMP}/matches`, { headers }),
      fetch(`${COMP}/scorers?limit=20`, { headers }),
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

    res.status(200).json({ configured: true, matches, scorers })
  } catch (err) {
    res.status(200).json({
      configured: true,
      matches: [] as LiveMatch[],
      scorers: [] as LiveScorer[],
      message: 'Could not reach the live feed. Showing predictions only.',
    })
  }
}
