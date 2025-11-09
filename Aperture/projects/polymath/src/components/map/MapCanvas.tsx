/**
 * MapCanvas Component - REDESIGNED
 * Google Maps-style SVG canvas with semantic regions, viewport culling, and optimized performance
 */

import { useRef, useEffect, useState, useMemo } from 'react'
import { useGesture } from '@use-gesture/react'
import type { MapData } from '../../utils/mapTypes'
import { CityNode } from './CityNode'
import { Road as RoadComponent } from './Road'
import { Door } from './Door'
import { DoorDialog } from './DoorDialog'
import { useMapStore } from '../../stores/useMapStore'

interface MapCanvasProps {
  mapData: MapData
  onCityClick: (cityId: string) => void
}

export function MapCanvas({ mapData, onCityClick }: MapCanvasProps) {
  const { updateViewport, acceptDoor, dismissDoor } = useMapStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedDoor, setSelectedDoor] = useState<any>(null)
  const [doorDialogOpen, setDoorDialogOpen] = useState(false)

  // Pan and zoom state (using state for reactivity with viewport culling)
  const [transform, setTransform] = useState({
    x: mapData.viewport.x,
    y: mapData.viewport.y,
    scale: mapData.viewport.scale
  })

  // Apply transform via state (React-controlled rendering)
  const applyTransform = (newTransform: { x: number; y: number; scale: number }) => {
    setTransform(newTransform)
  }

  // Setup pan and zoom gestures
  useGesture(
    {
      onDrag: ({ offset: [x, y] }) => {
        applyTransform({ ...transform, x, y })
      },
      onPinch: ({ offset: [scale] }) => {
        applyTransform({ ...transform, scale: Math.max(0.2, Math.min(3, scale)) })
      },
      onWheel: ({ delta: [, dy] }) => {
        const scaleDelta = -dy * 0.001
        const newScale = Math.max(0.2, Math.min(3, transform.scale + scaleDelta))
        applyTransform({ ...transform, scale: newScale })
      }
    },
    {
      target: containerRef,
      drag: {
        from: () => [transform.x, transform.y]
      },
      pinch: {
        from: () => [transform.scale, 0]
      }
    }
  )

  // Initialize viewport from saved state
  useEffect(() => {
    const newTransform = {
      x: mapData.viewport.x,
      y: mapData.viewport.y,
      scale: mapData.viewport.scale
    }
    applyTransform(newTransform)
  }, [mapData.viewport])

  // Save viewport on unmount or when transform changes
  useEffect(() => {
    const saveViewport = () => {
      const { x, y, scale } = transform
      updateViewport(x, y, scale)
    }

    // Save every 2 seconds while user is interacting
    const interval = setInterval(saveViewport, 2000)
    return () => {
      clearInterval(interval)
      saveViewport() // Save one last time
    }
  }, [transform, updateViewport])

  // Disable viewport culling for stability - render all cities
  // (With only a few cities, performance impact is negligible)
  const visibleCities = mapData.cities
  const visibleRoads = mapData.roads

  const handleCityClick = (cityId: string) => {
    onCityClick(cityId)
  }

  const handleDoorClick = (door: any) => {
    setSelectedDoor(door)
    setDoorDialogOpen(true)
  }

  const handleDoorAccept = () => {
    if (selectedDoor) {
      acceptDoor(selectedDoor)
      setDoorDialogOpen(false)
      setSelectedDoor(null)
    }
  }

  const handleDoorDismiss = () => {
    if (selectedDoor) {
      dismissDoor(selectedDoor.id)
      setDoorDialogOpen(false)
      setSelectedDoor(null)
    }
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden touch-none relative"
      style={{
        background: 'var(--premium-bg-1)'
      }}
    >
      {/* Map-style background */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: '#1a1f2e' // Dark blue-gray base (like Google Maps dark mode)
      }} />

      <svg
        ref={svgRef}
        className="w-full h-full relative"
        style={{ cursor: 'grab', zIndex: 1 }}
      >
        <defs>
          {/* Terrain texture pattern */}
          <pattern id="terrain-texture" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="#1e2332" />
            <circle cx="10" cy="10" r="0.5" fill="#2a3142" opacity="0.3" />
            <circle cx="50" cy="30" r="0.5" fill="#2a3142" opacity="0.2" />
            <circle cx="80" cy="70" r="0.5" fill="#2a3142" opacity="0.3" />
          </pattern>
        </defs>

        <g style={{
          transformOrigin: 'center',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
        }}>
          {/* Terrain base layer */}
          <rect
            x={-1000}
            y={-1000}
            width={6000}
            height={5000}
            fill="url(#terrain-texture)"
          />

          {/* Map grid lines (latitude/longitude style) */}
          <g opacity={0.1} stroke="#4a5568" strokeWidth={0.5} strokeDasharray="5,5">
            {Array.from({ length: 20 }).map((_, i) => (
              <g key={`grid-${i}`}>
                <line x1={i * 300} y1={-500} x2={i * 300} y2={4500} />
                <line x1={-500} y1={i * 300} x2={6000} y2={i * 300} />
              </g>
            ))}
          </g>

          {/* Regions removed - each cluster is already a single city, so regions don't add meaningful grouping */}

          {/* Render roads first (so they appear behind cities) */}
          {visibleRoads.map(road => (
            <RoadComponent key={road.id} road={road} cities={mapData.cities} />
          ))}

          {/* Render visible cities only */}
          {visibleCities.map(city => (
            <CityNode
              key={city.id}
              city={city}
              onClick={() => handleCityClick(city.id)}
            />
          ))}

          {/* Render doors */}
          {mapData.doors?.map(door => (
            <Door
              key={door.id}
              door={door}
              onClick={() => handleDoorClick(door)}
            />
          ))}
        </g>
      </svg>

      {/* Door Dialog */}
      <DoorDialog
        door={selectedDoor}
        open={doorDialogOpen}
        onClose={() => setDoorDialogOpen(false)}
        onAccept={handleDoorAccept}
        onDismiss={handleDoorDismiss}
      />

      {/* Zoom controls - Google Maps style */}
      <div className="absolute bottom-8 right-4 flex flex-col rounded-md overflow-hidden shadow-lg" style={{
        background: '#ffffff'
      }}>
        <button
          onClick={() => {
            const newScale = Math.min(3, transform.scale * 1.2)
            applyTransform({ ...transform, scale: newScale })
          }}
          className="p-3 hover:bg-gray-100 transition-colors border-b border-gray-200"
          style={{
            color: '#5f6368'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            const newScale = Math.max(0.2, transform.scale / 1.2)
            applyTransform({ ...transform, scale: newScale })
          }}
          className="p-3 hover:bg-gray-100 transition-colors"
          style={{
            color: '#5f6368'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Map legend - Google Maps style */}
      <div
        className="absolute bottom-8 left-4 p-3 rounded-md shadow-lg text-xs"
        style={{
          background: '#ffffff',
          color: '#202124'
        }}
      >
        <div className="font-semibold mb-2" style={{ color: '#202124', fontSize: '13px' }}>
          Knowledge Map
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#EA4335' }} />
            <span style={{ color: '#5f6368' }}>Major topic (50+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#FBBC04' }} />
            <span style={{ color: '#5f6368' }}>Topic (20-49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#34A853' }} />
            <span style={{ color: '#5f6368' }}>Subtopic (10-19)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#4285F4' }} />
            <span style={{ color: '#5f6368' }}>Theme (3-9)</span>
          </div>
        </div>
      </div>

    </div>
  )
}
