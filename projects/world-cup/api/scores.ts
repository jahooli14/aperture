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
  minute?: string | null
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

export interface BbcMatch {
  home: string
  away: string
  homeScore: number | null
  awayScore: number | null
  status: string | null
  minute: string
  homeScorers: Goal[]
  awayScorers: Goal[]
}

// Reconcile team names between BBC and football-data for matching.
const TEAM_ALIAS: Record<string, string> = {
  unitedstates: 'usa',
  usa: 'usa',
  drcongo: 'drcongo',
  congodr: 'drcongo',
  bosniaandherzegovina: 'bosnia',
  bosniaherzegovina: 'bosnia',
  bosnia: 'bosnia',
  capeverde: 'capeverde',
  caboverde: 'capeverde',
  capeverdeislands: 'capeverde',
  cotedivoire: 'ivorycoast',
  ivorycoast: 'ivorycoast',
  southkorea: 'southkorea',
  korearepublic: 'southkorea',
}
function normTeam(n: string): string {
  const k = (n || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
  return TEAM_ALIAS[k] ?? k
}
export function teamPairKey(a: string, b: string): string {
  return [normTeam(a), normTeam(b)].sort().join('|')
}

function bbcScorers(team: any): Goal[] {
  const out: Goal[] = []
  for (const a of team?.actions ?? []) {
    if (a?.actionType !== 'goal') continue
    out.push({ name: a.playerName ?? '', minute: a?.actions?.[0]?.timeLabel?.value ?? '' })
  }
  return out
}
function bbcStatus(s: string): string | null {
  const v = (s || '').toLowerCase()
  if (v.includes('post')) return 'FINISHED'
  if (v.includes('half')) return 'PAUSED'
  if (v.includes('mid') || v.includes('live') || v.includes('play')) return 'IN_PLAY'
  return null
}
function toNum(s: any): number | null {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

// Live score, status and goalscorers from BBC Sport — fresher than the free
// football-data feed, and keeps score + scorers consistent.
async function fetchBbc(): Promise<BbcMatch[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const dates = [today, fmt(new Date(now.getTime() - 86_400_000))]
  const byPair: Record<string, BbcMatch> = {}

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
        byPair[teamPairKey(e.home.fullName, e.away.fullName)] = {
          home: e.home.fullName,
          away: e.away.fullName,
          homeScore: toNum(e.home.score),
          awayScore: toNum(e.away.score),
          status: bbcStatus(e.status),
          minute: e?.periodLabel?.value ?? e?.statusComment?.value ?? '',
          homeScorers: bbcScorers(e.home),
          awayScorers: bbcScorers(e.away),
        }
      }
    } catch {
      /* BBC unavailable — fall back to football-data only */
    }
  }
  return Object.values(byPair)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_API_KEY

  // Edge-cache 20s. Live score/status now come from BBC (fresh); football-data
  // only supplies the schedule + golden boot. 2 calls/20s stays under the limit,
  // and the client keeps the last good data if a poll is ever rate-limited.
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40')

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
    const [matchesResp, scorersResp, bbc] = await Promise.all([
      fetch(`${COMP}/matches`, { headers }),
      fetch(`${COMP}/scorers?limit=20`, { headers }),
      fetchBbc(),
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

    // Overlay BBC's fresher score/status onto the football-data fixtures, and
    // build the per-match goalscorer list (oriented to our home/away order).
    const bbcByPair: Record<string, BbcMatch> = {}
    for (const b of bbc) bbcByPair[teamPairKey(b.home, b.away)] = b
    const goals: MatchGoals[] = []
    for (const m of matches) {
      const b = bbcByPair[teamPairKey(m.home, m.away)]
      if (!b) continue
      const swapped = normTeam(b.home) !== normTeam(m.home)
      if (b.homeScore != null && b.awayScore != null) {
        m.homeScore = swapped ? b.awayScore : b.homeScore
        m.awayScore = swapped ? b.homeScore : b.awayScore
      }
      if (b.status) m.status = b.status
      if (b.minute) m.minute = b.minute
      goals.push({
        home: m.home,
        away: m.away,
        homeScorers: swapped ? b.awayScorers : b.homeScorers,
        awayScorers: swapped ? b.homeScorers : b.awayScorers,
      })
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

    // Don't cache an empty/rate-limited result for long — retry soon instead.
    if (matches.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10')
    }
    res.status(200).json({ configured: true, matches, scorers, goals })
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=5')
    res.status(200).json({
      configured: true,
      matches: [] as LiveMatch[],
      scorers: [] as LiveScorer[],
      message: 'Could not reach the live feed. Showing predictions only.',
    })
  }
}
