import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { Suspense } from 'react'
import type { MapData } from '../../utils/mapTypes'
import { NodeGraph } from './NodeGraph'
import { Environment } from './Environment'

interface Map3DProps {
    mapData: MapData
    onCityClick: (cityId: string) => void
}

export function Map3D({ mapData, onCityClick }: Map3DProps) {
    return (
        <div className="w-full h-full bg-[#050510]">
            <Canvas dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 100, 200]} fov={60} />

                <Suspense fallback={null}>
                    <Environment />
                    <NodeGraph mapData={mapData} onCityClick={onCityClick} />
                </Suspense>

                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    maxDistance={2000}
                    minDistance={20}
                    maxPolarAngle={Math.PI / 2 - 0.1} // Prevent going below ground
                />
            </Canvas>
        </div>
    )
}
