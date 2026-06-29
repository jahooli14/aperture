import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScoresResponse } from './types'

const POLL_LIVE_MS = 15_000 // a game is in play — refresh fast
const POLL_IDLE_MS = 45_000 // nothing live — ease off

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
      liveRef.current = anyLive(data)
      setState({ data, loading: false, error: null, lastUpdated: new Date() })
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
    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [fetchOnce])

  return { ...state, refresh: fetchOnce }
}
