import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only: serve /api/scores locally using the key from .env, so `npm run dev`
// shows real live data without needing `vercel dev`. In production the real
// serverless function in api/scores.ts handles this instead.
async function fetchBbcGoals(): Promise<any[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const now = new Date()
  const today = fmt(now)
  const dates = [today, fmt(new Date(now.getTime() - 86_400_000))]
  const byPair: Record<string, any> = {}
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
        byPair[`${e.home.fullName}|${e.away.fullName}`.toLowerCase()] = {
          home: e.home.fullName,
          away: e.away.fullName,
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
          const [mRes, sRes, goals] = await Promise.all([
            fetch(`${COMP}/matches`, { headers }),
            fetch(`${COMP}/scorers?limit=20`, { headers }),
            fetchBbcGoals(),
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
