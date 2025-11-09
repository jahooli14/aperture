/**
 * MapCanvas Component - REDESIGNED
 * Google Maps-style SVG canvas with semantic regions, viewport culling, and optimized performance
 */

import { useRef, useEffect, useState, useCallback } from 'react'
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
  const transformGroupRef = useRef<SVGGElement>(null)
  const [selectedDoor, setSelectedDoor] = useState<any>(null)
  const [doorDialogOpen, setDoorDialogOpen] = useState(false)

  // Use ref for transform to avoid re-renders on every pan/zoom
  const transformRef = useRef({
    x: mapData.viewport.x,
    y: mapData.viewport.y,
    scale: mapData.viewport.scale
  })

  // Apply transform directly to DOM (no React re-render)
  const applyTransform = (newTransform: { x: number; y: number; scale: number }) => {
    transformRef.current = newTransform
    if (transformGroupRef.current) {
      transformGroupRef.current.style.transform =
        `translate(${newTransform.x}px, ${newTransform.y}px) scale(${newTransform.scale})`
    }
  }

  // Setup pan and zoom gestures
  useGesture(
    {
      onDrag: ({ offset: [x, y] }) => {
        applyTransform({ ...transformRef.current, x, y })
      },
      onPinch: ({ offset: [scale], origin: [ox, oy] }) => {
        const newScale = Math.max(0.2, Math.min(3, scale))
        // Zoom towards pinch center
        const scaleDiff = newScale / transformRef.current.scale
        const newX = ox - (ox - transformRef.current.x) * scaleDiff
        const newY = oy - (oy - transformRef.current.y) * scaleDiff
        applyTransform({ x: newX, y: newY, scale: newScale })
      },
      onWheel: ({ delta: [, dy], event }) => {
        if (!containerRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = (event as WheelEvent).clientX - rect.left
        const mouseY = (event as WheelEvent).clientY - rect.top

        const scaleDelta = -dy * 0.001
        const newScale = Math.max(0.2, Math.min(3, transformRef.current.scale + scaleDelta))

        // Zoom towards mouse position
        const scaleDiff = newScale / transformRef.current.scale
        const newX = mouseX - (mouseX - transformRef.current.x) * scaleDiff
        const newY = mouseY - (mouseY - transformRef.current.y) * scaleDiff

        applyTransform({ x: newX, y: newY, scale: newScale })
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
    const newTransform = {
      x: mapData.viewport.x,
      y: mapData.viewport.y,
      scale: mapData.viewport.scale
    }
    applyTransform(newTransform)
  }, [mapData.viewport.x, mapData.viewport.y, mapData.viewport.scale])

  // Save viewport periodically
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

  // Disable viewport culling for stability - render all cities
  // (With only a few cities, performance impact is negligible)
  const visibleCities = mapData.cities
  const visibleRoads = mapData.roads

  // Store click handlers in a ref to avoid creating new functions on every render
  const cityClickHandlers = useRef<Map<string, () => void>>(new Map())
  const doorClickHandlers = useRef<Map<string, () => void>>(new Map())

  const getCityClickHandler = useCallback((cityId: string) => {
    if (!cityClickHandlers.current.has(cityId)) {
      cityClickHandlers.current.set(cityId, () => onCityClick(cityId))
    }
    return cityClickHandlers.current.get(cityId)!
  }, [onCityClick])

  const getDoorClickHandler = useCallback((door: any) => {
    if (!doorClickHandlers.current.has(door.id)) {
      doorClickHandlers.current.set(door.id, () => {
        setSelectedDoor(door)
        setDoorDialogOpen(true)
      })
    }
    return doorClickHandlers.current.get(door.id)!
  }, [])

  const handleDoorAccept = useCallback(() => {
    if (selectedDoor) {
      acceptDoor(selectedDoor)
      setDoorDialogOpen(false)
      setSelectedDoor(null)
    }
  }, [selectedDoor, acceptDoor])

  const handleDoorDismiss = useCallback(() => {
    if (selectedDoor) {
      dismissDoor(selectedDoor.id)
      setDoorDialogOpen(false)
      setSelectedDoor(null)
    }
  }, [selectedDoor, dismissDoor])

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden touch-none relative"
      style={{
        background: 'var(--premium-bg-1)'
      }}
    >
      {/* Map-style background - Light mode */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: '#e5e3df' // Light beige (like Google Maps light mode)
      }} />

      <svg
        ref={svgRef}
        className="w-full h-full relative"
        style={{ cursor: 'grab', zIndex: 1 }}
      >
        <g
          ref={transformGroupRef}
          style={{
            willChange: 'transform',
            transformOrigin: '0 0'
          }}
        >
          {/* Terrain base layer */}
          <rect
            x={-1000}
            y={-1000}
            width={6000}
            height={5000}
            fill="#f2efe9"
          />

          {/* Map grid lines (latitude/longitude style) */}
          <g opacity={0.15} stroke="#c9c4b8" strokeWidth={0.5}>
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
              onClick={getCityClickHandler(city.id)}
            />
          ))}

          {/* Render doors */}
          {mapData.doors?.map(door => (
            <Door
              key={door.id}
              door={door}
              onClick={getDoorClickHandler(door)}
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
      <div className="absolute bottom-8 right-4 flex flex-col rounded-md overflow-hidden shadow-lg" style={{
        background: '#ffffff'
      }}>
        <button
          onClick={() => {
            if (!containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const centerX = rect.width / 2
            const centerY = rect.height / 2

            const newScale = Math.min(3, transformRef.current.scale * 1.2)
            const scaleDiff = newScale / transformRef.current.scale
            const newX = centerX - (centerX - transformRef.current.x) * scaleDiff
            const newY = centerY - (centerY - transformRef.current.y) * scaleDiff

            applyTransform({ x: newX, y: newY, scale: newScale })
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
            if (!containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            const centerX = rect.width / 2
            const centerY = rect.height / 2

            const newScale = Math.max(0.2, transformRef.current.scale / 1.2)
            const scaleDiff = newScale / transformRef.current.scale
            const newX = centerX - (centerX - transformRef.current.x) * scaleDiff
            const newY = centerY - (centerY - transformRef.current.y) * scaleDiff

            applyTransform({ x: newX, y: newY, scale: newScale })
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

      {/* Map legend */}
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
            <div className="w-4 h-4 rounded-full" style={{ background: '#1e40af' }} />
            <span style={{ color: '#5f6368' }}>Major topic (50+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#3b82f6' }} />
            <span style={{ color: '#5f6368' }}>Topic (20-49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#60a5fa' }} />
            <span style={{ color: '#5f6368' }}>Subtopic (10-19)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: '#93c5fd' }} />
            <span style={{ color: '#5f6368' }}>Theme (3-9)</span>
          </div>
        </div>
      </div>

    </div>
  )
}
