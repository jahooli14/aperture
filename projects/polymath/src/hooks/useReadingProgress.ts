/**
 * Hook for tracking reading progress
 * Saves scroll position and percentage to IndexedDB
 * Provides robust restoration with retry logic
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { readingDb } from '../lib/db'

interface UseReadingProgressResult {
  progress: number // Percentage 0-100
  saveProgress: () => void
  restoreProgress: () => Promise<void>
}

export function useReadingProgress(articleId: string): UseReadingProgressResult {
  const [progress, setProgress] = useState(0)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const hasRestoredRef = useRef(false)
  const isRestoringRef = useRef(false)

  /**
   * Calculate and save current reading progress immediately
   */
  const saveProgressImmediate = useCallback(async () => {
    const scrollPosition = window.scrollY
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
    const percentage = scrollHeight > 0 ? (scrollPosition / scrollHeight) * 100 : 0

    await readingDb.saveProgress(
      articleId,
      scrollPosition,
      Math.min(100, Math.round(percentage))
    )

    setProgress(Math.min(100, Math.round(percentage)))
  }, [articleId])

  /**
   * Debounced save progress
   */
  const saveProgress = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(saveProgressImmediate, 1000)
  }, [saveProgressImmediate])

  /**
   * Restore saved reading progress with retry logic
   */
  const restoreProgress = useCallback(async () => {
    // Prevent multiple restoration attempts using refs (avoids hook dep issues)
    if (hasRestoredRef.current || isRestoringRef.current) return

    const savedProgress = await readingDb.getProgress(articleId)
    if (!savedProgress || savedProgress.scroll_percentage < 3) {
      return
    }

    isRestoringRef.current = true
    hasRestoredRef.current = true

    // Retry restoration with increasing delays to handle dynamic content
    const attemptRestore = async (attempt: number = 0): Promise<boolean> => {
      const maxScrollHeight = document.documentElement.scrollHeight - window.innerHeight

      if (savedProgress.scroll_position <= maxScrollHeight) {
        window.scrollTo({
          top: savedProgress.scroll_position,
          behavior: attempt === 0 ? 'instant' : 'smooth'
        })

        await new Promise(r => setTimeout(r, 50))
        const actualPosition = window.scrollY
        const tolerance = 50

        if (Math.abs(actualPosition - savedProgress.scroll_position) <= tolerance) {
          setProgress(savedProgress.scroll_percentage)
          console.log('[Progress] Restored to', savedProgress.scroll_percentage + '%')
          return true
        }
      }

      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
        return attemptRestore(attempt + 1)
      }

      return false
    }

    try {
      await attemptRestore()
    } finally {
      isRestoringRef.current = false
    }
  }, [articleId])

  /**
   * Auto-save progress on scroll
   */
  useEffect(() => {
    const handleScroll = () => {
      // Don't update progress while restoring
      if (isRestoringRef.current) return

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
   * Save progress on visibility change (switching tabs)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveProgressImmediate()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [saveProgressImmediate])

  /**
   * Save progress when leaving the page
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
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

  /**
   * Reset restoration flag when article changes
   */
  useEffect(() => {
    hasRestoredRef.current = false
    isRestoringRef.current = false
    setProgress(0)
  }, [articleId])

  return {
    progress,
    saveProgress,
    restoreProgress
  }
}
