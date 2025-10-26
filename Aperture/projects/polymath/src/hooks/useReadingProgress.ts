/**
 * Hook for tracking reading progress
 * Saves scroll position and percentage to IndexedDB
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { readingDb } from '../lib/readingDb'

interface UseReadingProgressResult {
  progress: number // Percentage 0-100
  saveProgress: () => void
  restoreProgress: () => Promise<void>
}

export function useReadingProgress(articleId: string): UseReadingProgressResult {
  const [progress, setProgress] = useState(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  /**
   * Calculate and save current reading progress
   */
  const saveProgress = useCallback(() => {
    // Debounce saves to avoid too many IndexedDB writes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const scrollPosition = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const percentage = scrollHeight > 0 ? (scrollPosition / scrollHeight) * 100 : 0

      // Get text at current position for context
      const selection = window.getSelection()
      const currentText = selection?.toString().substring(0, 100) || undefined

      await readingDb.saveProgress(
        articleId,
        scrollPosition,
        Math.min(100, Math.round(percentage)),
        currentText
      )

      setProgress(Math.min(100, Math.round(percentage)))
    }, 1000) // Save after 1 second of no scrolling
  }, [articleId])

  /**
   * Restore saved reading progress
   */
  const restoreProgress = useCallback(async () => {
    const savedProgress = await readingDb.getProgress(articleId)

    if (savedProgress) {
      // Restore scroll position
      window.scrollTo({
        top: savedProgress.scroll_position,
        behavior: 'smooth'
      })

      setProgress(savedProgress.scroll_percentage)
      console.log('[Progress] Restored:', savedProgress.scroll_percentage + '%')
    }
  }, [articleId])

  /**
   * Auto-save progress on scroll
   */
  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPosition = window.scrollY
      const percentage = scrollHeight > 0 ? (scrollPosition / scrollHeight) * 100 : 0

      setProgress(Math.min(100, Math.round(percentage)))
      saveProgress()
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [saveProgress])

  /**
   * Save progress when leaving the page
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Save immediately without debounce
      const scrollPosition = window.scrollY
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const percentage = scrollHeight > 0 ? (scrollPosition / scrollHeight) * 100 : 0

      readingDb.saveProgress(
        articleId,
        scrollPosition,
        Math.min(100, Math.round(percentage))
      )
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [articleId])

  return {
    progress,
    saveProgress,
    restoreProgress
  }
}
