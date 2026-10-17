/**
 * The small-finish footer on a project page: one quiet "Finished it", and
 * when the thing can't be started yet, a plain line saying why with a
 * "Got it" for when it can. One tap each, no ceremony, nothing lit: the
 * big project owns the page's one bright button.
 */

import { useState } from 'react'
import { Check } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { blockedReason, isSmallFinish } from '../../lib/season'
import { readThemes } from '../../lib/projectThemes'
import type { Project } from '../../types'

function niceDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
}

export function FinishedItButton({ project }: { project: Project }) {
  const updateProject = useProjectStore(s => s.updateProject)
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  // Any one-off can be finished in a tap: a small finish, or any project that
  // isn't read off long-running "Keep in mind" lines (a coaster, not the book).
  const oneOff = readThemes(project.metadata).length === 0
  if (project.status === 'completed' || project.status === 'graveyard' || project.state === 'live') return null
  if (!isSmallFinish(project) && !oneOff) return null
  const blocked = blockedReason(project)

  const finish = async () => {
    setSaving(true)
    try {
      await updateProject(project.id, { status: 'completed' })
      addToast({ title: 'Done.', description: `${project.title} is on your shelf.`, variant: 'success' })
    } catch {
      addToast({ title: "Couldn't save that", description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const gotIt = async () => {
    setSaving(true)
    try {
      await api.post('utilities?resource=season', { action: 'unblock', project_id: project.id })
      await useProjectStore.getState().fetchProjects()
    } catch {
      addToast({ title: "Couldn't save that", description: 'Try again in a moment.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {blocked && (
        <div className="glass-card-subtle p-5 flex items-center justify-between gap-3">
          <p className="text-[15px] leading-snug" style={{ color: 'var(--brand-text-secondary)' }}>
            {blocked.waiting ? `Waiting for ${blocked.waiting}.` : `Can start from ${niceDay(blocked.from!)}.`}
          </p>
          <button
            onClick={() => { void gotIt() }}
            disabled={saving}
            className="text-[13px] font-semibold py-2 px-3 -mr-2 whitespace-nowrap flex-shrink-0 disabled:opacity-50"
            style={{ color: 'rgb(var(--brand-primary-rgb))' }}
          >
            Got it
          </button>
        </div>
      )}
      <button
        onClick={() => { void finish() }}
        disabled={saving}
        className="w-full py-3 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ color: 'rgb(var(--brand-primary-rgb))', border: '1px solid rgba(var(--brand-primary-rgb),0.3)' }}
      >
        <Check className="h-4 w-4" />
        {saving ? 'Saving…' : 'Finished it'}
      </button>
    </div>
  )
}
