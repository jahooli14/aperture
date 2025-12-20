/**
 * CityBuilding Component
 * Renders a 3D-style building block for a city
 */

import { useMemo } from 'react'

interface CityBuildingProps {
    x: number
    y: number
    width: number
    height: number
    depth: number
    color: string
    opacity?: number
}

export function CityBuilding({ x, y, width, height, depth, color, opacity = 1 }: CityBuildingProps) {
    // Isometric projection helper
    // We'll simulate 3D by drawing 3 faces: Top, Left, Right

    const path = useMemo(() => {
        // Center point is x,y
        // Top face is a diamond
        // Left and Right faces go down

        // Simple block representation
        // Top face
        const top = `M ${x} ${y - depth} L ${x + width / 2} ${y - depth - width / 4} L ${x} ${y - depth - width / 2} L ${x - width / 2} ${y - depth - width / 4} Z`

        // Left face
        const left = `M ${x - width / 2} ${y - depth - width / 4} L ${x} ${y - depth} L ${x} ${y} L ${x - width / 2} ${y - width / 4} Z`

        // Right face
        const right = `M ${x} ${y - depth} L ${x + width / 2} ${y - depth - width / 4} L ${x + width / 2} ${y - width / 4} L ${x} ${y} Z`

        return { top, left, right }
    }, [x, y, width, height, depth])

    // Adjust colors for shading
    // We need to parse the color or just use CSS filters/opacity for shading
    // For simplicity, we'll use the base color with different opacities

    return (
        <g opacity={opacity}>
            {/* Right Face (Darkest) */}
            <path d={path.right} fill={color} filter="brightness(0.7)" />

            {/* Left Face (Medium) */}
            <path d={path.left} fill={color} filter="brightness(0.85)" />

            {/* Top Face (Lightest) */}
            <path d={path.top} fill={color} />
        </g>
    )
}
