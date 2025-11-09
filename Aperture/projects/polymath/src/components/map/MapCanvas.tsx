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

  // Apply transform to SVG
  const applyTransform = (newTransform: { x: number; y: number; scale: number }) => {
    if (svgRef.current) {
      const { x, y, scale } = newTransform
      const g = svgRef.current.querySelector('g')
      if (g) {
        g.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
      }
    }
    setTransform(newTransform) // Update state for viewport culling
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

  // Viewport culling - only render visible cities (now reactive to transform state!)
  const visibleCities = useMemo(() => {
    if (!containerRef.current) return mapData.cities

    const containerWidth = containerRef.current.clientWidth || 1920
    const containerHeight = containerRef.current.clientHeight || 1080

    const { x, y, scale } = transform

    // Calculate visible bounds in world coordinates
    const padding = 500 // Extra padding to prevent pop-in
    const left = (-x / scale) - padding
    const right = ((-x + containerWidth) / scale) + padding
    const top = (-y / scale) - padding
    const bottom = ((-y + containerHeight) / scale) + padding

    return mapData.cities.filter(city => {
      return city.position.x >= left &&
             city.position.x <= right &&
             city.position.y >= top &&
             city.position.y <= bottom
    })
  }, [mapData.cities, transform.x, transform.y, transform.scale])

  // Visible roads (only show if both cities are visible)
  const visibleRoads = useMemo(() => {
    const visibleCityIds = new Set(visibleCities.map(c => c.id))
    return mapData.roads.filter(road =>
      visibleCityIds.has(road.fromCityId) && visibleCityIds.has(road.toCityId)
    )
  }, [mapData.roads, visibleCities])

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
      className="w-full h-full overflow-hidden touch-none"
      style={{
        background: 'linear-gradient(135deg, #141b26 0%, #1a2332 50%, #0f1419 100%)'
      }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
      >
        <defs>
          {/* Terrain texture pattern */}
          <filter id="terrain-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" />
            <feColorMatrix values="0 0 0 0 0.1
                                    0 0 0 0 0.15
                                    0 0 0 0 0.2
                                    0 0 0 0.05 0" />
          </filter>

          {/* Radial gradient for regions */}
          <radialGradient id="region-gradient">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="70%" stopColor="currentColor" stopOpacity="0.1" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>

          {/* Road gradient for highways */}
          <linearGradient id="highway-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.2)" />
            <stop offset="50%" stopColor="rgba(59, 130, 246, 0.4)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.2)" />
          </linearGradient>
        </defs>

        <g style={{ transformOrigin: 'center' }}>
          {/* Terrain background */}
          <rect
            x={-1000}
            y={-1000}
            width={6000}
            height={5000}
            fill="#0f1419"
            filter="url(#terrain-noise)"
            opacity={0.3}
          />

          {/* Subtle grid (like lat/long lines on maps) */}
          <g opacity={0.05}>
            {Array.from({ length: 15 }).map((_, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1={i * 300}
                  y1={0}
                  x2={i * 300}
                  y2={4500}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="10,10"
                />
                <line
                  x1={0}
                  y1={i * 300}
                  x2={4500}
                  y2={i * 300}
                  stroke="#3b82f6"
                  strokeWidth={1}
                  strokeDasharray="10,10"
                />
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

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => {
            const newScale = Math.min(3, transform.scale * 1.2)
            applyTransform({ ...transform, scale: newScale })
          }}
          className="p-3 rounded-lg shadow-lg transition-all"
          style={{
            background: 'rgba(32, 43, 62, 0.95)',
            color: 'var(--premium-text-primary)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            const newScale = Math.max(0.2, transform.scale / 1.2)
            applyTransform({ ...transform, scale: newScale })
          }}
          className="p-3 rounded-lg shadow-lg transition-all"
          style={{
            background: 'rgba(32, 43, 62, 0.95)',
            color: 'var(--premium-text-primary)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            applyTransform({ x: 0, y: 0, scale: 1 })
          }}
          className="p-3 rounded-lg shadow-lg transition-all text-xs font-semibold"
          style={{
            background: 'rgba(32, 43, 62, 0.95)',
            color: 'var(--premium-text-primary)',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}
        >
          Reset
        </button>
      </div>

      {/* Map legend (bottom left) */}
      <div
        className="absolute bottom-4 left-4 p-4 rounded-lg shadow-lg text-xs"
        style={{
          background: 'rgba(32, 43, 62, 0.95)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          color: 'var(--premium-text-secondary)'
        }}
      >
        <div className="font-bold mb-2 text-sm" style={{ color: 'var(--premium-text-primary)' }}>
          Legend
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--premium-gold)' }} />
            <span>Metropolis (50+ items)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--premium-purple)' }} />
            <span>City (20-49 items)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--premium-indigo)' }} />
            <span>Town (10-19 items)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'var(--premium-blue)' }} />
            <span>Village (3-9 items)</span>
          </div>
        </div>
      </div>

      {/* Performance indicator */}
      <div
        className="absolute top-20 left-4 px-3 py-2 rounded text-xs"
        style={{
          background: 'rgba(32, 43, 62, 0.8)',
          color: 'var(--premium-text-tertiary)'
        }}
      >
        Rendering: {visibleCities.length}/{mapData.cities.length} cities
      </div>
    </div>
  )
}
