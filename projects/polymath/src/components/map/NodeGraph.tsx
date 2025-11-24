import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Html, Sphere, Line, Float } from '@react-three/drei'
import * as THREE from 'three'
import type { MapData, City, Road } from '../../utils/mapTypes'

interface NodeGraphProps {
    mapData: MapData
    onCityClick: (cityId: string) => void
}

const CITY_SCALE_FACTOR = 0.1
const CENTER_OFFSET_X = 2000
const CENTER_OFFSET_Y = 1500
const ROAD_HEIGHT = 0

// Vibrant color palette for different city sizes
const CITY_COLORS = {
    metropolis: '#8B5CF6', // Violet
    city: '#EC4899',       // Pink
    town: '#F59E0B',       // Amber
    village: '#10B981',    // Emerald
    homestead: '#3B82F6'   // Blue
}

function CityMesh({ city, onClick }: { city: City; onClick: () => void }) {
    const meshRef = useRef<THREE.Mesh>(null)
    const [hovered, setHovered] = useState(false)

    // Calculate size based on population/importance
    const size = useMemo(() => {
        switch (city.size) {
            case 'metropolis': return 6
            case 'city': return 4.5
            case 'town': return 3
            case 'village': return 2
            default: return 1.5
        }
    }, [city.size])

    const color = CITY_COLORS[city.size] || '#6366f1'

    useFrame((state) => {
        if (meshRef.current) {
            // Gentle rotation
            meshRef.current.rotation.x += 0.005
            meshRef.current.rotation.y += 0.005
        }
    })

    return (
        <group position={[
            (city.position.x - CENTER_OFFSET_X) * CITY_SCALE_FACTOR,
            0,
            (city.position.y - CENTER_OFFSET_Y) * CITY_SCALE_FACTOR
        ]}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
                {/* The main sphere */}
                <Sphere
                    ref={meshRef}
                    args={[size, 32, 32]}
                    onClick={(e) => {
                        e.stopPropagation()
                        console.log('Clicked city:', city.name) // Debug log
                        onClick()
                    }}
                    onPointerOver={(e) => {
                        e.stopPropagation()
                        document.body.style.cursor = 'pointer'
                        setHovered(true)
                    }}
                    onPointerOut={(e) => {
                        e.stopPropagation()
                        document.body.style.cursor = 'default'
                        setHovered(false)
                    }}
                >
                    <meshPhysicalMaterial
                        color={color}
                        emissive={color}
                        emissiveIntensity={hovered ? 0.8 : 0.2}
                        roughness={0.1}
                        metalness={0.1}
                        transmission={0.6} // Glass-like
                        thickness={2}
                        clearcoat={1}
                    />
                </Sphere>

                {/* Outer glow ring for metropolis/city */}
                {(city.size === 'metropolis' || city.size === 'city') && (
                    <mesh>
                        <ringGeometry args={[size * 1.4, size * 1.5, 32]} />
                        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
                    </mesh>
                )}
            </Float>

            {/* Label - Always visible but enhanced on hover */}
            <Html position={[0, size + 2, 0]} center distanceFactor={100} style={{ pointerEvents: 'none' }}>
                <div className={`
          flex flex-col items-center transition-all duration-300
          ${hovered ? 'scale-110 z-50' : 'scale-100 z-0'}
        `}>
                    <div className={`
            px-3 py-1.5 rounded-xl backdrop-blur-md shadow-lg border transition-colors duration-300
            ${hovered
                            ? 'bg-white/90 border-purple-200 text-purple-900 font-bold'
                            : 'bg-white/60 border-white/40 text-slate-700 font-medium'
                        }
          `}>
                        <span className="whitespace-nowrap text-sm">{city.name}</span>
                    </div>
                    {hovered && (
                        <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-800 text-white text-xs">
                            {city.population} items
                        </div>
                    )}
                </div>
            </Html>

            {/* Ground shadow */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -size - 2, 0]}>
                <circleGeometry args={[size * 0.8, 32]} />
                <meshBasicMaterial color={color} transparent opacity={0.15} />
            </mesh>
        </group>
    )
}

function RoadLine({ road, cities }: { road: Road; cities: City[] }) {
    const points = useMemo(() => {
        const start = cities.find(c => c.id === road.fromCityId)
        const end = cities.find(c => c.id === road.toCityId)

        if (!start || !end) return null

        return [
            new THREE.Vector3(
                (start.position.x - CENTER_OFFSET_X) * CITY_SCALE_FACTOR,
                ROAD_HEIGHT,
                (start.position.y - CENTER_OFFSET_Y) * CITY_SCALE_FACTOR
            ),
            new THREE.Vector3(
                (end.position.x - CENTER_OFFSET_X) * CITY_SCALE_FACTOR,
                ROAD_HEIGHT,
                (end.position.y - CENTER_OFFSET_Y) * CITY_SCALE_FACTOR
            )
        ]
    }, [road, cities])

    if (!points) return null

    const lineWidth = road.type === 'highway' ? 2 : road.type === 'main' ? 1.5 : 1
    const color = '#94a3b8' // Slate-400 for roads
    const opacity = road.type === 'highway' ? 0.4 : 0.2

    return (
        <Line
            points={points}
            color={color}
            lineWidth={lineWidth}
            transparent
            opacity={opacity}
            dashed={road.type === 'trail'}
        />
    )
}

export function NodeGraph({ mapData, onCityClick }: NodeGraphProps) {
    return (
        <group>
            {/* Roads */}
            {mapData.roads.map(road => (
                <RoadLine key={road.id} road={road} cities={mapData.cities} />
            ))}

            {/* Cities */}
            {mapData.cities.map(city => (
                <CityMesh key={city.id} city={city} onClick={() => onCityClick(city.id)} />
            ))}
        </group>
    )
}
