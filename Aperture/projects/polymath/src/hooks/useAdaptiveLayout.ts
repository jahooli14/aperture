/**
 * Adaptive Layout Hook
 * Determines optimal section order based on user behavior patterns
 */

import { useState, useEffect } from 'react'
import { getSortedSections, getAnalytics, type SectionId } from './useAnalytics'

export interface SectionConfig {
  id: SectionId
  order: number
  visible: boolean
}

// Default section order for new users (before we have analytics)
const DEFAULT_SECTION_ORDER: SectionId[] = [
  'smart-suggestion',
  'priority-projects',
  'daily-queue',
  'quick-stats',
  'connection-hint'
]

// Minimum interactions required before adaptive layout kicks in
const MIN_INTERACTIONS_THRESHOLD = 10

/**
 * Hook to get adaptive section order based on user behavior
 */
export function useAdaptiveLayout() {
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(DEFAULT_SECTION_ORDER)
  const [isAdaptive, setIsAdaptive] = useState(false)

  useEffect(() => {
    const analytics = getAnalytics()

    // Calculate total interactions
    const totalInteractions = Object.values(analytics).reduce(
      (sum, section) => sum + section.views + section.clicks,
      0
    )

    // Only use adaptive layout if we have enough data
    if (totalInteractions >= MIN_INTERACTIONS_THRESHOLD) {
      const sortedSections = getSortedSections()

      // Fill in any missing sections at the end (in default order)
      const allSections = new Set([...sortedSections, ...DEFAULT_SECTION_ORDER])
      const finalOrder = Array.from(allSections)

      setSectionOrder(finalOrder)
      setIsAdaptive(true)
    } else {
      // Not enough data yet, use default order
      setSectionOrder(DEFAULT_SECTION_ORDER)
      setIsAdaptive(false)
    }
  }, [])

  return {
    sectionOrder,
    isAdaptive,
    getSectionOrder: (sectionId: SectionId) => {
      return sectionOrder.indexOf(sectionId)
    }
  }
}

/**
 * Get analytics summary for debugging
 */
export function getAnalyticsSummary() {
  const analytics = getAnalytics()
  const sections = Object.values(analytics).sort((a, b) => b.score - a.score)

  return sections.map(section => ({
    id: section.id,
    score: Math.round(section.score),
    views: section.views,
    clicks: section.clicks,
    timeSpent: Math.round(section.timeSpent),
    lastViewed: new Date(section.lastViewed).toLocaleDateString()
  }))
}
