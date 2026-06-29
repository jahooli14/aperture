import type { VercelRequest, VercelResponse } from '@vercel/node'

// Live World Cup data, served to the browser without CORS issues or an API key.
//
// BBC Sport's public scores-fixtures feed is the primary (and only required)
// source — it carries score, status, minute and goalscorers, and it's fresher
// than the free football-data.org tier. football-data is used ONLY as a
// best-effort golden-boot leaderboard, and is skipped entirely if no key is set
// or the account is unavailable. Everything still works with BBC alone.

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

// Normalise team names so the static predictions line up with BBC's names.
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

// Stable-ish numeric id from the BBC event id (or pair key) so React keys hold.
function hashId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function bbcScorers(team: any): Goal[] {
  const out: Goal[] = []
  for (const a of team?.actions ?? []) {
    if (a?.actionType !== 'goal') continue
    out.push({ name: a.playerName ?? '', minute: a?.actions?.[0]?.timeLabel?.value ?? '' })
  }
  return out
}
function bbcStatus(s: string): string {
  const v = (s || '').toLowerCase()
  if (v.includes('post')) return 'FINISHED'
  if (v.includes('half')) return 'PAUSED'
  if (v.includes('mid') || v.includes('live') || v.includes('play')) return 'IN_PLAY'
  return 'SCHEDULED'
}
function toNum(s: any): number | null {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

// Build the full match list straight from BBC. Queries yesterday → tomorrow so
// just-finished, live, and next-up games all appear.
async function fetchBbc(): Promise<{ matches: LiveMatch[]; goals: MatchGoals[] }> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const dates = [
    fmt(new Date(now.getTime() - 86_400_000)),
    today,
    fmt(new Date(now.getTime() + 86_400_000)),
  ]
  const byPair: Record<string, { match: LiveMatch; goals: MatchGoals }> = {}

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
        const home = e.home.fullName
        const away = e.away.fullName
        const key = teamPairKey(home, away)
        byPair[key] = {
          match: {
            id: hashId(e.id ?? key),
            utcDate: e.startDateTime ?? e?.date?.iso ?? '',
            status: bbcStatus(e.status),
            stage: '',
            home,
            away,
            homeScore: toNum(e.home.score),
            awayScore: toNum(e.away.score),
            venue: null,
            minute: e?.periodLabel?.value ?? e?.statusComment?.value ?? '',
          },
          goals: {
            home,
            away,
            homeScorers: bbcScorers(e.home),
            awayScorers: bbcScorers(e.away),
          },
        }
      }
    } catch {
      /* skip this date */
    }
  }
  const matches: LiveMatch[] = []
  const goals: MatchGoals[] = []
  for (const v of Object.values(byPair)) {
    matches.push(v.match)
    goals.push(v.goals)
  }
  return { matches, goals }
}

// Best-effort golden-boot leaderboard from football-data. Optional — if the key
// is missing or the account is unavailable, we just return no scorers.
async function fetchScorers(key: string | undefined): Promise<LiveScorer[]> {
  if (!key) return []
  try {
    const r = await fetch('https://api.football-data.org/v4/competitions/WC/scorers?limit=20', {
      headers: { 'X-Auth-Token': key },
    })
    if (!r.ok) return []
    const data: any = await r.json()
    return (data.scorers ?? []).map((s: any) => ({
      name: s.player?.name ?? 'Unknown',
      team: s.team?.name ?? '',
      goals: s.goals ?? 0,
      assists: s.assists ?? 0,
    }))
  } catch {
    return []
  }
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.FOOTBALL_DATA_API_KEY

  // Edge-cache 20s; client keeps last-good data between polls.
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40')

  try {
    const [{ matches, goals }, scorers] = await Promise.all([fetchBbc(), fetchScorers(key)])

    // Don't cache an empty result for long — retry soon.
    if (matches.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10')
    }
    res.status(200).json({ configured: true, matches, scorers, goals })
  } catch {
    res.setHeader('Cache-Control', 's-maxage=5')
    res.status(200).json({
      configured: true,
      matches: [] as LiveMatch[],
      scorers: [] as LiveScorer[],
      message: 'Could not reach the live feed. Showing predictions only.',
    })
  }
}
