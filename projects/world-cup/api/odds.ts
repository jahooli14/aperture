import type { VercelRequest, VercelResponse } from '@vercel/node'

// Paddy Power's match-winner favorite for each undecided fixture, via
// The Odds API (free tier, 500 requests/month). We only show a plain
// fractional price — no percentages, no betting-style copy.
//
// Cached for an hour at the edge so bursts of page views don't multiply into
// separate upstream calls; the client additionally skips fetching overnight
// (11pm-8am UK) to keep total usage well under quota for the tournament.

export interface MatchOdds {
  home: string
  away: string
  favorite: string
  fractional: string
}

// The standard UK bookmaker fractional-odds ladder — real prices are quoted
// from this set, not an arbitrary reduced fraction of the decimal. Snapping
// to the nearest ladder entry is what makes the result look like something
// you'd actually see (and could check) on Paddy Power's own site.
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

// Nearest standard fractional price for a decimal price's implied profit
// (decimal - 1), e.g. 1.36 -> "4/11". The odds API only speaks decimal.
export function decimalToFractional(decimal: number): string {
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

async function fetchOdds(key: string): Promise<MatchOdds[]> {
  const url =
    'https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/' +
    `?apiKey=${key}&bookmakers=paddypower&markets=h2h&oddsFormat=decimal`
  const r = await fetch(url)
  if (!r.ok) return []
  const events: any[] = await r.json()
  const out: MatchOdds[] = []
  for (const ev of events) {
    const pp = (ev.bookmakers ?? []).find((b: any) => b.key === 'paddypower')
    const h2h = pp?.markets?.find((m: any) => m.key === 'h2h')
    const outcomes: { name: string; price: number }[] = h2h?.outcomes ?? []
    const home = outcomes.find((o) => o.name === ev.home_team)
    const away = outcomes.find((o) => o.name === ev.away_team)
    const draw = outcomes.find((o) => o.name === 'Draw')
    if (!home || !away) continue
    // Whichever of the three 90-min outcomes Paddy Power prices shortest —
    // on an even match that's genuinely the draw, not either team.
    const candidates = [home, away, ...(draw ? [draw] : [])]
    const favorite = candidates.reduce((a, b) => (b.price < a.price ? b : a))
    if (candidates.filter((o) => o.price === favorite.price).length > 1) continue // tie, no clear favorite
    out.push({
      home: ev.home_team,
      away: ev.away_team,
      favorite: favorite.name,
      fractional: decimalToFractional(favorite.price),
    })
  }
  return out
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.ODDS_API_KEY
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800')

  if (!key) {
    res.status(200).json({ configured: false, odds: [] })
    return
  }

  try {
    const odds = await fetchOdds(key)
    res.status(200).json({ configured: true, odds })
  } catch {
    res.status(200).json({ configured: true, odds: [] })
  }
}
