/**
 * FocusableList - Wrapper that provides focus detection and swipe-to-context
 *
 * Usage:
 * <FocusableList>
 *   {items.map(item => (
 *     <FocusableItem key={item.id} id={item.id} type="project">
 *       <ProjectCard project={item} />
 *     </FocusableItem>
 *   ))}
 * </FocusableList>
 */

import React, { createContext, useContext, useEffect, useRef } from 'react'
import { useFocusedItem } from '../hooks/useFocusedItem'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { useContextEngineStore } from '../stores/useContextEngineStore'

interface FocusableListContextValue {
  focusedId: string | null
  registerItem: (element: HTMLElement | null) => (() => void) | undefined
}

const FocusableListContext = createContext<FocusableListContextValue>({
  focusedId: null,
  registerItem: () => undefined
})

interface FocusableListProps {
  children: React.ReactNode
  /** Whether to enable swipe gesture */
  swipeEnabled?: boolean
}

export function FocusableList({ children, swipeEnabled = true }: FocusableListProps) {
  const { focusedItem, registerItem } = useFocusedItem()
  const { setContext, toggleSidebar, sidebarOpen } = useContextEngineStore()

  // Update context when focused item changes
  useEffect(() => {
    if (focusedItem) {
      // Map 'thought' to the context type expected
      const contextType = focusedItem.type === 'thought' ? 'memory' : focusedItem.type
      setContext(contextType as any, focusedItem.id)
    }
  }, [focusedItem, setContext])

  // Handle swipe to open sidebar
  useSwipeGesture({
    onSwipeLeft: () => {
      if (focusedItem && !sidebarOpen) {
        toggleSidebar(true)
      }
    },
    onSwipeRight: () => {
      if (sidebarOpen) {
        toggleSidebar(false)
      }
    },
    enabled: swipeEnabled
  })

  return (
    <FocusableListContext.Provider value={{ focusedId: focusedItem?.id || null, registerItem }}>
      {children}
    </FocusableListContext.Provider>
  )
}

interface FocusableItemProps {
  children: React.ReactNode
  id: string
  type: 'project' | 'article' | 'thought'
  className?: string
}

export function FocusableItem({ children, id, type, className = '' }: FocusableItemProps) {
  const { focusedId, registerItem } = useContext(FocusableListContext)
  const { setContext, toggleSidebar } = useContextEngineStore()
  const ref = useRef<HTMLDivElement>(null)
  const lastTapRef = useRef<number>(0)
  const isFocused = focusedId === id

  useEffect(() => {
    if (ref.current) {
      const cleanup = registerItem(ref.current)
      return cleanup
    }
  }, [registerItem])

  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected - open context sidebar
      e.preventDefault()
      e.stopPropagation()
      const contextType = type === 'thought' ? 'memory' : type
      setContext(contextType as any, id)
      toggleSidebar(true)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  return (
    <div
      ref={ref}
      data-focus-id={id}
      data-focus-type={type}
      className={`transition-all duration-200 ${className}`}
      style={{
        transform: isFocused ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isFocused ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
        borderRadius: '0.75rem'
      }}
      onClick={handleTap}
      onTouchEnd={handleTap}
    >
      {children}
    </div>
  )
}

export function useFocusableList() {
  return useContext(FocusableListContext)
}
