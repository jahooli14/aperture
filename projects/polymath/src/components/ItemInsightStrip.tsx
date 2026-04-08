/**
 * ItemInsightStrip
 * Shows Gemini's "so what" observations about this specific item,
 * drawn from the corpus-level insights already cached from the last run.
 * Replaces ConnectionsList everywhere — same slot, better signal.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, Zap, AlertCircle, Lightbulb, ArrowRight, Route } from 'lucide-react'
import { useItemInsights } from '../hooks/useItemInsights'
import { ConnectionPathPicker } from './connections/ConnectionPathPicker'
import { ConnectionRevealOverlay } from './connections/ConnectionRevealOverlay'
import type { ConnectionSourceType } from '../types'

interface ItemInsightStripProps {
  title: string
  themes?: string[]
  itemId?: string
  itemType?: ConnectionSourceType
}

const TYPE_ICON = {
  evolution: TrendingUp,
  pattern: Zap,
  collision: AlertCircle,
  opportunity: Lightbulb,
}

const TYPE_COLOR = {
  evolution: 'rgba(var(--brand-primary-rgb),0.15)',
  pattern: 'rgba(var(--brand-primary-rgb),0.15)',
  collision: 'rgba(245,158,11,0.15)',
  opportunity: 'rgba(16,185,129,0.15)',
}

export function ItemInsightStrip({ title, themes, itemId, itemType }: ItemInsightStripProps) {
  const navigate = useNavigate()
  const { insights, loaded } = useItemInsights(title, themes)
  const [showPathPicker, setShowPathPicker] = useState(false)
  const [pathTarget, setPathTarget] = useState<{ id: string; type: string; title: string } | null>(null)

  if (!loaded || insights.length === 0) return null

  return (
    <div className="mt-6 space-y-2">
      {insights.map((insight, i) => {
        const Icon = TYPE_ICON[insight.type] || Lightbulb
        const bg = TYPE_COLOR[insight.type] || 'rgba(255,255,255,0.05)'

        return (
          <button
            key={i}
            onClick={() => navigate('/insights')}
            className="w-full text-left p-3 rounded-xl transition-all hover:brightness-110 flex items-start gap-3"
            style={{ background: bg }}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 opacity-70" style={{ color: 'var(--brand-primary)' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-snug" style={{ color: 'var(--brand-text-primary)' }}>
                {insight.title}
              </p>
              <p className="text-xs mt-0.5 leading-relaxed opacity-70 line-clamp-2" style={{ color: 'var(--brand-primary)' }}>
                {insight.description}
              </p>
            </div>
            <ArrowRight className="h-3 w-3 flex-shrink-0 mt-1 opacity-30" style={{ color: 'var(--brand-primary)' }} />
          </button>
        )
      })}

      {/* Connection path trigger */}
      {itemId && itemType && (
        <>
          <button
            onClick={() => setShowPathPicker(true)}
            className="w-full p-3 rounded-xl transition-all hover:bg-brand-primary/5 flex items-center justify-center gap-2 border border-dashed border-brand-primary/15 group"
          >
            <Route className="h-3.5 w-3.5 text-brand-primary opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="text-xs font-medium text-brand-primary opacity-50 group-hover:opacity-100 transition-opacity">
              See how this connects to...
            </span>
          </button>

          <ConnectionPathPicker
            sourceId={itemId}
            sourceType={itemType}
            open={showPathPicker}
            onClose={() => setShowPathPicker(false)}
            onSelect={(item) => {
              setShowPathPicker(false)
              setPathTarget({ id: item.id, type: item.type, title: item.title })
            }}
          />

          {pathTarget && (
            <ConnectionRevealOverlay
              open={!!pathTarget}
              onClose={() => setPathTarget(null)}
              sourceId={itemId}
              sourceType={itemType}
              targetId={pathTarget.id}
              targetType={pathTarget.type}
              sourceTitle={title}
              targetTitle={pathTarget.title}
            />
          )}
        </>
      )}
    </div>
  )
}
