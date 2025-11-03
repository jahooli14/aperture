/**
 * Pin Button Component
 * Reusable button to pin content to split screen
 */

import { Pin, PinOff } from 'lucide-react'
import { usePin } from '../contexts/PinContext'
import { ReactNode, useEffect } from 'react'

interface PinButtonProps {
  type: 'project' | 'thought' | 'article' | 'page'
  id?: string
  title: string
  content: ReactNode
  currentId?: string
  contentVersion?: string | number  // Optional version to force updates
}

export function PinButton({ type, id, title, content, currentId, contentVersion }: PinButtonProps) {
  const { pinnedItem, pinItem, unpinItem } = usePin()

  // Only consider it pinned if there's actually a pinned item AND the IDs match
  const isThisPinned = pinnedItem !== null && (
    (id && pinnedItem.id === id) ||
    (currentId && pinnedItem.id === currentId)
  )

  // Update pinned content when it changes (if this item is currently pinned)
  useEffect(() => {
    if (isThisPinned) {
      console.log('[PinButton] Updating pinned content, version:', contentVersion)
      pinItem({ type, id, title, content })
    }
  }, [content, contentVersion, isThisPinned, type, id, title])

  const handlePin = () => {
    if (isThisPinned) {
      unpinItem()
    } else {
      pinItem({ type, id, title, content })
    }
  }

  return (
    <button
      onClick={handlePin}
      className="h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all border hover:bg-white/5"
      style={{
        borderColor: isThisPinned ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.2)',
        color: isThisPinned ? 'var(--premium-blue)' : 'var(--premium-text-secondary)'
      }}
      title={isThisPinned ? 'Unpin' : 'Pin to compare'}
    >
      {isThisPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      {isThisPinned ? 'Unpin' : 'Pin'}
    </button>
  )
}
