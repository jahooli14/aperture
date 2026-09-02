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
import { useFocusChatStore } from '../../stores/useFocusChatStore'
import { useProjectIdeasStore } from '../../stores/useProjectIdeasStore'
import { useHomeAnswerStore } from '../../stores/useHomeAnswerStore'
import { useToast } from '../ui/toast'
import { ConfirmButton, DismissButton, ResolvedBadge, DismissedRow, ProposalCard } from '../chat/ChatPrimitives'
import { type PortfolioNewProject } from './focusChatOps'
import type { ChatTurn } from '../../types'

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
      // Everything the user said in the thread, not just the model's
      // one-line pitch. This conversation IS the project brief — throwing
      // it away at the moment of creation is why the app kept asking the
      // same questions afterwards, and why a project arrived with nothing
      // in it. It becomes the evidence the spine is planned from and the
      // sessions later cite.
      const turns = useFocusChatStore.getState().messages
      const saidByUser = turns
        .filter(m => m.kind === 'you' && typeof m.content === 'string')
        .map(m => m.content.trim())
        .filter(Boolean)

      const dump = [proposal.title, proposal.pitch, ...saidByUser, proposal.firstStep]
        .filter(Boolean)
        .join('\n')

      // One call: the shape and the first steps, in order, out of what was
      // actually said in the thread. Falls back to the proposal's own
      // fields if it can't — a project the user asked for always gets
      // created, it just arrives thinner.
      let shaped: {
        title?: string; end_goal?: string | null; summary?: string
        tags?: string[]; tasks?: any[]; question?: string | null
      } = {}
      try {
        shaped = (await api.post('utilities?resource=shape-project', {
          dump,
          title: proposal.title,
        })) as typeof shaped
      } catch (err) {
        console.warn('[FocusChat] shaping failed, creating with what we have:', err)
      }

      const tasks = Array.isArray(shaped.tasks) ? shaped.tasks : []
      const description = [shaped.summary || proposal.pitch, proposal.firstStep ? `First move: ${proposal.firstStep}` : null]
        .filter(Boolean)
        .join('\n\n')

      // No `type` — same reasoning as createProjectFromIdea: guessing a
      // domain wrong gives the project a confidently wrong identity colour
      // everywhere it appears afterwards. Left unset, it falls through to
      // the theme system's title-hash colour until the user shapes it.
      const created = await createProject({
        title: shaped.title || proposal.title,
        description,
        status: 'active',
        metadata: {
          tasks,
          progress: 0,
          // A project born from a real conversation with a real task list
          // is shaped. Marking it unshaped filtered it out of the priority
          // selector, the warm row, the chat's own portfolio and the
          // answer card — which is exactly why it looked like it saved and
          // then vanished.
          is_shaped: tasks.length > 0,
          // Only when the conversation actually said what done looks
          // like. The pitch was being stored as a finish line, which is a
          // sales line, not a done-condition.
          ...(shaped.end_goal ? { end_goal: shaped.end_goal, end_goal_source: 'guide' as const } : {}),
          project_mode: shaped.end_goal ? 'completion' : 'recurring',
          ...(shaped.tags?.length ? { tags: shaped.tags } : {}),
          // Kept verbatim: the shaper reads the user's turns back as
          // evidence, so the project stays explainable months later.
          conversation: turns.map(m => ({
            role: (m.kind === 'you' ? 'user' : 'assistant') as ChatTurn['role'],
            content: m.content,
            at: new Date().toISOString(),
          })),
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

      // Same override the chip-tap path uses — without this the box above
      // the thread would keep showing whatever it was showing before this
      // conversation, with no visible link to the project just created.
      useHomeAnswerStore.getState().setOverride(created.id)

      addToast({
        title: tasks.length > 0 ? `Created with ${tasks.length} steps` : 'Project created',
        description: tasks.length > 0
          ? `"${created.title}" is today's answer. Tap to see the plan.`
          : `"${created.title}" is today's answer.`,
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
