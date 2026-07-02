import { useEffect, useRef, useState } from 'react'
import type { MatchOdds, OddsResponse } from './types'
import { pairKey } from './logic'

// Poll every 20 min — the edge cache on /api/odds backstops the real upstream
// call to once an hour regardless, this just controls how soon a page catches
// a fresh hour's price.
const POLL_MS = 20 * 60_000

const ukHourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: 'numeric',
  hourCycle: 'h23',
})

// Odds don't need updating overnight, and skipping the fetch entirely (rather
// than just caching longer) keeps the free-tier request count comfortably
// under budget for the rest of the tournament.
function isUkQuietHours(): boolean {
  const hour = Number(ukHourFmt.format(new Date()))
  return hour >= 23 || hour < 8
}

export function useOdds() {
  const [odds, setOdds] = useState<MatchOdds[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let active = true

    const fetchOnce = async () => {
      if (isUkQuietHours()) return
      try {
        const resp = await fetch('/api/odds')
        if (!resp.ok) return
        const data = (await resp.json()) as OddsResponse
        if (!active || !data.configured || !data.odds?.length) return
        // The Odds API stops listing a match once it kicks off, so merge
        // rather than replace — a game's pre-match price stays put through
        // kickoff instead of vanishing the moment the fetch no longer has it.
        setOdds((prev) => {
          const merged = [...prev]
          for (const fresh of data.odds) {
            const key = pairKey(fresh.home, fresh.away)
            const i = merged.findIndex((m) => pairKey(m.home, m.away) === key)
            if (i >= 0) merged[i] = fresh
            else merged.push(fresh)
          }
          return merged
        })
      } catch {
        /* keep last-known odds */
      }
    }

    const loop = async () => {
      if (!active) return
      await fetchOnce()
      if (!active) return
      timer.current = setTimeout(loop, POLL_MS)
    }
    loop()

    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return odds
}
