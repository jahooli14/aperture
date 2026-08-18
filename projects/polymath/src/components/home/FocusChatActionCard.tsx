/**
 * Confirm/dismiss card for a single Focus chat action proposal — split out
 * of FocusChat.tsx to keep that file under the repo's 300-line convention.
 */

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { useStartProjectSession } from '../../hooks/useStartProjectSession'
import { useToast } from '../ui/toast'
import { type PortfolioAction, describeAction, isUpNextActionNoOp, isSetPriorityNoOp } from './focusChatOps'

export function FocusChatActionCard({ action, resolved, dismissed, blockedByPendingTaskOp, onResolve, onDismiss }: {
  action: PortfolioAction
  resolved?: boolean
  dismissed?: boolean
  /** True when ANY turn this session still has an unresolved taskOp
   *  correcting this same project's next step (not just this message —
   *  the correction and the "start it" request can land in separate
   *  turns). start_session pulls tasks straight from the database
   *  (api/power-hour), so starting before that fix lands would launch a
   *  session built from the stale text the user just corrected. */
  blockedByPendingTaskOp?: boolean
  onResolve: () => void
  onDismiss: () => void
}) {
  const { setPriority, setUpNext, replaceUpNext, fetchProjects } = useProjectStore()
  const targetProject = useProjectStore(s => s.allProjects.find(p => p.id === action.projectId))
  const currentUpNextPosition = targetProject?.up_next_position ?? null
  const { start, loading: starting } = useStartProjectSession(action.projectId)
  const { addToast } = useToast()
  const [applying, setApplying] = useState(false)
  const { label, verb } = describeAction(action.type)
  const isBlocked = action.type === 'start_session' && !!blockedByPendingTaskOp

  const apply = async () => {
    if (isBlocked) return
    setApplying(true)
    try {
      // Without this, a project deleted/buried elsewhere between the
      // action being proposed and confirmed would make the no-op guards
      // below (which read targetProject) silently treat it as "already
      // satisfied" and flip to a false "Done" instead of surfacing that
      // the mutation never actually happened.
      if (!targetProject) throw new Error('This project is no longer available.')

      switch (action.type) {
        case 'start_session': {
          // start() catches its own errors and shows its own toast rather
          // than throwing — check the returned success flag so a failed
          // session doesn't still flip this card to "Done". Pass through
          // the time budget the chat gathered, if any, so the plan is
          // sized to right-now instead of a generic default.
          const started = await start({ durationMinutes: action.minutesAvailable })
          if (!started) return
          break
        }
        case 'set_priority':
          // setPriority is a toggle — only call it if this isn't already
          // the priority, otherwise it would unstar it instead.
          if (!isSetPriorityNoOp(!!targetProject?.is_priority, action.type)) await setPriority(action.projectId)
          break
        case 'remove_up_next':
          // Toggle, keyed off actual pin state — only call it if the
          // project is genuinely pinned, otherwise it would pin it instead.
          if (!isUpNextActionNoOp(currentUpNextPosition, action.type)) await setUpNext(action.projectId)
          break
        case 'add_up_next':
          if (isUpNextActionNoOp(currentUpNextPosition, action.type)) break
          try {
            await setUpNext(action.projectId)
          } catch (err: any) {
            const details = err?.details || {}
            if (details?.error === 'up_next_cap_reached') {
              const current: Array<{ id: string; title: string }> = details?.current || []
              const replaceTarget = current.find(p => p.id === details?.suggested_replace_id) || current[0]
              if (replaceTarget) {
                addToast({
                  title: 'Up Next is full',
                  description: `Replace "${replaceTarget.title}" with "${action.projectTitle}"?`,
                  action: {
                    label: 'Replace',
                    onClick: async () => {
                      try {
                        await replaceUpNext(action.projectId, replaceTarget.id)
                        onResolve()
                      } catch {
                        addToast({ title: "Couldn't replace", variant: 'destructive' })
                      }
                    },
                  },
                })
                return
              }
            }
            throw err
          }
          break
        case 'bury':
          await api.post(`projects?resource=reaper&action=bury&id=${action.projectId}`, {})
          await fetchProjects()
          break
      }
      onResolve()
    } catch (err) {
      console.error('[FocusChat] apply action failed:', err)
      addToast({ title: "Couldn't do that", description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' })
    } finally {
      setApplying(false)
    }
  }

  if (dismissed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', opacity: 0.4 }}>
        <X className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand-text-muted)' }} />
        <p className="text-[12px] leading-snug line-through" style={{ color: 'var(--brand-text-muted)' }}>{action.projectTitle}</p>
      </div>
    )
  }

  return (
    <div
      className="flex items-start gap-3 px-3 py-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)' }}>
          {label}{action.minutesAvailable ? ` · ${action.minutesAvailable} min` : ''}
        </p>
        <p className="text-[13px] leading-snug text-[var(--brand-text-primary)]">{action.projectTitle}</p>
        {action.reasoning && (
          <p className="text-[11px] leading-snug italic pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.75 }}>{action.reasoning}</p>
        )}
        {isBlocked && (
          <p className="text-[11px] leading-snug pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.6 }}>Fix the next step above first</p>
        )}
      </div>
      {resolved ? (
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-text-muted)' }}>
          <Check className="h-3 w-3" /> Done
        </span>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onDismiss} className="h-9 w-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.08] text-[var(--brand-text-muted)]" aria-label="Skip">
            <X className="h-4 w-4" />
          </button>
          <button
            onClick={apply}
            disabled={applying || starting || isBlocked}
            className="flex items-center gap-1 min-h-[36px] px-3 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.18)', color: 'rgb(var(--brand-primary-rgb))', border: '1px solid rgba(var(--brand-primary-rgb),0.4)' }}
          >
            <Check className="h-3.5 w-3.5" /> {verb}
          </button>
        </div>
      )}
    </div>
  )
}
