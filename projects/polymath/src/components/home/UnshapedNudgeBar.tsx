/**
 * UnshapedNudgeBar — Persistent nudge showing projects that need shaping.
 * Tapping opens the shaping modal for the first unshaped project.
 */

import { AlertTriangle } from 'lucide-react'
import { useUnshapedProjects } from '../../stores/useProjectStore'
import { haptic } from '../../utils/haptics'

interface UnshapedNudgeBarProps {
  onShapeProject: (projectId: string) => void
}

export function UnshapedNudgeBar({ onShapeProject }: UnshapedNudgeBarProps) {
  const unshaped = useUnshapedProjects()

  if (unshaped.length === 0) return null

  return (
    <button
      onClick={() => {
        haptic.light()
        onShapeProject(unshaped[0].id)
      }}
      className="w-full p-3 rounded-xl flex items-center gap-3 transition-all hover:brightness-110"
      style={{
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.12)',
      }}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(245,158,11,0.7)' }} />
      <div className="flex-1 text-left">
        <p className="text-xs font-medium text-[var(--brand-text-primary)]">
          {unshaped.length} project{unshaped.length > 1 ? 's' : ''} need{unshaped.length === 1 ? 's' : ''} shaping
        </p>
        <p className="text-[10px] text-[var(--brand-text-secondary)] opacity-50 truncate">
          {unshaped.map(p => p.title).join(' \u00b7 ')}
        </p>
      </div>
    </button>
  )
}
