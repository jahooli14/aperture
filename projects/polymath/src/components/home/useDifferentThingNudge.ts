/**
 * The monthly "try something different" quota, as a nudge on the home
 * chat row rather than a card of its own.
 *
 * SPEC.md's rule is that focus must not quietly become a rut: once a month
 * the app should push an hour onto something that isn't the live project.
 * The first cut gave that its own box on Home with three buttons — which
 * made it a second answer competing with the real one.
 *
 * It isn't a different kind of thing from steering. It's steering that the
 * app started. So it borrows the steer row's text for a month, and tapping
 * it opens the same conversation with the suggestion already said out loud.
 *
 * Which project: the least-recently-touched one that isn't live or
 * harvested. One suggestion the app is willing to stand behind, never a
 * list to pick from.
 */

import { useEffect, useMemo, useState } from 'react'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project } from '../../types'

export interface DifferentThingNudge {
  /** The line shown in the steer row. Null when the quota isn't due. */
  text: string | null
  /** What the chat is seeded with when the row is tapped. */
  opener: string | null
  project: Project | null
}

const EMPTY: DifferentThingNudge = { text: null, opener: null, project: null }

export function useDifferentThingNudge(): DifferentThingNudge {
  const [due, setDue] = useState(false)
  const projects = useProjectStore(s => s.projects)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/utilities?resource=different-thing-status')
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setDue(!!data?.should_nudge)
      } catch {
        // Silent — a missed nudge is not worth an error on the home page.
      }
    })()
    return () => { cancelled = true }
  }, [])

  return useMemo(() => {
    if (!due) return EMPTY
    const candidate = projects
      .filter(p =>
        p.state !== 'harvested' &&
        p.state !== 'live' &&
        p.status !== 'graveyard' &&
        p.status !== 'completed' &&
        p.metadata?.is_shaped !== false,
      )
      .sort((a, b) => {
        const at = new Date(a.last_active || a.created_at || 0).getTime()
        const bt = new Date(b.last_active || b.created_at || 0).getTime()
        return at - bt
      })[0]

    if (!candidate) return EMPTY
    return {
      text: `It's been a month on the same things. An hour on ${candidate.title}?`,
      opener: `I want to spend an hour on ${candidate.title} instead — it's been sat there a while. What would I actually do with it?`,
      project: candidate,
    }
  }, [due, projects])
}
