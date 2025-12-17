import React, { useEffect, useRef, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Stars, Float, Text, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import * as d3 from 'd3-force-3d'
import { api } from '../../lib/apiClient'
import { Loader2 } from 'lucide-react'

interface GraphNode extends d3.SimulationNodeDatum {
    id: string
    title: string
    type: 'project' | 'thought' | 'article'
    strength: number
    color: string
    x?: number
    y?: number
    z?: number
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
    source: string | GraphNode
    target: string | GraphNode
}

// --- Terrain Component ---
function Terrain({ nodes }: { nodes: GraphNode[] }) {
    const meshRef = useRef<THREE.Mesh>(null)

    const { geometry, positions, count } = useMemo(() => {
        const size = 1000
        const segments = 128
        const geo = new THREE.PlaneGeometry(size, size, segments, segments)
        const pos = geo.attributes.position.array as Float32Array
        return { geometry: geo, positions: pos, count: (segments + 1) * (segments + 1) }
    }, [])

    useFrame(() => {
        if (!meshRef.current || nodes.length === 0) return

        const posAttr = meshRef.current.geometry.attributes.position
        const positions = posAttr.array as Float32Array

        // Reset heights (Z is height for the plane which is rotated on X)
        for (let i = 0; i < count; i++) {
            // We only modify the Z value (which will be Y after rotation)
            const x = positions[i * 3]
            const y = positions[i * 3 + 1]

            let height = 0

            // Calculate height based on proximity to nodes (Mountain peaks)
            for (const node of nodes) {
                const nx = node.x || 0
                const ny = node.y || 0 // Force graph Y is our plane Y (before rotation)

                const dx = x - nx
                const dy = y - ny
                const distSq = dx * dx + dy * dy

                // Gaussian-like peak
                const strength = node.strength || 1
                const peakHeight = strength * 20
                const radius = 60 + strength * 10

                height += peakHeight * Math.exp(-distSq / (2 * radius * radius))
            }

            positions[i * 3 + 2] = height
        }

        posAttr.needsUpdate = true
        meshRef.current.geometry.computeVertexNormals()
    })

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <primitive object={geometry} attach="geometry" />
            <meshStandardMaterial
                color="#1a1a2e"
                wireframe={false}
                roughness={0.8}
                metalness={0.2}
                emissive="#0a0a1a"
                flatShading
            />
        </mesh>
    )
}

// --- Individual Node Component ---
function NodeMesh({ node }: { node: GraphNode }) {
    const [hovered, setHovered] = useState(false)
    const meshRef = useRef<THREE.Group>(null)

    // Position node on the surface
    // Note: terrain height calculation needs to be consistent
    useFrame((state) => {
        if (!meshRef.current) return

        // We'll just let them float a bit above their "peak"
        // In a real implementation we'd sample the terrain height here
    })

    return (
        <group position={[node.x || 0, (node.strength * 20) + 5, node.y || 0]} ref={meshRef}>
            <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
                <mesh
                    onPointerOver={() => setHovered(true)}
                    onPointerOut={() => setHovered(false)}
                >
                    <sphereGeometry args={[node.strength * 2, 16, 16]} />
                    <meshStandardMaterial
                        color={node.color}
                        emissive={node.color}
                        emissiveIntensity={hovered ? 2 : 0.5}
                    />
                </mesh>
            </Float>

            {hovered && (
                <Text
                    position={[0, node.strength * 2 + 5, 0]}
                    fontSize={5}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    {node.title}
                </Text>
            )}
        </group>
    )
}

// --- Main 3D Map Component ---
export function TopologicalMap3D() {
    const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const [projectsRes, memoriesRes, connectionsRes] = await Promise.all([
                    api.get('projects'),
                    api.get('memories'),
                    api.get('connections?action=list-all')
                ])

                const projects = (projectsRes.projects || []).map((p: any) => ({
                    id: String(p.id),
                    title: p.title,
                    type: 'project',
                    strength: 5,
                    color: '#3b82f6'
                }))

                const memories = (memoriesRes.memories || []).map((m: any) => ({
                    id: String(m.id),
                    title: m.title || 'Untitled Thought',
                    type: 'thought',
                    strength: 3,
                    color: '#a855f7'
                }))

                const nodes: GraphNode[] = [...projects, ...memories]
                const nodesMap = new Map(nodes.map(n => [n.id, n]))

                const links: GraphLink[] = (connectionsRes.connections || [])
                    .filter((c: any) => nodesMap.has(String(c.source_id)) && nodesMap.has(String(c.target_id)))
                    .map((c: any) => ({
                        source: String(c.source_id),
                        target: String(c.target_id)
                    }))

                // Run Force Simulation to get 2D cluster positions
                const simulation = d3.forceSimulation<GraphNode>(nodes)
                    .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id).distance(100))
                    .force('charge', d3.forceManyBody().strength(-200))
                    .force('center', d3.forceCenter(0, 0))
                    .stop()

                for (let i = 0; i < 300; i++) simulation.tick()

                setData({ nodes, links })
            } catch (error) {
                console.error('Failed to load map data:', error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#020204]">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
                <span className="text-blue-500/50 font-mono tracking-widest uppercase">Eroding Knowledge Terrain...</span>
            </div>
        )
    }

    return (
        <div className="w-full h-full bg-[#020204]">
            <Canvas shadows dpr={[1, 2]}>
                <PerspectiveCamera makeDefault position={[0, 400, 600]} fov={50} />
                <OrbitControls
                    maxPolarAngle={Math.PI / 2.1}
                    minDistance={100}
                    maxDistance={1500}
                />

                <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
                <ambientLight intensity={0.5} />
                <pointLight position={[100, 500, 100]} intensity={1} castShadow />

                <Suspense fallback={null}>
                    <Terrain nodes={data.nodes} />
                    {data.nodes.map(node => (
                        <NodeMesh key={node.id} node={node} />
                    ))}
                </Suspense>

                <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={2000} blur={2} far={4} />
            </Canvas>

            {/* Legend Overlay */}
            <div className="absolute top-4 right-4 premium-glass p-4 rounded-xl border border-white/10 pointer-events-none">
                <h3 className="text-xs font-bold text-white/70 mb-2 uppercase tracking-tight">Topography Legend</h3>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-[10px] text-white/50">Project Peaks</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="text-[10px] text-white/50">Thought Mounds</span>
                    </div>
                    <div className="mt-2 text-[9px] text-white/30 italic">Height = Knowledge Strength</div>
                </div>
            </div>
        </div>
    )
}
