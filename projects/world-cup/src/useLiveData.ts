import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScoresResponse } from './types'

const POLL_LIVE_MS = 12_000 // a game is in play — refresh often (>= edge cache)
const POLL_IDLE_MS = 60_000 // nothing live — ease off

interface State {
  data: ScoresResponse | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

function anyLive(data: ScoresResponse | null): boolean {
  return !!data?.matches?.some((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')
}

export function useLiveData() {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const liveRef = useRef(false)

  const fetchOnce = useCallback(async () => {
    try {
      const resp = await fetch('/api/scores')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as ScoresResponse
      if (data.matches?.length) liveRef.current = anyLive(data)
      setState((prev) => {
        // If a poll comes back empty (e.g. a transient rate-limit) but we already
        // have data, keep the existing data rather than blanking the screen.
        if ((!data.matches || data.matches.length === 0) && prev.data?.matches?.length) {
          return { ...prev, loading: false }
        }
        return { data, loading: false, error: null, lastUpdated: new Date() }
      })
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load live data',
      }))
    }
  }, [])

  useEffect(() => {
    let active = true
    const loop = async () => {
      if (!active) return
      await fetchOnce()
      if (!active) return
      timer.current = setTimeout(loop, liveRef.current ? POLL_LIVE_MS : POLL_IDLE_MS)
    }
    loop()

    // Backgrounded tabs get their timers throttled by the browser, so a stalled
    // first load (or a missed poll) can sit stale for a long time. Refetch the
    // moment the tab is looked at again instead of waiting on the poll timer.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (timer.current) clearTimeout(timer.current)
      loop()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchOnce])

  return { ...state, refresh: fetchOnce }
}
