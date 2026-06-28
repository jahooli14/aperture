# World Cup 2026 — My Predictions

A mobile-first, World Cup–themed page showing **my predictions vs the live scores**,
with accuracy scoring, a real-bracket-vs-mine view, confetti when a prediction comes
true, and a live Golden Boot table (my pick: Harry Kane 🏴󠁧󠁢󠁥󠁮󠁧󠁿).

## How it works (the three platforms)

| Concern | Platform | Where |
|---|---|---|
| **Source code + version control** | **GitHub** | This repo. Pushing to `main` triggers a Vercel deploy. |
| **Hosting (the website)** | **Vercel** | Builds `dist/` from the Vite app and serves it at your URL. |
| **Live scores API (serverless)** | **Vercel** | `api/scores.ts` runs as a serverless function, calls football-data.org server-side so the API key stays secret. |
| **Database / auth** | **Supabase** | ❌ Not used — this app has no accounts or stored data. |

So: **GitHub** stores the code, **Vercel** builds + hosts + runs the one API
function, and **Supabase is not involved at all**.

## Setup

1. **Create a Vercel project** pointing at this folder (`projects/world-cup`) as the root.
2. **Get a free API key** from [football-data.org](https://www.football-data.org/client/register).
3. In Vercel → Project → Settings → Environment Variables, add:
   - `FOOTBALL_DATA_API_KEY` = your key
4. Deploy (push to `main`).

Without the key, the page still shows all predictions — it just says live scores
aren't switched on yet.

## Local dev

```bash
npm install
npm run dev          # http://localhost:5173 — predictions render; live API is empty locally
vercel dev           # optional: run the /api/scores function locally too
```

## The data

All my predictions live in `src/predictions.ts` (Round of 32 → Final), plus the
Golden Boot pick. Live data is matched to predictions by team pairing, so it's
robust to home/away ordering and stage-label differences.
