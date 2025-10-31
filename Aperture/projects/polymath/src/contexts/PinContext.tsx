/**
 * Pin Context
 * Allows pinning any page to the bottom half of the screen
 * while navigating other pages in the top half
 */

import React, { createContext, useContext, useState, ReactNode } from 'react'

interface PinnedItem {
  type: 'project' | 'thought' | 'article' | 'page'
  id?: string
  title: string
  content: ReactNode
}

interface PinContextType {
  pinnedItem: PinnedItem | null
  isPinned: boolean
  pinItem: (item: PinnedItem) => void
  unpinItem: () => void
}

const PinContext = createContext<PinContextType | undefined>(undefined)

export function PinProvider({ children }: { children: ReactNode }) {
  const [pinnedItem, setPinnedItem] = useState<PinnedItem | null>(null)

  const pinItem = (item: PinnedItem) => {
    setPinnedItem(item)
  }

  const unpinItem = () => {
    setPinnedItem(null)
  }

  return (
    <PinContext.Provider
      value={{
        pinnedItem,
        isPinned: !!pinnedItem,
        pinItem,
        unpinItem,
      }}
    >
      {children}
    </PinContext.Provider>
  )
}

export function usePin() {
  const context = useContext(PinContext)
  if (!context) {
    throw new Error('usePin must be used within PinProvider')
  }
  return context
}
