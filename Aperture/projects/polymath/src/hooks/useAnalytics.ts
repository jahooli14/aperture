/**
 * Usage Analytics Hook
 * Tracks user interactions with homepage sections to enable adaptive layout
 */

import { useEffect } from 'react'

export type SectionId =
  | 'smart-suggestion'
  | 'priority-projects'
  | 'daily-queue'
  | 'quick-stats'
  | 'connection-hint'

interface SectionAnalytics {
  id: SectionId
  views: number
  clicks: number
  timeSpent: number // in seconds
  lastViewed: number // timestamp
  score: number // calculated engagement score
}

interface AnalyticsStore {
  [key: string]: SectionAnalytics
}

const STORAGE_KEY = 'polymath_section_analytics'
const VIEW_DURATION_THRESHOLD = 2000 // 2 seconds to count as a "view"

/**
 * Get all section analytics from storage
 */
export function getAnalytics(): AnalyticsStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to load analytics:', error)
    return {}
  }
}

/**
 * Save analytics to storage
 */
function saveAnalytics(analytics: AnalyticsStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(analytics))
  } catch (error) {
    console.error('Failed to save analytics:', error)
  }
}

/**
 * Calculate engagement score for a section
 * Formula: (views * 1) + (clicks * 5) + (timeSpent/60 * 2) + (recency bonus)
 */
function calculateScore(section: SectionAnalytics): number {
  const viewScore = section.views * 1
  const clickScore = section.clicks * 5
  const timeScore = (section.timeSpent / 60) * 2

  // Recency bonus: sections viewed in last 7 days get bonus points
  const daysSinceView = (Date.now() - section.lastViewed) / (1000 * 60 * 60 * 24)
  const recencyBonus = daysSinceView < 7 ? 10 : 0

  return viewScore + clickScore + timeScore + recencyBonus
}

/**
 * Track a section view
 */
export function trackSectionView(sectionId: SectionId) {
  const analytics = getAnalytics()

  if (!analytics[sectionId]) {
    analytics[sectionId] = {
      id: sectionId,
      views: 0,
      clicks: 0,
      timeSpent: 0,
      lastViewed: Date.now(),
      score: 0
    }
  }

  analytics[sectionId].views += 1
  analytics[sectionId].lastViewed = Date.now()
  analytics[sectionId].score = calculateScore(analytics[sectionId])

  saveAnalytics(analytics)
}

/**
 * Track a click within a section
 */
export function trackSectionClick(sectionId: SectionId) {
  const analytics = getAnalytics()

  if (!analytics[sectionId]) {
    analytics[sectionId] = {
      id: sectionId,
      views: 0,
      clicks: 0,
      timeSpent: 0,
      lastViewed: Date.now(),
      score: 0
    }
  }

  analytics[sectionId].clicks += 1
  analytics[sectionId].lastViewed = Date.now()
  analytics[sectionId].score = calculateScore(analytics[sectionId])

  saveAnalytics(analytics)
}

/**
 * Track time spent viewing a section
 */
export function trackSectionTimeSpent(sectionId: SectionId, seconds: number) {
  const analytics = getAnalytics()

  if (!analytics[sectionId]) {
    analytics[sectionId] = {
      id: sectionId,
      views: 0,
      clicks: 0,
      timeSpent: 0,
      lastViewed: Date.now(),
      score: 0
    }
  }

  analytics[sectionId].timeSpent += seconds
  analytics[sectionId].score = calculateScore(analytics[sectionId])

  saveAnalytics(analytics)
}

/**
 * Get sorted sections by engagement score
 */
export function getSortedSections(): SectionId[] {
  const analytics = getAnalytics()

  // Convert to array and sort by score
  const sections = Object.values(analytics)
    .sort((a, b) => b.score - a.score)
    .map(s => s.id)

  return sections
}

/**
 * Reset all analytics (for testing)
 */
export function resetAnalytics() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Hook to track section visibility and interactions
 */
export function useAnalytics(sectionId: SectionId) {
  useEffect(() => {
    // Track view when section mounts
    trackSectionView(sectionId)

    // Track time spent
    const startTime = Date.now()

    return () => {
      const timeSpent = (Date.now() - startTime) / 1000
      if (timeSpent >= VIEW_DURATION_THRESHOLD / 1000) {
        trackSectionTimeSpent(sectionId, timeSpent)
      }
    }
  }, [sectionId])

  // Return click tracker
  return {
    trackClick: () => trackSectionClick(sectionId)
  }
}
