import { Stars, Cloud, Sky } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

export function Environment() {
    const cloudsRef = useRef<any>()

    useFrame((state, delta) => {
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y += delta * 0.01
        }
    })

    return (
        <group>
            {/* Soft Gradient Background */}
            <color attach="background" args={['#f0f4f8']} />

            {/* Atmospheric fog for depth - lighter color */}
            <fog attach="fog" args={['#f0f4f8', 500, 2000]} />

            {/* Sky for a natural feel */}
            <Sky sunPosition={[100, 20, 100]} turbidity={0.5} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />

            {/* Floating Clouds for atmosphere */}
            <group ref={cloudsRef} position={[0, 100, 0]}>
                <Cloud opacity={0.3} speed={0.2} segments={10} position={[0, 50, -100]} />
                <Cloud opacity={0.3} speed={0.2} segments={10} position={[100, 50, 100]} />
                <Cloud opacity={0.3} speed={0.2} segments={10} position={[-100, 50, 100]} />
            </group>

            {/* Subtle grid for ground reference - lighter */}
            <gridHelper
                args={[2000, 50, '#cbd5e1', '#e2e8f0']}
                position={[0, -20, 0]}
            />

            {/* Ambient light - brighter */}
            <ambientLight intensity={0.8} />

            {/* Directional light (Sun) */}
            <directionalLight
                position={[100, 100, 50]}
                intensity={1.5}
                castShadow
                shadow-mapSize={[2048, 2048]}
            />

            {/* Warm fill light */}
            <pointLight position={[-100, 50, -100]} intensity={0.5} color="#ffd1dc" />
            {/* Cool fill light */}
            <pointLight position={[100, 50, 100]} intensity={0.5} color="#d1e8ff" />
        </group>
    )
}
