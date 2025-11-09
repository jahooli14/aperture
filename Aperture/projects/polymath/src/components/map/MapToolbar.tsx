/**
 * MapToolbar Component
 * Toolbar with map controls and actions
 */

import { RefreshCw, Sparkles } from 'lucide-react'
import { useMapStore } from '../../stores/useMapStore'

export function MapToolbar() {
  const { fetchDoorSuggestions } = useMapStore()

  const handleRefreshDoors = () => {
    fetchDoorSuggestions()
  }

  return (
    <div
      className="absolute top-20 left-4 flex flex-col gap-2 z-10"
    >
      <button
        onClick={handleRefreshDoors}
        className="premium-bg-3 text-premium-text-primary p-3 rounded-lg shadow-lg hover:bg-opacity-90 transition-all flex items-center gap-2"
        title="Refresh door suggestions"
      >
        <Sparkles className="h-4 w-4" style={{ color: 'var(--premium-gold)' }} />
        <span className="text-sm font-medium">Refresh doors</span>
      </button>
    </div>
  )
}
