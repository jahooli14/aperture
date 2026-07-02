import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only: serve /api/scores locally using the key from .env, so `npm run dev`
// shows real live data without needing `vercel dev`. In production the real
// serverless function in api/scores.ts handles this instead.
const TEAM_ALIAS: Record<string, string> = {
  unitedstates: 'usa', usa: 'usa', drcongo: 'drcongo', congodr: 'drcongo',
  bosniaandherzegovina: 'bosnia', bosniaherzegovina: 'bosnia', bosnia: 'bosnia',
  capeverde: 'capeverde', caboverde: 'capeverde', capeverdeislands: 'capeverde',
  cotedivoire: 'ivorycoast', ivorycoast: 'ivorycoast',
  southkorea: 'southkorea', korearepublic: 'southkorea',
}
function normTeam(n: string): string {
  const k = (n || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
  return TEAM_ALIAS[k] ?? k
}
function teamPairKey(a: string, b: string): string {
  return [normTeam(a), normTeam(b)].sort().join('|')
}
function bbcStatus(s: string): string {
  const v = (s || '').toLowerCase()
  if (v.includes('post')) return 'FINISHED'
  if (v.includes('half')) return 'PAUSED'
  if (v.includes('mid') || v.includes('live') || v.includes('play')) return 'IN_PLAY'
  return 'SCHEDULED'
}
function hashId(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const KNOCKOUT_START = '2026-06-27'
const KNOCKOUT_END = '2026-07-20'

// Build the full match list straight from BBC (one request, whole knockout window).
async function fetchBbc(): Promise<{ matches: any[]; goals: any[] }> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const end = KNOCKOUT_END
  const byPair: Record<string, { match: any; goals: any }> = {}
  const num = (s: any) => (Number.isFinite(parseInt(s, 10)) ? parseInt(s, 10) : null)
  const sc = (t: any) =>
    (t?.actions ?? [])
      .filter((a: any) => a?.actionType === 'goal')
      .flatMap((a: any) => {
        const events: any[] = Array.isArray(a.actions) && a.actions.length ? a.actions : [null]
        return events.map((ev: any) => ({
          name: (a.playerName ?? '') + ((ev?.type ?? '').toLowerCase().includes('own') ? ' (OG)' : ''),
          minute: ev?.timeLabel?.value ?? '',
        }))
      })
  try {
    const url =
      'https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures' +
      `?selectedStartDate=${KNOCKOUT_START}&selectedEndDate=${end}&todayDate=${today}&urn=urn:bbc:sportsdata:football`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (r.ok) {
      const data: any = await r.json()
      const wc = (data.eventGroups ?? []).filter((g: any) => (g.displayLabel ?? '').includes('World Cup'))
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
        const advancer = e.winner === 'home' ? home : e.winner === 'away' ? away : null
        byPair[key] = {
          match: {
            id: hashId(e.id ?? key),
            utcDate: e.startDateTime ?? e?.date?.iso ?? '',
            status: bbcStatus(e.status),
            stage: e?.stage?.name ?? '',
            home,
            away,
            homeScore: num(e.home.score),
            awayScore: num(e.away.score),
            venue: null,
            minute: e?.periodLabel?.value ?? e?.statusComment?.value ?? '',
            advancer,
          },
          goals: { home, away, homeScorers: sc(e.home), awayScorers: sc(e.away) },
        }
      }
    }
  } catch {
    /* skip */
  }
  const matches: any[] = []
  const goals: any[] = []
  for (const v of Object.values(byPair)) {
    matches.push(v.match)
    goals.push(v.goals)
  }
  return { matches, goals }
}

async function fetchScorers(key: string): Promise<any[]> {
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

function devScoresApi(key: string): Plugin {
  return {
    name: 'dev-scores-api',
    configureServer(server) {
      server.middlewares.use('/api/scores', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        try {
          const [{ matches, goals }, scorers] = await Promise.all([fetchBbc(), fetchScorers(key)])
          res.end(JSON.stringify({ configured: true, matches, scorers, goals }))
        } catch {
          res.end(JSON.stringify({ configured: true, matches: [], scorers: [] }))
        }
      })
    },
  }
}

