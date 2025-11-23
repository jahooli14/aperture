/**
 * useFocusedItem - Detects which list item is currently "in focus"
 * Uses Intersection Observer to track which item is most visible
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface FocusedItem {
  id: string
  type: 'project' | 'article' | 'thought'
  element: HTMLElement
}

interface UseFocusedItemOptions {
  /** Threshold for considering an item "focused" (0-1) */
  threshold?: number
  /** Delay before updating focus (ms) to avoid flicker */
  debounceMs?: number
  /** Root margin for intersection observer */
  rootMargin?: string
}

export function useFocusedItem(options: UseFocusedItemOptions = {}) {
  const {
    threshold = 0.6,
    debounceMs = 150,
    rootMargin = '-20% 0px -20% 0px' // Focus on middle 60% of viewport
  } = options

  const [focusedItem, setFocusedItem] = useState<FocusedItem | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const itemsRef = useRef<Map<string, { type: string; ratio: number }>>(new Map())

  // Calculate which item should be focused based on visibility ratios
  const updateFocus = useCallback(() => {
    let maxRatio = 0
    let focusedId: string | null = null
    let focusedType: string | null = null

    itemsRef.current.forEach((data, id) => {
      if (data.ratio > maxRatio && data.ratio >= threshold) {
        maxRatio = data.ratio
        focusedId = id
        focusedType = data.type
      }
    })

    if (focusedId && focusedType) {
      const element = document.querySelector(`[data-focus-id="${focusedId}"]`) as HTMLElement
      if (element) {
        setFocusedItem({
          id: focusedId,
          type: focusedType as 'project' | 'article' | 'thought',
          element
        })
      }
    } else {
      setFocusedItem(null)
    }
  }, [threshold])

  // Debounced focus update
  const debouncedUpdateFocus = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(updateFocus, debounceMs)
  }, [updateFocus, debounceMs])

  // Initialize observer
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('data-focus-id')
          const type = entry.target.getAttribute('data-focus-type')

          if (id && type) {
            if (entry.isIntersecting) {
              itemsRef.current.set(id, { type, ratio: entry.intersectionRatio })
            } else {
              itemsRef.current.delete(id)
            }
          }
        })
        debouncedUpdateFocus()
      },
      {
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin
      }
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [debouncedUpdateFocus, rootMargin])

  // Function to register an item for focus tracking
  const registerItem = useCallback((element: HTMLElement | null) => {
    if (!element || !observerRef.current) return

    observerRef.current.observe(element)

    // Return cleanup function
    return () => {
      if (observerRef.current) {
        observerRef.current.unobserve(element)
      }
      const id = element.getAttribute('data-focus-id')
      if (id) {
        itemsRef.current.delete(id)
      }
    }
  }, [])

  return {
    focusedItem,
    registerItem
  }
}
