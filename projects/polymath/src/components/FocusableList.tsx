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
  // The swipe-left gesture used to open the Context Engine sidebar, which
  // is gone. `swipeEnabled` is kept on the props so callers don't all need
  // editing, and does nothing.

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
  const ref = useRef<HTMLDivElement>(null)
  const isFocused = focusedId === id

  useEffect(() => {
    if (ref.current) {
      const cleanup = registerItem(ref.current)
      return cleanup
    }
  }, [registerItem])

  return (
    <div
      ref={ref}
      data-focus-id={id}
      data-focus-type={type}
      className={className}
    >
      {children}
    </div>
  )
}

export function useFocusableList() {
  return useContext(FocusableListContext)
}
