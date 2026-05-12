/**
 * useStartProjectSession — shared "fetch a Power Hour plan and start a
 * focus session" handler. KeepGoingCard (the priority hero) uses this
 * with a pre-fetched plan; mini cards on the home page use it bare to
 * start a session inline without navigating.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFocusStore } from '../stores/useFocusStore'
import { useToast } from '../components/ui/toast'
import { haptic } from '../utils/haptics'

const SESSION_DURATION_MINUTES = 60

type Task = { id: string; text: string }

function tasksFromPlan(plan: any): Task[] {
  if (!plan) return []
  return [
    ...(plan.ignition_tasks || []).map((t: any, i: number) => ({ id: `ign-${i}`, text: t.text })),
    ...(plan.checklist_items || []).map((t: any, i: number) => ({ id: `core-${i}`, text: t.text })),
    ...(plan.shutdown_tasks || []).map((t: any, i: number) => ({ id: `shut-${i}`, text: t.text })),
  ]
}

interface StartOptions {
  /** Plan already fetched by the parent (e.g. KeepGoingCard prefetches one). */
  prefetched?: any
}

export function useStartProjectSession(projectId: string | undefined | null) {
  const startSession = useFocusStore(s => s.startSession)
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [loading, setLoading] = useState(false)

  const start = async ({ prefetched }: StartOptions = {}) => {
    if (!projectId) return
    haptic.medium()
    setLoading(true)
    try {
      if (prefetched) {
        const tasks = tasksFromPlan(prefetched)
        if (tasks.length > 0) {
          startSession(projectId, tasks)
          return
        }
      }

      const res = await fetch(`/api/power-hour?projectId=${projectId}&duration=${SESSION_DURATION_MINUTES}`)
      if (!res.ok) {
        if (res.status !== 401) {
          const body = await res.json().catch(() => ({}))
          addToast({
            title: "Couldn't plan session",
            description: body.error || `Power Hour API returned ${res.status}`,
            variant: 'destructive',
            action: { label: 'Open project', onClick: () => navigate(`/projects/${projectId}`) },
          })
        }
        return
      }
      const data = await res.json()
      const tasks = tasksFromPlan(data.tasks?.[0])
      if (tasks.length === 0) {
        addToast({
          title: "Couldn't plan session",
          description: 'No tasks were generated for this project.',
          variant: 'destructive',
          action: { label: 'Open project', onClick: () => navigate(`/projects/${projectId}`) },
        })
        return
      }
      startSession(projectId, tasks)
    } catch (err) {
      console.error('[useStartProjectSession] failed:', err)
      addToast({
        title: "Couldn't plan session",
        description: err instanceof Error ? err.message : 'Unexpected error',
        variant: 'destructive',
        action: { label: 'Open project', onClick: () => navigate(`/projects/${projectId}`) },
      })
    } finally {
      setLoading(false)
    }
  }

  return { start, loading }
}
