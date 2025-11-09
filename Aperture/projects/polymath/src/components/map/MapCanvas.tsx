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
  const [miniMapKey, setMiniMapKey] = useState(0) // Force mini map updates
  const hasInitializedViewport = useRef(false)

  // Use ref for transform to avoid re-renders on every pan/zoom
  const transformRef = useRef({
    x: mapData.viewport.x,
    y: mapData.viewport.y,
    scale: mapData.viewport.scale
  })

  // Apply transform directly to DOM (no React re-render)
  const applyTransform = (newTransform: { x: number; y: number; scale: number }, animate = false) => {
    transformRef.current = newTransform
    if (transformGroupRef.current) {
      // Add smooth transition for programmatic moves
      if (animate) {
        transformGroupRef.current.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
      } else {
        transformGroupRef.current.style.transition = ''
      }

      transformGroupRef.current.style.transform =
        `translate(${newTransform.x}px, ${newTransform.y}px) scale(${newTransform.scale})`

      // Remove transition after animation
      if (animate) {
        setTimeout(() => {
          if (transformGroupRef.current) {
            transformGroupRef.current.style.transition = ''
          }
        }, 600)
      }
    }
  }

  // Calculate optimal viewport to show all cities (like Google Maps fitBounds)
  const calculateFitBounds = useCallback(() => {
    if (!containerRef.current || mapData.cities.length === 0) return null

    const containerRect = containerRef.current.getBoundingClientRect()
    const padding = 100 // Padding from edges in pixels

    // Find bounds of all cities
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    mapData.cities.forEach(city => {
      minX = Math.min(minX, city.position.x)
      maxX = Math.max(maxX, city.position.x)
      minY = Math.min(minY, city.position.y)
      maxY = Math.max(maxY, city.position.y)
    })

    // If only one city, use a default area around it
    if (mapData.cities.length === 1) {
      const city = mapData.cities[0]
      minX = city.position.x - 200
      maxX = city.position.x + 200
      minY = city.position.y - 200
      maxY = city.position.y + 200
    }

    const boundsWidth = maxX - minX
    const boundsHeight = maxY - minY
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    // Calculate scale to fit bounds with padding
    const scaleX = (containerRect.width - padding * 2) / boundsWidth
    const scaleY = (containerRect.height - padding * 2) / boundsHeight
    const scale = Math.min(scaleX, scaleY, 2) // Max scale of 2x

    // Calculate translation to center the bounds
    const x = containerRect.width / 2 - centerX * scale
    const y = containerRect.height / 2 - centerY * scale

    return { x, y, scale }
  }, [mapData.cities])

  // Recenter to show all cities
  const recenterMap = useCallback(() => {
    const newViewport = calculateFitBounds()
    if (newViewport) {
      applyTransform(newViewport, true)
      updateViewport(newViewport.x, newViewport.y, newViewport.scale)
    }
  }, [calculateFitBounds, updateViewport])

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

  // Initialize viewport - center on cities on first load, or use saved state
  useEffect(() => {
    // Check if this is the first load (viewport is at default 0,0,1 or hasn't been initialized)
    const isDefaultViewport = mapData.viewport.x === 0 && mapData.viewport.y === 0 && mapData.viewport.scale === 1

    if (!hasInitializedViewport.current || isDefaultViewport) {
      // First load - center on all cities
      const fitBounds = calculateFitBounds()
      if (fitBounds) {
        applyTransform(fitBounds, true)
        updateViewport(fitBounds.x, fitBounds.y, fitBounds.scale)
        hasInitializedViewport.current = true
      }
    } else {
      // Subsequent loads - use saved viewport
      const newTransform = {
        x: mapData.viewport.x,
        y: mapData.viewport.y,
        scale: mapData.viewport.scale
      }
      applyTransform(newTransform)
    }
  }, [mapData.viewport.x, mapData.viewport.y, mapData.viewport.scale, calculateFitBounds, updateViewport])

  // Save viewport periodically and update mini map
  useEffect(() => {
    const saveViewport = () => {
      const { x, y, scale } = transformRef.current
      updateViewport(x, y, scale)
      setMiniMapKey(prev => prev + 1) // Update mini map
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

      {/* Zoom and Recenter controls - Google Maps style */}
      <div className="absolute bottom-8 right-4 flex flex-col gap-3">
        {/* Zoom controls */}
        <div className="flex flex-col rounded-md overflow-hidden shadow-lg" style={{
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
            aria-label="Zoom in"
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
            aria-label="Zoom out"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M5 10h10" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Recenter button - like Google Maps "locate me" */}
        <button
          onClick={recenterMap}
          className="p-3 rounded-md shadow-lg hover:bg-gray-100 transition-all hover:shadow-xl"
          style={{
            background: '#ffffff',
            color: '#5f6368'
          }}
          title="Show all cities"
          aria-label="Recenter map to show all cities"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={2} />
            <path d="M12 2v4M12 18v4M22 12h-4M6 12H2" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
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

      {/* Mini overview map - shows all cities and current viewport */}
      <div
        key={miniMapKey}
        className="absolute top-20 right-4 rounded-md shadow-lg overflow-hidden"
        style={{
          background: '#ffffff',
          width: '150px',
          height: '120px'
        }}
      >
        <svg width="150" height="120" viewBox="0 0 4000 3000" style={{ background: '#f2efe9' }}>
          {/* Show all cities as small dots */}
          {mapData.cities.map(city => {
            // Calculate size based on population
            const radius = city.population >= 50 ? 40 : city.population >= 20 ? 30 : city.population >= 10 ? 20 : 15
            const color = city.population >= 50 ? '#1e40af' : city.population >= 20 ? '#3b82f6' : city.population >= 10 ? '#60a5fa' : '#93c5fd'

            return (
              <circle
                key={city.id}
                cx={city.position.x}
                cy={city.position.y}
                r={radius}
                fill={color}
                opacity={0.6}
              />
            )
          })}

          {/* Show current viewport as a rectangle */}
          {containerRef.current && (() => {
            const rect = containerRef.current.getBoundingClientRect()
            const { x, y, scale } = transformRef.current

            // Calculate the visible area in map coordinates
            const viewportWidth = rect.width / scale
            const viewportHeight = rect.height / scale
            const viewportX = -x / scale
            const viewportY = -y / scale

            return (
              <rect
                x={viewportX}
                y={viewportY}
                width={viewportWidth}
                height={viewportHeight}
                fill="none"
                stroke="#1e40af"
                strokeWidth={30}
                opacity={0.5}
              />
            )
          })()}
        </svg>
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 text-xs font-semibold text-center" style={{
          background: 'rgba(255, 255, 255, 0.9)',
          color: '#5f6368'
        }}>
          Overview
        </div>
      </div>

    </div>
  )
}
