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
      {/* Subtle animated gradient orbs (like homepage) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl opacity-10"
          style={{
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.4), transparent 70%)',
            top: '-10%',
            right: '-10%'
          }}
        />
        <div
          className="absolute rounded-full blur-3xl opacity-10"
          style={{
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3), transparent 70%)',
            bottom: '-5%',
            left: '-5%'
          }}
        />
        <div
          className="absolute rounded-full blur-3xl opacity-10"
          style={{
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25), transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <svg
        ref={svgRef}
        className="w-full h-full relative"
        style={{ cursor: 'grab', zIndex: 1 }}
      >
        <g style={{ transformOrigin: 'center' }}>
          {/* Subtle grid (minimal) */}
          <g opacity={0.02}>
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

    </div>
  )
}
