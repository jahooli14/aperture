/**
 * Confirm/dismiss card for a brand-new project the chat has proposed.
 *
 * Separate from FocusChatActionCard because every action there operates on
 * a project that already exists (it's validated against the portfolio's
 * own ids). This is the move that didn't exist before: when the user asks
 * for something new, the chat can now actually give them one instead of
 * reaching for the nearest existing project and calling it close enough.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProjectIdeasStore } from '../../stores/useProjectIdeasStore'
import { useToast } from '../ui/toast'
import { ConfirmButton, DismissButton, ResolvedBadge, DismissedRow, ProposalCard } from '../chat/ChatPrimitives'
import { type PortfolioNewProject } from './focusChatOps'

export function FocusChatNewProjectCard({ proposal, resolved, dismissed, onResolve, onDismiss }: {
  proposal: PortfolioNewProject
  resolved?: boolean
  dismissed?: boolean
  onResolve: () => void
  onDismiss: () => void
}) {
  const navigate = useNavigate()
  const createProject = useProjectStore(s => s.createProject)
  const { addToast } = useToast()
  const [applying, setApplying] = useState(false)

  const apply = async () => {
    setApplying(true)
    try {
      const description = [proposal.pitch, proposal.firstStep ? `First move: ${proposal.firstStep}` : null]
        .filter(Boolean)
        .join('\n\n')

      // No `type` — same reasoning as createProjectFromIdea: guessing a
      // domain wrong gives the project a confidently wrong identity colour
      // everywhere it appears afterwards. Left unset, it falls through to
      // the theme system's title-hash colour until the user shapes it.
      const created = await createProject({
        title: proposal.title,
        description,
        status: 'active',
        metadata: {
          tasks: [],
          progress: 0,
          is_shaped: false,
          end_goal: proposal.pitch,
          project_mode: 'completion',
          ...(proposal.ideaId ? { from_idea: proposal.ideaId } : {}),
        },
      })

      // Came out of the pending ideas queue — clear it there too, so the
      // same idea can't also be offered by the deck a moment later.
      if (proposal.ideaId) {
        try {
          await api.post('utilities?resource=project-ideas-feedback', { id: proposal.ideaId, status: 'built' })
        } catch {
          // Non-fatal: the project exists; the queue reconciles on next load.
        }
        useProjectIdeasStore.getState().removeIdea(proposal.ideaId)
      }

      addToast({
        title: 'Project created',
        description: `"${proposal.title}" is at the top of your projects.`,
        variant: 'success',
        action: { label: 'Open it', onClick: () => navigate(`/projects/${created.id}`) },
      })
      onResolve()
    } catch (err) {
      console.error('[FocusChat] create new project failed:', err)
      addToast({
        title: "Couldn't create that",
        description: err instanceof Error ? err.message : 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setApplying(false)
    }
  }

  if (dismissed) {
    return <DismissedRow label={proposal.title} />
  }

  return (
    <ProposalCard>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)' }}>
          Start something new
        </p>
        <p className="text-[13px] leading-snug text-[var(--brand-text-primary)]">{proposal.title}</p>
        <p className="text-[11px] leading-snug italic pt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.75 }}>
          {proposal.reasoning || proposal.pitch}
        </p>
      </div>
      {resolved ? (
        <ResolvedBadge />
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <DismissButton onClick={onDismiss} />
          <ConfirmButton onClick={apply} disabled={applying} busy={applying} busyLabel="Creating…">
            <Check className="h-3.5 w-3.5" /> Create
          </ConfirmButton>
        </div>
      )}
    </ProposalCard>
  )
}