// Dev-only: serve /api/odds locally the same way, so `npm run dev` shows real
// Paddy Power prices without needing `vercel dev` (whose SPA rewrite emulation
// breaks Vite's own dev asset requests — see api/odds.ts for the real function).
const ODDS_LADDER: [number, number][] = [
  [1, 100], [1, 50], [1, 33], [1, 25], [1, 20], [1, 16], [1, 14], [1, 12],
  [1, 10], [1, 9], [1, 8], [2, 15], [1, 7], [2, 13], [1, 6], [2, 11],
  [1, 5], [2, 9], [1, 4], [2, 7], [1, 3], [4, 11], [2, 5], [4, 9],
  [1, 2], [8, 15], [4, 7], [8, 13], [2, 3], [5, 6], [10, 11], [1, 1],
  [11, 10], [6, 5], [5, 4], [11, 8], [3, 2], [13, 8], [7, 4], [15, 8],
  [2, 1], [9, 4], [5, 2], [11, 4], [3, 1], [10, 3], [7, 2], [4, 1],
  [9, 2], [5, 1], [11, 2], [6, 1], [13, 2], [7, 1], [15, 2], [8, 1],
  [9, 1], [10, 1], [11, 1], [12, 1], [14, 1], [16, 1], [20, 1], [25, 1],
  [33, 1], [50, 1], [66, 1], [100, 1],
]
function decimalToFractional(decimal: number): string {
  const x = decimal - 1
  let best = ODDS_LADDER[0]
  let bestErr = Infinity
  for (const [num, den] of ODDS_LADDER) {
    const err = Math.abs(num / den - x)
    if (err < bestErr) {
      bestErr = err
      best = [num, den]
    }
  }
  return `${best[0]}/${best[1]}`
}
async function fetchOdds(key: string): Promise<any[]> {
  if (!key) return []
  const url =
    'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/' +
    `?apiKey=${key}&bookmakers=paddypower&markets=h2h&oddsFormat=decimal`
  const r = await fetch(url)
  if (!r.ok) return []
  const events: any[] = await r.json()
  const out: any[] = []
  for (const ev of events) {
    const pp = (ev.bookmakers ?? []).find((b: any) => b.key === 'paddypower')
    const h2h = pp?.markets?.find((m: any) => m.key === 'h2h')
    const outcomes: { name: string; price: number }[] = h2h?.outcomes ?? []
    const home = outcomes.find((o) => o.name === ev.home_team)
    const away = outcomes.find((o) => o.name === ev.away_team)
    const draw = outcomes.find((o) => o.name === 'Draw')
    if (!home || !away) continue
    const candidates = [home, away, ...(draw ? [draw] : [])]
    const favorite = candidates.reduce((a, b) => (b.price < a.price ? b : a))
    if (candidates.filter((o) => o.price === favorite.price).length > 1) continue
    out.push({
      home: ev.home_team,
      away: ev.away_team,
      favorite: favorite.name,
      fractional: decimalToFractional(favorite.price),
    })
  }
  return out
}
function devOddsApi(key: string): Plugin {
  return {
    name: 'dev-odds-api',
    configureServer(server) {
      server.middlewares.use('/api/odds', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (!key) {
          res.end(JSON.stringify({ configured: false, odds: [] }))
          return
        }
        try {
          const odds = await fetchOdds(key)
          res.end(JSON.stringify({ configured: true, odds }))
        } catch {
          res.end(JSON.stringify({ configured: true, odds: [] }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      devScoresApi(env.FOOTBALL_DATA_API_KEY || ''),
      devOddsApi(env.ODDS_API_KEY || ''),
    ],
  }
})
