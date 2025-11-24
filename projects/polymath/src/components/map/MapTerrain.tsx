/**
 * MapTerrain Component
 * Renders the background terrain/water for the map
 */

import { useMemo } from 'react'
import * as d3 from 'd3-shape'

interface MapTerrainProps {
    width: number
    height: number
    seed?: number
}

export function MapTerrain({ width, height }: MapTerrainProps) {
    // Generate some organic shapes for "land"
    // For now, we'll just use a subtle gradient and some noise-like patterns

    return (
        <g className="map-terrain">
            {/* Water/Base */}
            <rect x={-width} y={-height} width={width * 3} height={height * 3} fill="#e5e3df" />

            {/* Subtle grid or texture could go here */}
            <pattern id="terrain-pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="1" fill="#d0cdc7" />
            </pattern>

            <rect x={-width} y={-height} width={width * 3} height={height * 3} fill="url(#terrain-pattern)" />
        </g>
    )
}
