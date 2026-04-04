/**
 * CatalystsPanel — shows the conditions that would unlock this project.
 *
 * Each catalyst is a specific external condition (a skill, a collaborator, a
 * tool, a life event, a window of time) that would accelerate the project.
 * When one matches against the user's recent material, it glows green. The
 * panel is collapsed by default and invisible when the project has no
 * catalysts — silence over slop.
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight, Sparkles, Loader2 } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project, Catalyst } from '../../types'

interface CatalystsPanelProps {
  project: Project
}

const KIND_LABEL: Record<string, string> = {
  skill: 'Skill',
  collaborator: 'Collaborator',
  tool: 'Tool',
  time: 'Time',
  life_event: 'Life event',
  other: 'Other',
}

export function CatalystsPanel({ project }: CatalystsPanelProps) {
  const { fetchProjects } = useProjectStore()
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const catalysts: Catalyst[] = Array.isArray(project.catalysts) ? project.catalysts : []

  const handleInfer = async () => {
    setRefreshing(true)
    try {
      await api.post('brainstorm', {
        step: 'infer-catalysts',
        project_id: project.id,
        title: project.title,
        description: project.description || '',
      })
      await fetchProjects()
    } catch {
      // Silent failure — catalysts are a nice-to-have, never blocking.
    } finally {
      setRefreshing(false)
    }
  }

  // Invisible when there are no catalysts AND nothing is being refreshed.
  // Give the user an opt-in "infer" button instead of an empty-state card.
  if (catalysts.length === 0) {
    return (
      <div className="p-3 rounded-xl border text-xs"
        style={{ borderColor: 'var(--glass-surface-hover)', background: 'rgba(255,255,255,0.02)' }}
      >
        <button
          onClick={handleInfer}
          disabled={refreshing}
          className="flex items-center gap-2 text-[var(--brand-text-muted)] hover:text-[var(--brand-primary)] transition-colors"
        >
          {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          <span className="font-bold uppercase tracking-widest text-[10px]">
            {refreshing ? 'Inferring catalysts…' : 'Infer catalysts'}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--glass-surface-hover)', background: 'rgba(255,255,255,0.02)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          <Sparkles className="h-3 w-3" style={{ color: 'var(--brand-primary)' }} />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--brand-text-muted)]">
            Catalysts · {catalysts.length}
          </span>
        </div>
        <span className="text-[9px] uppercase tracking-widest text-[var(--brand-text-muted)] opacity-60">
          {catalysts.filter(c => c.matched).length} matched
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2">
          {catalysts.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span
                className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{
                  background: c.matched ? '#34d399' : 'rgba(255,255,255,0.2)',
                  boxShadow: c.matched ? '0 0 8px rgba(52,211,153,0.6)' : undefined,
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[var(--brand-text-primary)] leading-snug">{c.text}</p>
                <p className="text-[9px] uppercase tracking-widest text-[var(--brand-text-muted)] opacity-60 mt-0.5">
                  {KIND_LABEL[c.kind || 'other']}
                  {c.matched && c.matched_evidence ? ` · ${c.matched_evidence}` : ''}
                </p>
              </div>
            </div>
          ))}

          <button
            onClick={handleInfer}
            disabled={refreshing}
            className="mt-2 text-[9px] uppercase tracking-widest font-bold text-[var(--brand-text-muted)] hover:text-[var(--brand-primary)] transition-colors flex items-center gap-1"
          >
            {refreshing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Sparkles className="h-2.5 w-2.5" />}
            {refreshing ? 'Re-inferring…' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  )
}
