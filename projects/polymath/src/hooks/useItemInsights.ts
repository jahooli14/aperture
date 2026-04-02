/**
 * useItemInsights
 * Reads cached synthesis insights and returns the ones relevant to a specific item.
 * Relevance: insight evidence mentions this item's title, OR insight description
 * references any of the item's themes.
 * No network call — reads from IndexedDB cache populated by the insights engine.
 */

import { useState, useEffect } from 'react'
import { readingDb } from '../lib/db'

export interface CachedInsight {
  type: 'collision' | 'pattern' | 'evolution' | 'opportunity'
  title: string
  description: string
  data?: {
    evidence?: string[]
    recommendation?: string
    timeline?: Array<{ date: string; stance: string; quote?: string }>
  }
  actionable?: boolean
  action?: string
}

function isRelevant(insight: CachedInsight, title: string, themes?: string[]): boolean {
  const titleLower = title.toLowerCase()
  const evidence: string[] = insight.data?.evidence || []

  // Match if any evidence item overlaps with this item's title (either direction)
  if (evidence.some(e => {
    const eLower = e.toLowerCase()
    return eLower.includes(titleLower) || titleLower.includes(eLower)
  })) return true

  // Match if insight description mentions any of this item's themes
  if (themes?.length) {
    const desc = (insight.title + ' ' + insight.description).toLowerCase()
    if (themes.some(t => t && desc.includes(t.toLowerCase()))) return true
  }

  return false
}

export function useItemInsights(title: string, themes?: string[]) {
  const [insights, setInsights] = useState<CachedInsight[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!title) return
    readingDb.getDashboard('evolution').then(cached => {
      const all: CachedInsight[] = cached?.insights || []
      setInsights(all.filter(i => isRelevant(i, title, themes)).slice(0, 3))
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [title])

  return { insights, loaded }
}
