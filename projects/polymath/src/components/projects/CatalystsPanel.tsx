import { useState } from 'react'
import { Radar, Loader2, RefreshCw, Zap, Clock } from 'lucide-react'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project, Catalyst } from '../../types'

interface CatalystsPanelProps {
  project: Project
}

const KIND_ICONS: Record<string, string> = {
  skill: '🧠',
  collaborator: '🤝',
  tool: '🔧',
  time: '⏰',
  life_event: '🌱',
  other: '✦',
}

function formatMatchDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = Date.now()
  const days = Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CatalystsPanel({ project }: CatalystsPanelProps) {
  const { fetchProjects } = useProjectStore()
  const [refreshing, setRefreshing] = useState(false)

  const catalysts: Catalyst[] = Array.isArray(project.catalysts) ? project.catalysts : []

  const handleRefresh = async () => {
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
      // Silent failure — catalysts are a nice-to-have
    } finally {
      setRefreshing(false)
    }
  }

  // Hide entirely when empty — catalysts are auto-inferred on project creation
  if (catalysts.length === 0) return null

  const matched = catalysts.filter(c => c.matched)
  const waiting = catalysts.filter(c => !c.matched)

  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: matched.length > 0
        ? 'linear-gradient(135deg, rgba(52,211,153,0.06) 0%, rgba(15,24,41,0.4) 100%)'
        : 'rgba(255,255,255,0.02)',
      border: matched.length > 0
        ? '1px solid rgba(52,211,153,0.15)'
        : '1px solid var(--glass-surface-hover)',
    }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-3.5 w-3.5" style={{ color: matched.length > 0 ? 'rgb(52,211,153)' : 'var(--brand-text-muted)' }} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{
            color: matched.length > 0 ? 'rgb(52,211,153)' : 'var(--brand-text-muted)'
          }}>
            Waiting for…
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="h-6 w-6 rounded-md flex items-center justify-center transition-colors hover:bg-white/5"
          title="Re-analyse conditions"
        >
          {refreshing
            ? <Loader2 className="h-3 w-3 animate-spin text-[var(--brand-text-muted)]" />
            : <RefreshCw className="h-3 w-3 text-[var(--brand-text-muted)] opacity-40 hover:opacity-80" />
          }
        </button>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {/* Matched catalysts — these conditions appeared! */}
        {matched.map((c, i) => (
          <div
            key={`m-${i}`}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.15)',
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              <Zap className="h-3.5 w-3.5" style={{ color: 'rgb(52,211,153)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--brand-text-primary)] leading-snug">{c.text}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: 'rgba(52,211,153,0.7)' }}>
                Spotted {formatMatchDate(c.matched_at)}
              </p>
            </div>
          </div>
        ))}

        {/* Unmatched — still waiting */}
        {waiting.map((c, i) => (
          <div
            key={`w-${i}`}
            className="flex items-start gap-3 px-3 py-2"
          >
            <div className="flex-shrink-0 mt-0.5 text-sm opacity-50">
              {KIND_ICONS[c.kind || 'other']}
            </div>
            <div className="flex-1 min-w-0 flex items-start gap-2">
              <p className="text-sm text-[var(--brand-text-secondary)] leading-snug opacity-70">{c.text}</p>
              <Clock className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-text-muted)', opacity: 0.3 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
