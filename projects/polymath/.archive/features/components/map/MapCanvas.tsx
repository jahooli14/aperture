/**
 * MapCanvas Component - REBUILD
 * Full-screen, d3-zoom enabled canvas with premium visuals
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3-selection'
import * as d3Zoom from 'd3-zoom'
import 'd3-transition' // Import to augment d3-selection types
import type { MapData } from '../../utils/mapTypes'
import { CityNode } from './CityNode'
import { Road as RoadComponent } from './Road'
import { Door } from './Door'
import { DoorDialog } from './DoorDialog'
import { MapTerrain } from './MapTerrain'
import { useMapStore } from '../../stores/useMapStore'

interface MapCanvasProps {
  mapData: MapData
  onCityClick: (cityId: string) => void
}

export function MapCanvas({ mapData, onCityClick }: MapCanvasProps) {
  const { updateViewport, acceptDoor, dismissDoor } = useMapStore()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [selectedDoor, setSelectedDoor] = useState<any>(null)
  const [doorDialogOpen, setDoorDialogOpen] = useState(false)
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 })

  // Initialize d3-zoom
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return

    const svg = d3.select(svgRef.current)
    const g = d3.select(gRef.current)

    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4]) // Allow zooming out far and in close
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setTransform(event.transform)
      })
      .on('end', (event) => {
        // Save viewport on zoom end
        updateViewport(event.transform.x, event.transform.y, event.transform.k)
      })

    svg.call(zoom)

    // Initial positioning
    if (mapData.viewport.x === 0 && mapData.viewport.y === 0) {
      // Center map initially
      const width = window.innerWidth
      const height = window.innerHeight
      const initialScale = 0.8
      const initialX = width / 2
      const initialY = height / 2

      svg.call(zoom.transform, d3Zoom.zoomIdentity.translate(initialX, initialY).scale(initialScale))
    } else {
      // Restore saved viewport
      svg.call(zoom.transform, d3Zoom.zoomIdentity.translate(mapData.viewport.x, mapData.viewport.y).scale(mapData.viewport.scale))
    }

    return () => {
      svg.on('.zoom', null)
    }
  }, [mapData.viewport.x, mapData.viewport.y, mapData.viewport.scale, updateViewport])

  // Door handlers
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
    <div className="w-full h-full bg-[#e5e3df]">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <g ref={gRef}>
          {/* Infinite Terrain Background */}
          <MapTerrain width={8000} height={6000} />

          {/* Grid Lines */}
          <g opacity={0.1} stroke="#000" strokeWidth={1}>
            {Array.from({ length: 40 }).map((_, i) => (
              <g key={`grid-${i}`}>
                <line x1={(i - 20) * 500} y1={-10000} x2={(i - 20) * 500} y2={10000} />
                <line x1={-10000} y1={(i - 20) * 500} x2={10000} y2={(i - 20) * 500} />
              </g>
            ))}
          </g>

          {/* Roads Layer */}
          <g className="roads-layer">
            {mapData.roads.map(road => (
              <RoadComponent key={road.id} road={road} cities={mapData.cities} />
            ))}
          </g>

          {/* Cities Layer */}
          <g className="cities-layer">
            {mapData.cities.map(city => (
              <CityNode
                key={city.id}
                city={city}
                onClick={() => onCityClick(city.id)}
              />
            ))}
          </g>

          {/* Doors Layer */}
          <g className="doors-layer">
            {mapData.doors?.map(door => (
              <Door
                key={door.id}
                door={door}
                onClick={() => handleDoorClick(door)}
              />
            ))}
          </g>
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

      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-2">
        <button
          onClick={() => {
            const svg = d3.select(svgRef.current) as any
            const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
            svg.transition().duration(300).call(zoom.scaleBy, 1.3)
          }}
          className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 text-gray-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button
          onClick={() => {
            const svg = d3.select(svgRef.current) as any
            const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
            svg.transition().duration(300).call(zoom.scaleBy, 0.7)
          }}
          className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 text-gray-700"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  )
}
