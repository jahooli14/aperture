/**
 * Knowledge Map Page - REBUILD
 * Full-screen, immersive knowledge visualization
 */

import { useEffect } from 'react'
import { useMapStore } from '../stores/useMapStore'
import { Map3D } from '../components/map/Map3D'
import { CityDetailsPanel } from '../components/map/CityDetailsPanel'
import { MapToolbar } from '../components/map/MapToolbar'
import { Map, Loader2 } from 'lucide-react'

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
  if (loading && !mapData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#e5e3df]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2 text-gray-800">
              Building Your World
            </h2>
            <p className="text-sm text-gray-600">
              Constructing cities from your knowledge...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#e5e3df] p-4">
        <div className="bg-white p-8 rounded-xl shadow-xl max-w-md text-center">
          <h2 className="text-xl font-bold mb-4 text-red-500">
            Map Generation Failed
          </h2>
          <p className="mb-6 text-gray-600">
            {error}
          </p>
          <button
            onClick={() => fetchMap()}
            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (!mapData) {
    return null
  }

  // Main map view - Full Screen Container
  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-[#e5e3df]">
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-sm border border-white/20">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Map className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">
                Knowledge Map
              </h1>
              <p className="text-xs text-gray-500">
                {mapData.cities.length} cities • {mapData.roads.length} connections
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Toolbar */}
      <MapToolbar />

      {/* Map Canvas */}
      <Map3D mapData={mapData} onCityClick={handleCityClick} />

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
