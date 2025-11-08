/**
 * Knowledge Map Page
 * Main page for the geographic knowledge visualization
 */

import { useEffect } from 'react'
import { useMapStore } from '../stores/useMapStore'
import { MapCanvas } from '../components/map/MapCanvas'
import { CityDetailsPanel } from '../components/map/CityDetailsPanel'
import { MapToolbar } from '../components/map/MapToolbar'
import { Map } from 'lucide-react'

export function KnowledgeMapPage() {
  const { mapData, loading, error, fetchMap, selectCity } = useMapStore()

  useEffect(() => {
    // Load map on mount
    fetchMap().catch(err => {
      console.error('[KnowledgeMapPage] Failed to fetch map:', err)
    })
  }, [fetchMap])

  const handleCityClick = (cityId: string) => {
    const city = mapData?.cities.find(c => c.id === cityId)
    if (city) {
      selectCity(city)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: 'var(--premium-bg-1)' }}>
        <div className="flex flex-col items-center gap-4">
          <Map className="w-16 h-16 animate-pulse" style={{ color: 'var(--premium-blue)' }} />
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
              Generating Your Knowledge Map
            </h2>
            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
              Analyzing your projects, thoughts, and articles...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    const isMigrationError = error.includes('migration') || error.includes('table')

    return (
      <div className="flex flex-col items-center justify-center h-screen p-4" style={{ background: 'var(--premium-bg-1)' }}>
        <div className="premium-card p-8 max-w-2xl">
          <h2 className="text-xl font-bold mb-4 text-red-400">
            {isMigrationError ? 'Database Migration Required' : 'Failed to Load Map'}
          </h2>

          <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
            {error}
          </p>

          {isMigrationError && (
            <div className="mt-6 p-4 rounded-lg" style={{ background: 'var(--premium-bg-3)' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                How to Fix:
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                <li>Go to your Supabase Dashboard</li>
                <li>Navigate to SQL Editor</li>
                <li>Copy and paste the contents of <code className="px-1 py-0.5 rounded" style={{ background: 'var(--premium-bg-2)' }}>supabase/migrations/create_knowledge_map.sql</code></li>
                <li>Click "Run" to execute the migration</li>
                <li>Come back here and click "Try Again"</li>
              </ol>
              <div className="mt-4 p-3 rounded text-xs" style={{ background: 'var(--premium-bg-2)', color: 'var(--premium-text-tertiary)' }}>
                <p className="font-mono">
                  File: Aperture/projects/polymath/supabase/migrations/create_knowledge_map.sql
                </p>
              </div>
            </div>
          )}

          <button
            onClick={() => fetchMap()}
            className="mt-6 px-4 py-2 rounded-lg transition-all hover:opacity-90"
            style={{
              background: 'var(--premium-blue)',
              color: 'white'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state (no map data)
  if (!mapData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen" style={{ background: 'var(--premium-bg-1)' }}>
        <div className="premium-card p-8 max-w-md text-center">
          <Map className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
            No Map Data
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
            Start by adding some projects, thoughts, or articles to see your knowledge map.
          </p>
          <button
            onClick={() => fetchMap()}
            className="px-4 py-2 rounded-lg transition-all"
            style={{
              background: 'var(--premium-blue)',
              color: 'white'
            }}
          >
            Generate Map
          </button>
        </div>
      </div>
    )
  }

  // Main map view
  return (
    <div className="relative w-full h-screen">
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(to bottom, var(--premium-bg-2), transparent)' }}
      >
        <div className="flex items-center gap-3">
          <Map className="w-6 h-6" style={{ color: 'var(--premium-gold)' }} />
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--premium-text-primary)' }}>
              Knowledge Map
            </h1>
            <p className="text-xs" style={{ color: 'var(--premium-text-secondary)' }}>
              {mapData.cities.length} cities • {mapData.roads.length} roads
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="font-bold" style={{ color: 'var(--premium-gold)' }}>
              {mapData.cities.reduce((sum, c) => sum + c.population, 0)}
            </div>
            <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              Total Items
            </div>
          </div>
          <div className="text-center">
            <div className="font-bold" style={{ color: 'var(--premium-blue)' }}>
              {mapData.cities.filter(c => c.size === 'metropolis' || c.size === 'city').length}
            </div>
            <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
              Major Cities
            </div>
          </div>
        </div>
      </div>

      {/* Map Toolbar */}
      <MapToolbar />

      {/* Map Canvas */}
      <MapCanvas mapData={mapData} onCityClick={handleCityClick} />

      {/* City Details Panel */}
      {useMapStore.getState().selectedCity && (
        <CityDetailsPanel
          city={useMapStore.getState().selectedCity}
          mapData={mapData}
          onClose={() => selectCity(null)}
        />
      )}
    </div>
  )
}
