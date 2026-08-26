/**
 * Confirm/dismiss card for a single Focus chat action proposal — split out
 * of FocusChat.tsx to keep that file under the repo's 300-line convention.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { useHomeAnswerStore } from '../../stores/useHomeAnswerStore'
import { useSessionStore } from '../../stores/useSessionStore'
import { useToast } from '../ui/toast'
import { setChatHandoff } from '../../lib/chatHandoff'
import { ConfirmButton, DismissButton, ResolvedBadge, DismissedRow, ProposalCard } from '../chat/ChatPrimitives'
import { type PortfolioAction, describeAction, isUpNextActionNoOp, isSetPriorityNoOp } from './focusChatOps'

export function FocusChatActionCard({ action, resolved, dismissed, blockedByPendingTaskOp, onResolve, onDismiss }: {
  action: PortfolioAction
  resolved?: boolean
  dismissed?: boolean
  /** True when ANY turn this session still has an unresolved taskOp
   *  correcting this same project's next step (not just this message —
   *  the correction and the "start it" request can land in separate
   *  turns). The session's re-entry line and preview are read from the
   *  project, so starting before that fix lands would open on the stale
   *  text the user just corrected. */
  blockedByPendingTaskOp?: boolean
  onResolve: () => void
  onDismiss: () => void
}) {
  const navigate = useNavigate()
  const { setPriority, setUpNext, replaceUpNext, fetchProjects } = useProjectStore()
  const targetProject = useProjectStore(s => s.allProjects.find(p => p.id === action.projectId))
  const currentUpNextPosition = targetProject?.up_next_position ?? null
  const requestStart = useHomeAnswerStore(s => s.requestStart)
  const setWindowMinutes = useSessionStore(s => s.setWindowMinutes)
  const { addToast } = useToast()
  const [applying, setApplying] = useState(false)
  const { label, verb } = describeAction(action.type)
  const isBlocked = action.type === 'start_session' && !!blockedByPendingTaskOp

  // Focus chat and the per-project Guide are separate conversations —
  // without this, landing on the project after Focus chat just talked
  // through why to pick it up meant the Guide re-greeted from scratch,
  // ignorant of what was just said. One line is enough for the Guide's
  // opening turn to acknowledge it instead.
  const handoffSummary = action.reasoning
    ? `Just talked through "${action.projectTitle}" in Focus — ${action.reasoning}`
    : `Just picked "${action.projectTitle}" to work on in Focus.`

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
          // Talking to it is the third way into a session, and it runs the
          // same engine as ▶ and the star: point the answer box at the
          // project and open the contract there. No plan generation, so
          // this is instant -- nothing to wait on.
          setChatHandoff(action.projectId, handoffSummary)
          // The chat already asked how long you've got; don't ask twice.
          if (action.minutesAvailable) setWindowMinutes(action.minutesAvailable)
          requestStart(action.projectId)
          break
        }
        case 'set_priority':
          // setPriority is a toggle — only call it if this isn't already
          // the priority, otherwise it would unstar it instead. The star
          // and `state: 'live'` are one concept now, so this is also what
          // declares the live project.
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
    return <DismissedRow label={action.projectTitle} />
  }

  return (
    <ProposalCard>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)' }}>
          {label}{action.minutesAvailable ? ` · ${action.minutesAvailable} min` : ''}
        </p>
        {/* The chat only ever proposes ONE action — if that's not what the
            user wants (e.g. they want to read the task list, not start a
            session right now), this is the only way out of the chat and
            onto the project itself without dismissing and re-typing. Carries
            a one-line handoff so the project's own Guide isn't cold on what
            was just discussed here. */}
        <button
          onClick={() => { setChatHandoff(action.projectId, handoffSummary); navigate(`/projects/${action.projectId}`) }}
          className="text-[13px] leading-snug text-[var(--brand-text-primary)] underline decoration-dotted underline-offset-2 text-left hover:opacity-80 transition-opacity"
        >
          {action.projectTitle}
        </button>
        {action.reasoning && (
          <p className="text-[11px] leading-snug italic pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.75 }}>{action.reasoning}</p>
        )}
        {isBlocked && (
          <p className="text-[11px] leading-snug pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.6 }}>Fix the next step above first</p>
        )}
      </div>
      {resolved ? (
        <ResolvedBadge />
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <DismissButton onClick={onDismiss} />
          <ConfirmButton onClick={apply} disabled={applying || isBlocked}>
            <Check className="h-3.5 w-3.5" /> {verb}
          </ConfirmButton>
        </div>
      )}
    </ProposalCard>
  )
}
