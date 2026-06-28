import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScoresResponse } from './types'

const POLL_MS = 30_000

interface State {
  data: ScoresResponse | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

export function useLiveData() {
  const [state, setState] = useState<State>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchOnce = useCallback(async () => {
    try {
      const resp = await fetch('/api/scores')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as ScoresResponse
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
      timer.current = setTimeout(loop, POLL_MS)
    }
    loop()
    return () => {
      active = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [fetchOnce])

  return { ...state, refresh: fetchOnce }
}
