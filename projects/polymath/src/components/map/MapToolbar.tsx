/**
 * MapToolbar Component
 * Toolbar with map controls and actions
 */

import { RefreshCw, Sparkles } from 'lucide-react'
import { useMapStore } from '../../stores/useMapStore'

export function MapToolbar() {
  const { fetchDoorSuggestions, recalculateLayout, loading } = useMapStore()

  const handleRefreshDoors = () => {
    fetchDoorSuggestions()
  }

  const handleRecalculate = () => {
    recalculateLayout()
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

      <button
        onClick={handleRecalculate}
        disabled={loading}
        className="premium-bg-3 text-premium-text-primary p-3 rounded-lg shadow-lg hover:bg-opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
        title="Recalculate layout"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--premium-blue)' }} />
        <span className="text-sm font-medium">Reset Layout</span>
      </button>

      <button
        onClick={() => useMapStore.getState().regenerateMap()}
        disabled={loading}
        className="premium-bg-3 text-premium-text-primary p-3 rounded-lg shadow-lg hover:bg-opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
        title="Regenerate map from data"
      >
        <Sparkles className={`h-4 w-4 ${loading ? 'animate-pulse' : ''}`} style={{ color: 'var(--premium-gold)' }} />
        <span className="text-sm font-medium">Regenerate</span>
      </button>
    </div>
  )
}
