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
function bbcStatus(s: string): string | null {
  const v = (s || '').toLowerCase()
  if (v.includes('post')) return 'FINISHED'
  if (v.includes('half')) return 'PAUSED'
  if (v.includes('mid') || v.includes('live') || v.includes('play')) return 'IN_PLAY'
  return null
}

async function fetchBbc(): Promise<any[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const dates = [today, fmt(new Date(now.getTime() - 86_400_000))]
  const byPair: Record<string, any> = {}
  const num = (s: any) => (Number.isFinite(parseInt(s, 10)) ? parseInt(s, 10) : null)
  const sc = (t: any) =>
    (t?.actions ?? [])
      .filter((a: any) => a?.actionType === 'goal')
      .map((a: any) => ({ name: a.playerName ?? '', minute: a?.actions?.[0]?.timeLabel?.value ?? '' }))
  for (const d of dates) {
    try {
      const url =
        'https://web-cdn.api.bbci.co.uk/wc-poll-data/container/sport-data-scores-fixtures' +
        `?selectedStartDate=${d}&selectedEndDate=${d}&todayDate=${today}&urn=urn:bbc:sportsdata:football`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (!r.ok) continue
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
        byPair[teamPairKey(e.home.fullName, e.away.fullName)] = {
          home: e.home.fullName,
          away: e.away.fullName,
          homeScore: num(e.home.score),
          awayScore: num(e.away.score),
          status: bbcStatus(e.status),
          homeScorers: sc(e.home),
          awayScorers: sc(e.away),
        }
      }
    } catch {
      /* skip */
    }
  }
  return Object.values(byPair)
}

function devScoresApi(key: string): Plugin {
  const COMP = 'https://api.football-data.org/v4/competitions/WC'
  return {
    name: 'dev-scores-api',
    configureServer(server) {
      server.middlewares.use('/api/scores', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        if (!key) {
          res.end(JSON.stringify({ configured: false, matches: [], scorers: [] }))
          return
        }
        try {
          const headers = { 'X-Auth-Token': key }
          const [mRes, sRes, bbc] = await Promise.all([
            fetch(`${COMP}/matches`, { headers }),
            fetch(`${COMP}/scorers?limit=20`, { headers }),
            fetchBbc(),
          ])
          const mJson: any = mRes.ok ? await mRes.json() : { matches: [] }
          const sJson: any = sRes.ok ? await sRes.json() : { scorers: [] }
          const matches = (mJson.matches ?? []).map((m: any) => ({
            id: m.id,
            utcDate: m.utcDate,
            status: m.status,
            stage: m.stage,
            home: m.homeTeam?.name ?? 'TBD',
            away: m.awayTeam?.name ?? 'TBD',
            homeScore: m.score?.fullTime?.home ?? null,
            awayScore: m.score?.fullTime?.away ?? null,
            venue: m.venue ?? null,
          }))
          const bbcByPair: Record<string, any> = {}
          for (const b of bbc) bbcByPair[teamPairKey(b.home, b.away)] = b
          const goals: any[] = []
          for (const m of matches) {
            const b = bbcByPair[teamPairKey(m.home, m.away)]
            if (!b) continue
            const swapped = normTeam(b.home) !== normTeam(m.home)
            if (b.homeScore != null && b.awayScore != null) {
              m.homeScore = swapped ? b.awayScore : b.homeScore
              m.awayScore = swapped ? b.homeScore : b.awayScore
            }
            if (b.status) m.status = b.status
            goals.push({
              home: m.home,
              away: m.away,
              homeScorers: swapped ? b.awayScorers : b.homeScorers,
              awayScorers: swapped ? b.homeScorers : b.awayScorers,
            })
          }
          const scorers = (sJson.scorers ?? []).map((s: any) => ({
            name: s.player?.name ?? 'Unknown',
            team: s.team?.name ?? '',
            goals: s.goals ?? 0,
            assists: s.assists ?? 0,
          }))
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
