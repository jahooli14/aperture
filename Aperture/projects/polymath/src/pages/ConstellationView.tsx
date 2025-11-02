/**
 * ConstellationView - Living Knowledge Galaxy
 *
 * A 3D force-directed graph that visualizes your entire knowledge base as a universe:
 * - Stars = Thoughts/Memories (small, glowing, intensity = recency)
 * - Planets = Projects (larger, with satellites)
 * - Comets = Articles (with trailing effect)
 * - Lightning = Connections (animated beams)
 * - Nebulae = AI-detected themes (colored clouds)
 *
 * Features:
 * - Time travel slider to watch universe expand
 * - Voice navigation
 * - Touch gestures (pinch, rotate, pan)
 * - Demo modes for presentations
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Play, Pause, Mic, MicOff, Sparkles, Calendar, Zap, Wand2, Eye, Target, Search, Maximize2, Camera, X, Info } from 'lucide-react'
import * as THREE from 'three'
import * as d3 from 'd3-force-3d'

interface GraphNode {
  id: string
  type: 'project' | 'thought' | 'article' | 'suggestion'
  name: string
  val: number // size
  color: string
  created_at: string
  metadata?: any
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
}

interface GraphLink {
  source: string
  target: string
  type: string
  created_at: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

// Visual themes for each node type - Premium Dark Palette
const NODE_THEMES = {
  project: {
    color: '#3b82f6', // Premium Blue
    glow: '#60a5fa',
    emissive: '#3b82f6',
    size: 15,
    label: 'Planet',
    icon: '🪐'
  },
  thought: {
    color: '#6366f1', // Premium Indigo
    glow: '#818cf8',
    emissive: '#6366f1',
    size: 8,
    label: 'Star',
    icon: '⭐'
  },
  article: {
    color: '#10b981', // Premium Emerald
    glow: '#34d399',
    emissive: '#10b981',
    size: 10,
    label: 'Comet',
    icon: '☄️'
  },
  suggestion: {
    color: '#f59e0b', // Premium Amber
    glow: '#fbbf24',
    emissive: '#f59e0b',
    size: 6,
    label: 'Spark',
    icon: '✨'
  }
}

export default function ConstellationView() {
  const navigate = useNavigate()
  const graphRef = useRef<any>()
  const starfieldRef = useRef<THREE.Points | null>(null)

  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [timeTravel, setTimeTravel] = useState(100) // 0-100% of timeline
  const [isPlaying, setIsPlaying] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [demoMode, setDemoMode] = useState<'none' | 'birth' | 'themes' | 'connections'>('none')
  const [filter, setFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: GraphNode } | null>(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>())
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>())
  const [showLegend, setShowLegend] = useState(true)

  // Detect device capability for performance optimization
  const deviceCapability = useMemo(() => {
    const gpu = (navigator as any).gpu
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const cores = navigator.hardwareConcurrency || 2
    if (isMobile || cores < 4) return 'low'
    if (gpu && cores >= 8) return 'high'
    return 'medium'
  }, [])

  // Fetch all data
  const fetchGraphData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all content types in parallel
      const [projectsRes, memoriesRes, articlesRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/memories'),
        fetch('/api/reading'),
      ])

      const projects = await projectsRes.json()
      const memories = await memoriesRes.json()
      const articles = await articlesRes.json()

      // TODO: Implement /api/connections endpoint for fetching all connections
      // For now, use empty connections to avoid breaking the visualization
      const connectionsData = { connections: [] }

      // Build nodes
      const nodes: GraphNode[] = []

      // Build links first to calculate connection counts
      const links: GraphLink[] = []
      connectionsData.connections?.forEach((c: any) => {
        links.push({
          source: `${c.source_type}-${c.source_id}`,
          target: `${c.target_type}-${c.target_id}`,
          type: c.connection_type,
          created_at: c.created_at
        })
      })

      // Calculate connection counts per node
      const connectionCounts = new Map<string, number>()
      links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id
        const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id
        connectionCounts.set(sourceId, (connectionCounts.get(sourceId) || 0) + 1)
        connectionCounts.set(targetId, (connectionCounts.get(targetId) || 0) + 1)
      })

      // Add projects (Planets)
      projects.projects?.forEach((p: any) => {
        const id = `project-${p.id}`
        nodes.push({
          id,
          type: 'project',
          name: p.title,
          val: NODE_THEMES.project.size,
          color: NODE_THEMES.project.color,
          created_at: p.created_at,
          metadata: { ...p, connectionCount: connectionCounts.get(id) || 0 }
        })
      })

      // Add memories (Stars)
      memories.memories?.forEach((m: any) => {
        const id = `thought-${m.id}`
        nodes.push({
          id,
          type: 'thought',
          name: m.title || 'Untitled thought',
          val: NODE_THEMES.thought.size,
          color: NODE_THEMES.thought.color,
          created_at: m.created_at,
          metadata: { ...m, connectionCount: connectionCounts.get(id) || 0 }
        })
      })

      // Add articles (Comets)
      articles.articles?.forEach((a: any) => {
        const id = `article-${a.id}`
        nodes.push({
          id,
          type: 'article',
          name: a.title,
          val: NODE_THEMES.article.size,
          color: NODE_THEMES.article.color,
          created_at: a.created_at,
          metadata: { ...a, connectionCount: connectionCounts.get(id) || 0 }
        })
      })

      setGraphData({ nodes, links })
    } catch (error) {
      console.error('Error fetching graph data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGraphData()
  }, [fetchGraphData])

  // Initialize ambient starfield background with enhanced visuals
  useEffect(() => {
    if (!graphRef.current || loading) return

    const scene = graphRef.current.scene()
    if (!scene) return

    // Create multi-layered starfield with varying sizes and colors (reduced for less crowding)
    const starCount = deviceCapability === 'low' ? 400 : deviceCapability === 'medium' ? 800 : 1500
    const starGeometry = new THREE.BufferGeometry()
    const starPositions = new Float32Array(starCount * 3)
    const starSizes = new Float32Array(starCount)
    const starColors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      // Random position in a large sphere with layered depth
      const radius = 1000 + Math.random() * 2000
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      starPositions[i * 3 + 2] = radius * Math.cos(phi)

      // Varying star sizes for depth - some bright, some dim
      const sizeVariation = Math.random()
      starSizes[i] = sizeVariation > 0.95 ? 4 + Math.random() * 3 : 1 + Math.random() * 2

      // Subtle color variation - blue-white spectrum with occasional warm stars
      const temp = Math.random()
      if (temp > 0.98) {
        // Rare warm star
        starColors[i * 3] = 1.0
        starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2
        starColors[i * 3 + 2] = 0.6 + Math.random() * 0.2
      } else if (temp > 0.90) {
        // Cool blue star
        starColors[i * 3] = 0.7 + Math.random() * 0.3
        starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2
        starColors[i * 3 + 2] = 1.0
      } else {
        // Standard white star with slight blue tint
        const brightness = 0.9 + Math.random() * 0.1
        starColors[i * 3] = brightness
        starColors[i * 3 + 1] = brightness
        starColors[i * 3 + 2] = brightness + 0.1
      }
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    starGeometry.setAttribute('size', new THREE.BufferAttribute(starSizes, 1))
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3))

    const starMaterial = new THREE.PointsMaterial({
      size: 2.5,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false
    })

    const starfield = new THREE.Points(starGeometry, starMaterial)
    starfieldRef.current = starfield
    scene.add(starfield)

    // Add nebula-like fog with rich gradient
    scene.fog = new THREE.FogExp2(0x0d1420, 0.0006)

    // Add ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0x1a2f4f, 0.3)
    scene.add(ambientLight)

    // Add directional light from top for dramatic lighting
    const directionalLight = new THREE.DirectionalLight(0x60a5fa, 0.5)
    directionalLight.position.set(0, 500, 0)
    scene.add(directionalLight)

    return () => {
      if (starfieldRef.current) {
        scene.remove(starfieldRef.current)
        starfieldRef.current.geometry.dispose()
        ;(starfieldRef.current.material as THREE.Material).dispose()
      }
      scene.remove(ambientLight)
      scene.remove(directionalLight)
    }
  }, [loading, deviceCapability])

  // Enhanced animation loop with richer effects
  useEffect(() => {
    if (!graphRef.current) return

    let animationFrameId: number

    const animate = () => {
      const graph = graphRef.current
      if (!graph) return

      const scene = graph.scene()
      if (!scene) return

      const time = Date.now() * 0.001

      // Multi-axis starfield rotation for depth
      if (starfieldRef.current) {
        starfieldRef.current.rotation.y = time * 0.015
        starfieldRef.current.rotation.x = Math.sin(time * 0.008) * 0.08
        starfieldRef.current.rotation.z = Math.cos(time * 0.006) * 0.03
      }

      // Animate all node effects with enhanced variations
      scene.traverse((object: any) => {
        if (object.userData.pulseGlow) {
          // Multi-frequency pulsing for organic feel
          const phase = object.userData.pulsePhase + time
          const pulse1 = Math.sin(phase * 1.2) * 0.5 + 0.5
          const pulse2 = Math.sin(phase * 0.8) * 0.3 + 0.7
          const combinedPulse = (pulse1 + pulse2) / 2

          object.userData.pulseGlow.material.opacity = combinedPulse * 0.4
          object.userData.pulseGlow.scale.setScalar(1 + combinedPulse * 0.3)
        }

        // Dual-rotation lens flare for more dynamic effect
        if (object.userData.lensFlare) {
          const flare = object.userData.lensFlare
          flare.rotation.z = time * 0.8
          const pulse = Math.sin(time * 2.5) * 0.25 + 0.75
          flare.material.opacity = pulse * 0.5

          // Subtle scale pulsing
          const scale = 1 + Math.sin(time * 1.5) * 0.1
          flare.scale.setScalar(scale)
        }

        // Rotate project rings for planetary feel
        if (object.userData.orbitRing) {
          const ring = object.userData.orbitRing
          ring.rotation.z = time * 0.3

          // Shimmer effect on ring
          const shimmer = Math.sin(time * 3) * 0.1 + 0.2
          ring.material.opacity = shimmer
        }
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [loading])

  // Time travel animation
  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setTimeTravel(prev => {
        if (prev >= 100) {
          setIsPlaying(false)
          return 100
        }
        return prev + 1
      })
    }, 100) // 10 seconds total

    return () => clearInterval(interval)
  }, [isPlaying])

  // Filter data based on time travel slider and search query
  const getFilteredData = useCallback(() => {
    const allNodes = [...graphData.nodes].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    // Time travel filter
    const cutoffIndex = Math.floor((timeTravel / 100) * allNodes.length)
    let visibleNodes = allNodes.slice(0, cutoffIndex)

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      visibleNodes = visibleNodes.filter(node =>
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query)
      )
    }

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id))

    const visibleLinks = graphData.links.filter(link =>
      visibleNodeIds.has(link.source as string) && visibleNodeIds.has(link.target as string)
    )

    // Apply type filter if active
    let filteredNodes = visibleNodes
    if (filter) {
      filteredNodes = visibleNodes.map(node => ({
        ...node,
        color: node.type === filter ? NODE_THEMES[node.type].color : '#333333',
        val: node.type === filter ? node.val : node.val * 0.3
      }))
    }

    return { nodes: filteredNodes, links: visibleLinks }
  }, [graphData, timeTravel, filter, searchQuery])

  // Custom node rendering with enhanced effects
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const theme = NODE_THEMES[node.type]

    // Calculate recency for pulsing effect
    const nodeAge = Date.now() - new Date(node.created_at).getTime()
    const daysSinceCreation = nodeAge / (1000 * 60 * 60 * 24)
    const isRecent = daysSinceCreation < 7

    // Main sphere with enhanced emissive material
    const geometry = new THREE.SphereGeometry(node.val / 2, 24, 24)
    const material = new THREE.MeshStandardMaterial({
      color: node.color,
      emissive: theme.emissive,
      emissiveIntensity: isRecent ? 0.8 : 0.5,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: isRecent ? 1.0 : 0.85
    })
    const mesh = new THREE.Mesh(geometry, material)

    // Add point light for self-illumination
    const light = new THREE.PointLight(theme.color, isRecent ? 2 : 1, node.val * 5)
    mesh.add(light)

    // Multi-layer glow for depth
    // Inner glow (bright)
    const innerGlowGeometry = new THREE.SphereGeometry(node.val / 2 * 1.3, 16, 16)
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
      color: theme.glow,
      transparent: true,
      opacity: isRecent ? 0.5 : 0.3,
      side: THREE.BackSide
    })
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial)
    mesh.add(innerGlow)

    // Outer glow (soft)
    const outerGlowGeometry = new THREE.SphereGeometry(node.val / 2 * 1.8, 16, 16)
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: theme.glow,
      transparent: true,
      opacity: isRecent ? 0.2 : 0.1,
      side: THREE.BackSide
    })
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial)
    mesh.add(outerGlow)

    // Pulsing animation for recent nodes
    if (isRecent) {
      const pulseGlowGeometry = new THREE.SphereGeometry(node.val / 2 * 2.2, 16, 16)
      const pulseGlowMaterial = new THREE.MeshBasicMaterial({
        color: theme.glow,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide
      })
      const pulseGlow = new THREE.Mesh(pulseGlowGeometry, pulseGlowMaterial)
      mesh.add(pulseGlow)

      ;(mesh as any).userData.pulseGlow = pulseGlow
      ;(mesh as any).userData.pulsePhase = Math.random() * Math.PI * 2
    }

    // Lens flare for brightest nodes (recent or high connections)
    const connectionCount = node.metadata?.connectionCount || 0
    if (isRecent || connectionCount > 5) {
      const flareGeometry = new THREE.CircleGeometry(node.val * 1.8, 32)
      const flareMaterial = new THREE.MeshBasicMaterial({
        color: theme.glow,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      })
      const flare = new THREE.Mesh(flareGeometry, flareMaterial)
      flare.position.z = 0
      mesh.add(flare)

      ;(mesh as any).userData.lensFlare = flare
    }

    // For projects (planets), add enhanced orbital ring with particles
    if (node.type === 'project') {
      // Main ring
      const ringGeometry = new THREE.TorusGeometry(node.val / 2 * 1.8, 0.6, 8, 48)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: theme.glow,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3 // Slight random tilt
      mesh.add(ring)

      // Store for animation
      ;(mesh as any).userData.orbitRing = ring

      // Add smaller inner ring for depth
      const innerRingGeometry = new THREE.TorusGeometry(node.val / 2 * 1.3, 0.3, 6, 32)
      const innerRingMaterial = new THREE.MeshBasicMaterial({
        color: theme.color,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending
      })
      const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial)
      innerRing.rotation.x = Math.PI / 2
      mesh.add(innerRing)
    }

    // For articles (comets), add trailing effect
    if (node.type === 'article') {
      const tailLength = node.val * 3
      const tailGeometry = new THREE.ConeGeometry(node.val / 4, tailLength, 8)
      const tailMaterial = new THREE.MeshBasicMaterial({
        color: theme.glow,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending
      })
      const tail = new THREE.Mesh(tailGeometry, tailMaterial)
      tail.position.z = -tailLength / 2
      tail.rotation.x = Math.PI / 2
      mesh.add(tail)
    }

    // Connection count badge
    if (connectionCount > 0) {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')!

      // Draw badge background
      ctx.fillStyle = theme.color
      ctx.beginPath()
      ctx.arc(32, 32, 28, 0, Math.PI * 2)
      ctx.fill()

      // Draw text
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 32px Inter'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(connectionCount.toString(), 32, 32)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(node.val * 0.8, node.val * 0.8, 1)
      sprite.position.set(node.val * 0.7, node.val * 0.7, 0)
      mesh.add(sprite)
    }

    return mesh
  }, [])

  // Enhanced link rendering with dynamic energy flows
  const linkColor = useCallback((link: GraphLink) => {
    if (demoMode === 'connections') {
      // Lightning storm effect - dramatic flashing
      const time = Date.now() * 0.005
      const flash = Math.sin(time + Math.random() * 10) > 0.7
      return flash ? '#ffffff' : '#60a5fa'
    }
    // AI suggested = vibrant purple, regular = electric blue
    return link.type === 'ai_suggested' ? '#c084fc' : '#60a5fa'
  }, [demoMode])

  const linkWidth = useCallback((link: GraphLink) => {
    if (demoMode === 'connections') {
      const time = Date.now() * 0.005
      const pulse = Math.sin(time + Math.random() * 10) * 0.6 + 0.4
      return 2 + pulse * 4
    }
    // Thicker, more dramatic links
    return link.type === 'ai_suggested' ? 3.5 : 2.5
  }, [demoMode])

  const linkOpacity = useCallback(() => {
    if (demoMode === 'connections') {
      return 1.0
    }
    // Highly visible connections - the network is the star of the show
    return 0.9
  }, [demoMode])

  // Enhanced particle flows - more particles for richer visual
  const linkDirectionalParticles = useCallback(() => {
    if (demoMode === 'connections') {
      // Extra particles in storm mode
      return deviceCapability === 'low' ? 3 : deviceCapability === 'medium' ? 5 : 8
    }
    return deviceCapability === 'low' ? 2 : deviceCapability === 'medium' ? 3 : 6
  }, [deviceCapability, demoMode])

  const linkDirectionalParticleSpeed = useCallback(() => {
    if (demoMode === 'connections') {
      return 0.012 // Faster in storm mode
    }
    return 0.008 // Slightly faster than before for more dynamic feel
  }, [demoMode])

  const linkDirectionalParticleWidth = useCallback(() => {
    return demoMode === 'connections' ? 3 : 2.5
  }, [demoMode])

  // Custom clustering forces - make similar nodes attract
  const customForces = useCallback(() => {
    return {
      // Type clustering - nodes of same type attract
      cluster: d3.forceManyBody()
        .strength((node: any) => {
          // Same type nodes attract, different types repel slightly
          return -30 // Base repulsion for all
        })
        .distanceMax(200),

      // Category clustering - stronger attraction for same type
      typeCluster: (alpha: number) => {
        const nodes = graphRef.current?.graphData()?.nodes
        if (!nodes) return

        for (let i = 0; i < nodes.length; i++) {
          const nodeA = nodes[i] as any
          if (!nodeA.x || !nodeA.y || !nodeA.z) continue

          for (let j = i + 1; j < nodes.length; j++) {
            const nodeB = nodes[j] as any
            if (!nodeB.x || !nodeB.y || !nodeB.z) continue

            // Calculate distance
            const dx = nodeB.x - nodeA.x
            const dy = nodeB.y - nodeA.y
            const dz = nodeB.z - nodeA.z
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1

            // Same type = attraction, different = no force
            if (nodeA.type === nodeB.type) {
              const strength = alpha * 2 // Gentle attraction
              const force = strength / distance

              nodeA.vx! -= dx * force
              nodeA.vy! -= dy * force
              nodeA.vz! -= dz * force
              nodeB.vx! += dx * force
              nodeB.vy! += dy * force
              nodeB.vz! += dz * force
            }
          }
        }
      }
    }
  }, [])

  // Configure graph forces
  const configureForces = useCallback(() => {
    const fg = graphRef.current
    if (!fg) return

    // KEEP THE SIMULATION RUNNING (continuous movement)
    fg.d3AlphaDecay(0.001) // Very slow decay = keeps moving
    fg.d3VelocityDecay(0.2) // Smooth momentum

    fg.d3Force('charge')
      .strength(-180) // Much stronger repulsion to reduce crowding
      .distanceMax(400) // Larger max distance for better spread

    fg.d3Force('link')
      .distance(120) // Increased distance for more breathing room
      .strength(1.2) // Slightly weaker links to allow more spread

    fg.d3Force('center')
      .strength(0.05) // Very weak center pull for organic drift

    // Add custom type clustering force
    fg.d3Force('typeCluster', customForces().typeCluster)

    // Restart simulation to apply forces
    fg.d3ReheatSimulation()
  }, [customForces])

  // Voice commands
  const startVoiceControl = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice control not supported in this browser')
      return
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase()
      console.log('Voice command:', transcript)

      // Process commands
      if (transcript.includes('project')) {
        setFilter('project')
      } else if (transcript.includes('thought') || transcript.includes('memory')) {
        setFilter('thought')
      } else if (transcript.includes('article') || transcript.includes('reading')) {
        setFilter('article')
      } else if (transcript.includes('show all') || transcript.includes('reset')) {
        setFilter(null)
      } else if (transcript.includes('play') || transcript.includes('animate')) {
        setTimeTravel(0)
        setIsPlaying(true)
      } else if (transcript.includes('birth') || transcript.includes('beginning')) {
        setTimeTravel(0)
      }
    }

    recognition.start()
  }

  // Demo mode handlers
  const startBirthDemo = () => {
    setTimeTravel(0)
    setDemoMode('birth')
    setIsPlaying(true)
  }

  const startConnectionStorm = () => {
    setDemoMode('connections')
    // Flash all connections in sequence
    setTimeout(() => setDemoMode('none'), 5000)
  }

  const startThemeDiscovery = () => {
    setDemoMode('themes')
    // Would cluster nodes by similarity
    setTimeout(() => setDemoMode('none'), 8000)
  }

  // Node hover handler - highlight connected nodes
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node)

    if (!node) {
      setHighlightNodes(new Set())
      setHighlightLinks(new Set())
      return
    }

    // Find all connected nodes
    const connectedNodes = new Set<string>([node.id])
    const connectedLinks = new Set<string>()

    graphData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id

      if (sourceId === node.id || targetId === node.id) {
        connectedNodes.add(sourceId)
        connectedNodes.add(targetId)
        connectedLinks.add(`${sourceId}-${targetId}`)
      }
    })

    setHighlightNodes(connectedNodes)
    setHighlightLinks(connectedLinks)
  }, [graphData.links])

  // Update tooltip position on mouse move
  const handleMouseMove = useCallback((event: MouseEvent) => {
    setTooltipPos({ x: event.clientX, y: event.clientY })
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [handleMouseMove])

  // Double-click to focus on node with smooth animation
  const handleNodeDoubleClick = useCallback((node: GraphNode) => {
    const fg = graphRef.current
    if (!fg || !node.x || !node.y || !node.z) return

    // Calculate camera position to look at node
    const distance = 200
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)

    fg.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      2000 // 2 second animation
    )
  }, [])

  // Right-click context menu
  const handleNodeRightClick = useCallback((node: GraphNode, event: MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, node })
  }, [])

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  // Fit to view - reset camera
  const handleFitToView = useCallback(() => {
    const fg = graphRef.current
    if (!fg) return

    fg.zoomToFit(1000) // 1 second animation
  }, [])

  // Take screenshot
  const handleTakeScreenshot = useCallback(() => {
    const fg = graphRef.current
    if (!fg) return

    // Get the canvas element
    const canvas = fg.renderer().domElement
    const dataURL = canvas.toDataURL('image/png')

    // Download image
    const link = document.createElement('a')
    link.download = `constellation-${Date.now()}.png`
    link.href = dataURL
    link.click()
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Space - play/pause time travel
      if (event.code === 'Space') {
        event.preventDefault()
        if (isPlaying) {
          setIsPlaying(false)
        } else {
          if (timeTravel === 100) setTimeTravel(0)
          setIsPlaying(true)
        }
      }
      // R - reset/fit to view
      else if (event.code === 'KeyR') {
        event.preventDefault()
        handleFitToView()
      }
      // F - focus search
      else if (event.code === 'KeyF' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('#constellation-search')
        searchInput?.focus()
      }
      // Escape - clear filters
      else if (event.code === 'Escape') {
        event.preventDefault()
        setSearchQuery('')
        setFilter(null)
        setContextMenu(null)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying, timeTravel, handleFitToView])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: 'linear-gradient(to bottom right, #0d1420, #0f1829, #1a2638)' }}>
        <div className="text-center">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent mb-4" style={{ borderColor: '#3b82f6 transparent #3b82f6 #3b82f6' }}></div>
          <p className="text-lg" style={{ color: '#d1d5db' }}>Mapping your universe...</p>
        </div>
      </div>
    )
  }

  const filteredData = getFilteredData()

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: 'linear-gradient(to bottom right, #0d1420, #0f1829, #1a2638)' }}>
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 p-4"
        style={{ background: 'linear-gradient(to bottom, rgba(13, 20, 32, 0.8), transparent)' }}
      >
        <div className="flex items-center justify-between gap-4 max-w-screen-2xl mx-auto">
          {/* Left: Back Button */}
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all premium-glass-strong"
            style={{ color: '#ffffff' }}
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </button>

          {/* Center: Title + Search */}
          <div className="flex-1 flex items-center gap-4 justify-center">
            <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#ffffff' }}>
              <Sparkles className="h-6 w-6" style={{ color: '#3b82f6' }} />
              Constellation View
            </h1>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5" style={{ color: '#9ca3af' }} />
              <input
                id="constellation-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes... (Cmd+F)"
                className="pl-10 pr-10 py-2 rounded-lg premium-input"
                style={{
                  width: '320px',
                  background: 'rgba(20, 31, 50, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  style={{ color: '#9ca3af' }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex gap-2">
            {/* Fit to View */}
            <button
              onClick={handleFitToView}
              className="p-3 rounded-xl premium-glass transition-all"
              style={{ color: '#ffffff' }}
              title="Fit to View (R)"
            >
              <Maximize2 className="h-5 w-5" />
            </button>

            {/* Take Screenshot */}
            <button
              onClick={handleTakeScreenshot}
              className="p-3 rounded-xl premium-glass transition-all"
              style={{ color: '#ffffff' }}
              title="Take Screenshot"
            >
              <Camera className="h-5 w-5" />
            </button>

            {/* Toggle Legend */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className={`p-3 rounded-xl premium-glass transition-all ${showLegend ? 'ring-2 ring-blue-400' : ''}`}
              style={{ color: '#ffffff' }}
              title="Toggle Legend"
            >
              <Info className="h-5 w-5" />
            </button>

            {/* Demo Modes Dropdown */}
            <div className="relative group">
              <button
                className="p-3 rounded-xl premium-glass transition-all"
                style={{ color: '#ffffff' }}
                title="Demo Modes"
              >
                <Wand2 className="h-5 w-5" />
              </button>

              {/* Dropdown */}
              <div className="absolute top-full right-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="rounded-xl premium-glass-strong overflow-hidden" style={{ border: '1px solid rgba(255, 255, 255, 0.2)' }}>
                  <button
                    onClick={startBirthDemo}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
                    style={{ color: '#ffffff' }}
                  >
                    <Play className="h-4 w-4" />
                    <span className="text-sm">Birth of Universe</span>
                  </button>
                  <button
                    onClick={startConnectionStorm}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
                    style={{ color: '#ffffff' }}
                  >
                    <Zap className="h-4 w-4" />
                    <span className="text-sm">Connection Storm</span>
                  </button>
                  <button
                    onClick={startThemeDiscovery}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
                    style={{ color: '#ffffff' }}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="text-sm">Theme Discovery</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Voice Control */}
            <button
              onClick={startVoiceControl}
              className={`p-3 rounded-xl transition-all ${
                isListening
                  ? 'scale-110'
                  : 'premium-glass'
              }`}
              style={{
                backgroundColor: isListening ? '#ef4444' : undefined,
                color: '#ffffff'
              }}
              title="Voice Control"
            >
              {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 3D Graph */}
      <ForceGraph3D
        ref={graphRef}
        graphData={filteredData}
        nodeLabel={() => ''} // Disable default tooltip
        nodeVal="val"
        nodeColor={(node: any) => {
          // Dim non-highlighted nodes when hovering
          if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) {
            return '#333333'
          }
          return node.color
        }}
        nodeThreeObject={nodeThreeObject}
        linkColor={(link: any) => {
          // Highlight connected links
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id
          const targetId = typeof link.target === 'string' ? link.target : link.target.id
          if (highlightLinks.size > 0 && !highlightLinks.has(`${sourceId}-${targetId}`)) {
            return '#333333'
          }
          return linkColor(link)
        }}
        linkWidth={linkWidth}
        linkOpacity={linkOpacity()}
        linkDirectionalParticles={linkDirectionalParticles()}
        linkDirectionalParticleSpeed={linkDirectionalParticleSpeed()}
        linkDirectionalParticleWidth={linkDirectionalParticleWidth()}
        backgroundColor="#0f1829"
        showNavInfo={false}
        enableNodeDrag={true}
        enableNavigationControls={true}
        onEngineStop={configureForces}
        onNodeHover={handleNodeHover}
        onNodeClick={(node: any) => {
          // Navigate to the item
          if (node.metadata) {
            if (node.type === 'project') {
              navigate(`/projects/${node.metadata.id}`)
            } else if (node.type === 'thought') {
              navigate('/memories')
            } else if (node.type === 'article') {
              navigate('/reading')
            }
          }
        }}
        onNodeRightClick={(node: any, event: any) => handleNodeRightClick(node, event)}
      />

      {/* Tooltip on Hover */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed pointer-events-none z-50 premium-glass-strong rounded-lg p-3 shadow-2xl"
            style={{
              left: tooltipPos.x + 15,
              top: tooltipPos.y + 15,
              maxWidth: '300px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{NODE_THEMES[hoveredNode.type].icon}</span>
              <h3 className="font-semibold text-white">{hoveredNode.name}</h3>
            </div>
            <div className="text-sm space-y-1" style={{ color: '#d1d5db' }}>
              <div className="flex justify-between">
                <span style={{ color: '#9ca3af' }}>Type:</span>
                <span>{NODE_THEMES[hoveredNode.type].label}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#9ca3af' }}>Connections:</span>
                <span>{hoveredNode.metadata?.connectionCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: '#9ca3af' }}>Created:</span>
                <span>{new Date(hoveredNode.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/10 text-xs" style={{ color: '#9ca3af' }}>
              Click to open • Double-click to focus • Right-click for options
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 premium-glass-strong rounded-lg overflow-hidden shadow-2xl"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              minWidth: '180px'
            }}
          >
            <button
              onClick={() => {
                if (contextMenu.node.metadata) {
                  const node = contextMenu.node
                  if (node.type === 'project') navigate(`/projects/${node.metadata.id}`)
                  else if (node.type === 'thought') navigate('/memories')
                  else if (node.type === 'article') navigate('/reading')
                }
                setContextMenu(null)
              }}
              className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
              style={{ color: '#ffffff' }}
            >
              <Eye className="h-4 w-4" />
              <span>View</span>
            </button>
            <button
              onClick={() => {
                handleNodeDoubleClick(contextMenu.node)
                setContextMenu(null)
              }}
              className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-2"
              style={{ color: '#ffffff' }}
            >
              <Target className="h-4 w-4" />
              <span>Focus</span>
            </button>
            <div className="border-t border-white/10" />
            <div className="px-4 py-2 text-xs" style={{ color: '#9ca3af' }}>
              {contextMenu.node.name}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed top-24 right-4 z-20 premium-glass-strong rounded-xl p-4 shadow-2xl"
            style={{
              border: '1px solid rgba(255, 255, 255, 0.2)',
              maxWidth: '250px'
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: '#ffffff' }}>
                <Info className="h-4 w-4" />
                Legend
              </h3>
              <button
                onClick={() => setShowLegend(false)}
                style={{ color: '#9ca3af' }}
                className="hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(NODE_THEMES).map(([type, theme]) => (
                <div key={type} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: theme.color,
                      boxShadow: `0 0 20px ${theme.glow}`
                    }}
                  >
                    <span className="text-sm">{theme.icon}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium" style={{ color: '#ffffff' }}>
                      {theme.label}s
                    </div>
                    <div className="text-xs" style={{ color: '#9ca3af' }}>
                      {filteredData.nodes.filter(n => n.type === type).length} nodes
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 text-xs space-y-1" style={{ color: '#9ca3af' }}>
              <div><kbd className="px-1 py-0.5 rounded bg-white/10">Space</kbd> Play/Pause</div>
              <div><kbd className="px-1 py-0.5 rounded bg-white/10">R</kbd> Reset View</div>
              <div><kbd className="px-1 py-0.5 rounded bg-white/10">⌘F</kbd> Search</div>
              <div><kbd className="px-1 py-0.5 rounded bg-white/10">Esc</kbd> Clear Filter</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini-map */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed bottom-24 right-4 z-20 premium-glass-strong rounded-xl p-3 shadow-2xl"
        style={{
          border: '1px solid rgba(255, 255, 255, 0.2)',
          width: '200px',
          height: '150px'
        }}
      >
        <div className="text-xs font-semibold mb-2" style={{ color: '#d1d5db' }}>
          Overview
        </div>
        <div className="relative w-full h-full bg-black/30 rounded-lg overflow-hidden">
          {/* Simplified 2D representation */}
          <svg width="100%" height="100%" viewBox="-100 -100 200 200">
            {filteredData.nodes.map((node, i) => {
              // Simple circular layout for mini-map
              const angle = (i / filteredData.nodes.length) * Math.PI * 2
              const radius = 60
              const x = Math.cos(angle) * radius
              const y = Math.sin(angle) * radius
              return (
                <circle
                  key={node.id}
                  cx={x}
                  cy={y}
                  r={node.val / 3}
                  fill={node.color}
                  opacity={highlightNodes.size === 0 || highlightNodes.has(node.id) ? 0.8 : 0.3}
                />
              )
            })}
          </svg>
        </div>
      </motion.div>

      {/* Time Travel Controls */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="absolute bottom-0 left-0 right-0 z-10 p-6"
        style={{ background: 'linear-gradient(to top, rgba(13, 20, 32, 0.9), transparent)' }}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Filter Pills */}
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => setFilter(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === null
                  ? 'premium-btn-primary'
                  : 'premium-glass'
              }`}
              style={{
                color: '#ffffff',
                background: filter === null ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : undefined
              }}
            >
              All
            </button>
            {Object.entries(NODE_THEMES).map(([type, theme]) => (
              <button
                key={type}
                onClick={() => setFilter(filter === type ? null : type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  filter === type ? '' : 'premium-glass'
                }`}
                style={{
                  backgroundColor: filter === type ? theme.color : undefined,
                  color: '#ffffff',
                  boxShadow: filter === type ? `0 0 20px ${theme.glow}` : undefined
                }}
              >
                <span>{theme.icon}</span>
                <span>{theme.label}s</span>
              </button>
            ))}
          </div>

          {/* Time Travel Slider */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false)
                } else {
                  if (timeTravel === 100) setTimeTravel(0)
                  setIsPlaying(true)
                }
              }}
              className="p-3 rounded-xl transition-all"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#ffffff',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
              }}
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max="100"
                value={timeTravel}
                onChange={(e) => setTimeTravel(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${timeTravel}%, rgba(255,255,255,0.2) ${timeTravel}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div className="flex justify-between mt-2 text-xs" style={{ color: '#d1d5db' }}>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Day 1
                </span>
                <span className="font-medium" style={{ color: '#ffffff' }}>
                  {Math.round((timeTravel / 100) * filteredData.nodes.length)} / {graphData.nodes.length} nodes
                </span>
                <span>Today</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 justify-center text-sm">
            <div className="text-center premium-stat-card">
              <div className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                {filteredData.nodes.filter(n => n.type === 'project').length}
              </div>
              <div className="text-xs mt-1" style={{ color: '#d1d5db' }}>
                {NODE_THEMES.project.icon} Planets
              </div>
            </div>
            <div className="text-center premium-stat-card">
              <div className="text-2xl font-bold" style={{ color: '#6366f1' }}>
                {filteredData.nodes.filter(n => n.type === 'thought').length}
              </div>
              <div className="text-xs mt-1" style={{ color: '#d1d5db' }}>
                {NODE_THEMES.thought.icon} Stars
              </div>
            </div>
            <div className="text-center premium-stat-card">
              <div className="text-2xl font-bold" style={{ color: '#10b981' }}>
                {filteredData.nodes.filter(n => n.type === 'article').length}
              </div>
              <div className="text-xs mt-1" style={{ color: '#d1d5db' }}>
                {NODE_THEMES.article.icon} Comets
              </div>
            </div>
            <div className="text-center premium-stat-card">
              <div className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                {filteredData.links.length}
              </div>
              <div className="text-xs mt-1" style={{ color: '#d1d5db' }}>
                ⚡ Connections
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Voice Listening Indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
          >
            <div className="bg-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <Mic className="h-6 w-6 animate-pulse" />
              <span className="text-lg font-medium">Listening...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
