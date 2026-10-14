/**
 * "Finished it" — for a small thing from this season. One tap, no
 * ceremony: no confetti, no questions, no "what's next". It lands on the
 * completed shelf ("What you've built") and the page says so quietly.
 */

import { useState } from 'react'
import { Check } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { isSmallFinish } from '../../lib/season'
import type { Project } from '../../types'

export function FinishedItButton({ project }: { project: Project }) {
  const updateProject = useProjectStore(s => s.updateProject)
  const { addToast } = useToast()
  const [saving, setSaving] = useState(false)
  if (!isSmallFinish(project)) return null

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

  return (
    <button
      onClick={() => { void finish() }}
      disabled={saving}
      className="neon-button w-full py-3 rounded-xl text-[15px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
    >
      <Check className="h-4 w-4" />
      {saving ? 'Saving…' : 'Finished it'}
    </button>
  )
}
