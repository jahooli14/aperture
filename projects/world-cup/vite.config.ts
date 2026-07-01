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

// Build the full match list straight from BBC (one request, knockout start → +2d).
async function fetchBbc(): Promise<{ matches: any[]; goals: any[] }> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const end = fmt(new Date(now.getTime() + 2 * 86_400_000))
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devScoresApi(env.FOOTBALL_DATA_API_KEY || '')],
  }
})
