/**
 * MapCanvas Component
 * SVG canvas with pan and zoom for the knowledge map
 */

import { useRef, useEffect, useState } from 'react'
import { useGesture } from '@use-gesture/react'
import type { MapData } from '../../utils/mapTypes'
import { CityNode } from './CityNode'
import { Road } from './Road'
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

  // Pan and zoom state
  const transformRef = useRef({
    x: mapData.viewport.x,
    y: mapData.viewport.y,
    scale: mapData.viewport.scale
  })

  // Apply transform to SVG
  const applyTransform = () => {
    if (svgRef.current) {
      const { x, y, scale } = transformRef.current
      const g = svgRef.current.querySelector('g')
      if (g) {
        g.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
      }
    }
  }

  // Setup pan and zoom gestures
  useGesture(
    {
      onDrag: ({ offset: [x, y] }) => {
        transformRef.current.x = x
        transformRef.current.y = y
        applyTransform()
      },
      onPinch: ({ offset: [scale] }) => {
        transformRef.current.scale = Math.max(0.2, Math.min(3, scale))
        applyTransform()
      },
      onWheel: ({ delta: [, dy] }) => {
        const scaleDelta = -dy * 0.001
        const newScale = Math.max(0.2, Math.min(3, transformRef.current.scale + scaleDelta))
        transformRef.current.scale = newScale
        applyTransform()
      }
    },
    {
      target: containerRef,
      drag: {
        from: () => [transformRef.current.x, transformRef.current.y]
      },
      pinch: {
        from: () => [transformRef.current.scale, 0]
      }
    }
  )

  // Initialize viewport from saved state
  useEffect(() => {
    transformRef.current = {
      x: mapData.viewport.x,
      y: mapData.viewport.y,
      scale: mapData.viewport.scale
    }
    applyTransform()
  }, [mapData.viewport])

  // Save viewport on unmount or when transform changes
  useEffect(() => {
    const saveViewport = () => {
      const { x, y, scale } = transformRef.current
      updateViewport(x, y, scale)
    }

    // Save every 2 seconds while user is interacting
    const interval = setInterval(saveViewport, 2000)
    return () => {
      clearInterval(interval)
      saveViewport() // Save one last time
    }
  }, [updateViewport])

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
      style={{ background: 'var(--premium-bg-1)' }}
    >
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ cursor: 'grab' }}
      >
        <defs>
          {/* Gradient for premium look */}
          <linearGradient id="map-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'var(--premium-bg-2)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'var(--premium-bg-1)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        <g style={{ transformOrigin: 'center', transition: 'transform 0.1s ease-out' }}>
          {/* Background rect for visual context */}
          <rect x={-1000} y={-1000} width={5000} height={5000} fill="url(#map-gradient)" />

          {/* Grid pattern for visual reference */}
          <g opacity={0.1}>
            {Array.from({ length: 20 }).map((_, i) => (
              <g key={`grid-${i}`}>
                <line
                  x1={i * 300}
                  y1={0}
                  x2={i * 300}
                  y2={3000}
                  stroke="var(--premium-blue)"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={i * 300}
                  x2={3000}
                  y2={i * 300}
                  stroke="var(--premium-blue)"
                  strokeWidth={1}
                />
              </g>
            ))}
          </g>

          {/* Render roads first (so they appear behind cities) */}
          {mapData.roads.map(road => (
            <Road key={road.id} road={road} cities={mapData.cities} />
          ))}

          {/* Render cities */}
          {mapData.cities.map(city => (
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
            transformRef.current.scale = Math.min(3, transformRef.current.scale * 1.2)
            applyTransform()
          }}
          className="premium-bg-3 text-premium-text-primary p-3 rounded-lg shadow-lg hover:bg-opacity-90 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            transformRef.current.scale = Math.max(0.2, transformRef.current.scale / 1.2)
            applyTransform()
          }}
          className="premium-bg-3 text-premium-text-primary p-3 rounded-lg shadow-lg hover:bg-opacity-90 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={() => {
            transformRef.current = { x: 0, y: 0, scale: 1 }
            applyTransform()
          }}
          className="premium-bg-3 text-premium-text-primary p-3 rounded-lg shadow-lg hover:bg-opacity-90 transition-all text-xs"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
