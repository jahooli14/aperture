import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only: serve /api/scores locally using the key from .env, so `npm run dev`
// shows real live data without needing `vercel dev`. In production the real
// serverless function in api/scores.ts handles this instead.
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
          const [mRes, sRes] = await Promise.all([
            fetch(`${COMP}/matches`, { headers }),
            fetch(`${COMP}/scorers?limit=20`, { headers }),
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
          res.end(JSON.stringify({ configured: true, matches, scorers }))
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
