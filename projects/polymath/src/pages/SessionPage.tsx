/**
 * SessionPage — entry point for the execution session contract (SPEC.md).
 *
 * New, additive route. The old home surface (TodaysAnswerCard, Power Hour,
 * etc.) is untouched for now — replacing it is a separate, later step once
 * this mechanic is validated for real. This page is reachable on its own
 * so the session contract can be used and tested in isolation first.
 *
 * Two states:
 *   - No live project declared: pick one (first-run declaration).
 *   - Live project declared: the session contract for it.
 *
 * Also checks for a deferred close-out on mount — a session that ended
 * without a close-out gets asked about here, on next open, per SPEC.md.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectStore } from '../stores/useProjectStore'
import { useSessionStore } from '../stores/useSessionStore'
import { SessionContract } from '../components/session/SessionContract'
import { VoiceInput } from '../components/VoiceInput'
import type { Project } from '../types'

function DeferredCloseoutPrompt() {
  const { pendingCloseout, closeoutForPending, dismissPendingCloseout, closing } = useSessionStore()
  const [text, setText] = useState('')

  if (!pendingCloseout) return null

  return (
    <div className="glass-card p-6 space-y-3 mb-4">
      <p className="text-base">
        You did some time on {pendingCloseout.projects?.title ?? 'a project'} — where'd you get to?
      </p>
      <VoiceInput onTranscript={setText} maxDuration={30} />
      {text && <p className="text-sm text-[var(--text-secondary,#9a9a9a)] italic">"{text}"</p>}
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-lg bg-[var(--accent,#c9a876)] text-black text-sm font-medium disabled:opacity-50"
          disabled={closing || !text}
          onClick={() => closeoutForPending(text)}
        >
          Save
        </button>
        <button
          className="px-4 py-2 rounded-lg border border-[var(--border,#333)] text-sm"
          onClick={dismissPendingCloseout}
        >
          Skip
        </button>
      </div>
    </div>
  )
}

function DeclareLive({ projects, onDeclared }: { projects: Project[]; onDeclared: () => void }) {
  const { declareLive } = useSessionStore()
  const [busy, setBusy] = useState<string | null>(null)

  const pick = async (id: string) => {
    setBusy(id)
    await declareLive(id)
    setBusy(null)
    onDeclared()
  }

  if (projects.length === 0) {
    return (
      <div className="glass-card p-6 text-sm text-[var(--text-secondary,#9a9a9a)]">
        No projects yet. Capture one first.
      </div>
    )
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <p className="text-base">What do you want to be working on?</p>
      <div className="space-y-2">
        {projects.map(p => (
          <button
            key={p.id}
            disabled={busy !== null}
            onClick={() => pick(p.id)}
            className="w-full text-left px-4 py-3 rounded-lg border border-[var(--border,#333)] hover:border-[var(--accent,#c9a876)] disabled:opacity-50"
          >
            {p.title}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SessionPage() {
  const navigate = useNavigate()
  const { projects, fetchProjects } = useProjectStore()
  const { pendingCloseout, checkPendingCloseout } = useSessionStore()
  const [liveProject, setLiveProject] = useState<Project | null | undefined>(undefined)

  useEffect(() => {
    fetchProjects()
    checkPendingCloseout()
  }, [])

  useEffect(() => {
    if (projects.length === 0 && liveProject === undefined) return
    const live = projects.find(p => p.state === 'live') ?? null
    setLiveProject(live)
  }, [projects])

  const handleDeclared = () => fetchProjects()

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <button className="text-sm text-[var(--text-secondary,#9a9a9a)] mb-4" onClick={() => navigate('/')}>
        ← Home
      </button>

      {pendingCloseout && <DeferredCloseoutPrompt />}

      {liveProject === undefined ? null : liveProject === null ? (
        <DeclareLive projects={projects.filter(p => p.state !== 'harvested')} onDeclared={handleDeclared} />
      ) : (
        <SessionContract project={liveProject} onDone={() => navigate('/')} />
      )}
    </div>
  )
}
