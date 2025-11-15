import { useState, useCallback } from 'react'

export function useBulkSelection<T extends { id: string }>() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      // Exit selection mode if no items selected
      if (next.size === 0) {
        setIsSelectionMode(false)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((items: T[]) => {
    const allIds = new Set(items.map((item) => item.id))
    setSelectedIds(allIds)
    setIsSelectionMode(true)
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  )

  const enterSelectionMode = useCallback((initialId?: string) => {
    setIsSelectionMode(true)
    if (initialId) {
      setSelectedIds(new Set([initialId]))
    }
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }, [])

  const getSelectedItems = useCallback(
    (items: T[]) => {
      return items.filter((item) => selectedIds.has(item.id))
    },
    [selectedIds]
  )

  return {
    selectedIds: Array.from(selectedIds),
    selectedCount: selectedIds.size,
    isSelectionMode,
    isSelected,
    toggleSelection,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    getSelectedItems,
  }
}
