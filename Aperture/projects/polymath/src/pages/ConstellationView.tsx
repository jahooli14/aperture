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

import { useEffect, useState, useCallback, useRef } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Play, Pause, Mic, MicOff, Sparkles, Calendar, Zap, Wand2, Eye, Target } from 'lucide-react'
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

// Visual themes for each node type
const NODE_THEMES = {
  project: {
    color: '#3b82f6', // Blue
    glow: '#60a5fa',
    size: 15,
    label: 'Planet'
  },
  thought: {
    color: '#6366f1', // Indigo
    glow: '#818cf8',
    size: 8,
    label: 'Star'
  },
  article: {
    color: '#10b981', // Green
    glow: '#34d399',
    size: 10,
    label: 'Comet'
  },
  suggestion: {
    color: '#f59e0b', // Amber
    glow: '#fbbf24',
    size: 6,
    label: 'Spark'
  }
}

export default function ConstellationView() {
  const navigate = useNavigate()
  const graphRef = useRef<any>()

  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [timeTravel, setTimeTravel] = useState(100) // 0-100% of timeline
  const [isPlaying, setIsPlaying] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [demoMode, setDemoMode] = useState<'none' | 'birth' | 'themes' | 'connections'>('none')
  const [filter, setFilter] = useState<string | null>(null)

  // Fetch all data
  useEffect(() => {
    fetchGraphData()
  }, [])

  // Animation loop for node effects
  useEffect(() => {
    if (!graphRef.current) return

    let animationFrameId: number

    const animate = () => {
      const graph = graphRef.current
      if (!graph) return

      const scene = graph.scene()
      if (!scene) return

      const time = Date.now() * 0.001

      // Animate all node effects
      scene.traverse((object: any) => {
        if (object.userData.pulseGlow) {
          // Pulsing glow for recent nodes
          const phase = object.userData.pulsePhase + time
          const pulse = Math.sin(phase) * 0.5 + 0.5
          object.userData.pulseGlow.material.opacity = pulse * 0.3
          object.userData.pulseGlow.scale.setScalar(1 + pulse * 0.2)
        }

        // Removed comet trails - they looked cheap
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

  const fetchGraphData = async () => {
    setLoading(true)
    try {
      // Fetch all content types in parallel
      const [projectsRes, memoriesRes, articlesRes, connectionsRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/memories'),
        fetch('/api/reading'),
        fetch('/api/related?connections=true&ai_suggested=false&limit=1000')
      ])

      const projects = await projectsRes.json()
      const memories = await memoriesRes.json()
      const articles = await articlesRes.json()
      const connectionsData = await connectionsRes.json()

      // Build nodes
      const nodes: GraphNode[] = []

      // Add projects (Planets)
      projects.projects?.forEach((p: any) => {
        nodes.push({
          id: `project-${p.id}`,
          type: 'project',
          name: p.title,
          val: NODE_THEMES.project.size,
          color: NODE_THEMES.project.color,
          created_at: p.created_at,
          metadata: p
        })
      })

      // Add memories (Stars)
      memories.memories?.forEach((m: any) => {
        nodes.push({
          id: `thought-${m.id}`,
          type: 'thought',
          name: m.title || 'Untitled thought',
          val: NODE_THEMES.thought.size,
          color: NODE_THEMES.thought.color,
          created_at: m.created_at,
          metadata: m
        })
      })

      // Add articles (Comets)
      articles.articles?.forEach((a: any) => {
        nodes.push({
          id: `article-${a.id}`,
          type: 'article',
          name: a.title,
          val: NODE_THEMES.article.size,
          color: NODE_THEMES.article.color,
          created_at: a.created_at,
          metadata: a
        })
      })

      // Build links from connections
      const links: GraphLink[] = []
      connectionsData.connections?.forEach((c: any) => {
        links.push({
          source: `${c.source_type}-${c.source_id}`,
          target: `${c.target_type}-${c.target_id}`,
          type: c.connection_type,
          created_at: c.created_at
        })
      })

      setGraphData({ nodes, links })
    } catch (error) {
      console.error('Error fetching graph data:', error)
    } finally {
      setLoading(false)
    }
  }

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

  // Filter data based on time travel slider
  const getFilteredData = useCallback(() => {
    if (timeTravel === 100 && !filter) {
      return graphData
    }

    const allNodes = [...graphData.nodes].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const cutoffIndex = Math.floor((timeTravel / 100) * allNodes.length)
    const visibleNodes = allNodes.slice(0, cutoffIndex)
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
  }, [graphData, timeTravel, filter])

  // Custom node rendering with enhanced effects
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const theme = NODE_THEMES[node.type]

    // Calculate recency for pulsing effect
    const nodeAge = Date.now() - new Date(node.created_at).getTime()
    const daysSinceCreation = nodeAge / (1000 * 60 * 60 * 24)
    const isRecent = daysSinceCreation < 7

    // Main sphere with enhanced material
    const geometry = new THREE.SphereGeometry(node.val / 2, 24, 24)
    const material = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: isRecent ? 1.0 : 0.85
    })
    const mesh = new THREE.Mesh(geometry, material)

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

      // Animate pulse (will be handled by animation loop if we add one)
      ;(mesh as any).userData.pulseGlow = pulseGlow
      ;(mesh as any).userData.pulsePhase = Math.random() * Math.PI * 2
    }

    // For projects (planets), add orbital ring
    if (node.type === 'project') {
      const ringGeometry = new THREE.TorusGeometry(node.val / 2 * 1.5, 0.5, 8, 32)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: theme.glow,
        transparent: true,
        opacity: 0.2
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      mesh.add(ring)
    }

    return mesh
  }, [])

  // Custom link rendering (beautiful glowing connections)
  const linkColor = useCallback((link: GraphLink) => {
    if (demoMode === 'connections') {
      // Flash connections in storm mode
      const time = Date.now() * 0.003
      const flash = Math.sin(time + Math.random() * 10) > 0.5
      return flash ? '#60a5fa' : '#3b82f6'
    }
    // AI suggested = purple glow, regular = blue glow
    return link.type === 'ai_suggested' ? '#a78bfa' : '#60a5fa'
  }, [demoMode])

  const linkWidth = useCallback((link: GraphLink) => {
    if (demoMode === 'connections') {
      const time = Date.now() * 0.003
      const pulse = Math.sin(time + Math.random() * 10) * 0.5 + 0.5
      return 1.5 + pulse * 3
    }
    // Thicker, more visible links
    return link.type === 'ai_suggested' ? 3 : 2
  }, [demoMode])

  const linkOpacity = useCallback(() => {
    if (demoMode === 'connections') {
      return 1.0
    }
    // More visible - was 0.6, now 0.8
    return 0.8
  }, [demoMode])

  // Add glow to links
  const linkDirectionalParticles = useCallback(() => 4, []) // Particles flowing along links

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
      .strength(-120) // Stronger repulsion for spacing
      .distanceMax(300)

    fg.d3Force('link')
      .distance(80) // Connected nodes stay closer
      .strength(1.5) // Stronger links

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        <div className="text-center">
          <div className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-blue-400 border-r-transparent mb-4"></div>
          <p className="text-blue-200 text-lg">Mapping your universe...</p>
        </div>
      </div>
    )
  }

  const filteredData = getFilteredData()

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent backdrop-blur-sm"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-400" />
          Constellation View
        </h1>

        <div className="flex gap-2">
          {/* Demo Modes Dropdown */}
          <div className="relative group">
            <button
              className="p-3 rounded-xl bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-colors"
            >
              <Wand2 className="h-5 w-5" />
            </button>

            {/* Dropdown */}
            <div className="absolute top-full right-0 mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <div className="rounded-xl backdrop-blur-xl bg-black/80 border border-white/20 shadow-2xl overflow-hidden">
                <button
                  onClick={startBirthDemo}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  <span className="text-sm">Birth of Universe</span>
                </button>
                <button
                  onClick={startConnectionStorm}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  <span className="text-sm">Connection Storm</span>
                </button>
                <button
                  onClick={startThemeDiscovery}
                  className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">Theme Discovery</span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={startVoiceControl}
            className={`p-3 rounded-xl backdrop-blur-md transition-all ${
              isListening
                ? 'bg-red-500 text-white scale-110'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>
        </div>
      </motion.div>

      {/* 3D Graph */}
      <ForceGraph3D
        ref={graphRef}
        graphData={filteredData}
        nodeLabel="name"
        nodeVal="val"
        nodeColor="color"
        nodeThreeObject={nodeThreeObject}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={linkOpacity()}
        linkDirectionalParticles={linkDirectionalParticles()}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={2}
        backgroundColor="#0f1829"
        showNavInfo={false}
        enableNodeDrag={true}
        enableNavigationControls={true}
        onEngineStop={configureForces}
        onNodeClick={(node: any) => {
          // Navigate to the item
          // Use metadata which has the full object with correct ID
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
      />

      {/* Time Travel Controls */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-black/70 to-transparent backdrop-blur-sm"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Filter Pills */}
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => setFilter(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === null
                  ? 'bg-white text-slate-900'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              All
            </button>
            {Object.entries(NODE_THEMES).map(([type, theme]) => (
              <button
                key={type}
                onClick={() => setFilter(filter === type ? null : type)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  filter === type
                    ? 'text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                style={{
                  backgroundColor: filter === type ? theme.color : undefined
                }}
              >
                {theme.label}s
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
              className="p-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white transition-colors"
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
                className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${timeTravel}%, rgba(255,255,255,0.2) ${timeTravel}%, rgba(255,255,255,0.2) 100%)`
                }}
              />
              <div className="flex justify-between mt-2 text-xs text-blue-200">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Day 1
                </span>
                <span className="text-white font-medium">
                  {Math.round((timeTravel / 100) * filteredData.nodes.length)} / {graphData.nodes.length} nodes
                </span>
                <span>Today</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 justify-center text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {filteredData.nodes.filter(n => n.type === 'project').length}
              </div>
              <div className="text-blue-200">Planets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-400">
                {filteredData.nodes.filter(n => n.type === 'thought').length}
              </div>
              <div className="text-indigo-200">Stars</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {filteredData.nodes.filter(n => n.type === 'article').length}
              </div>
              <div className="text-green-200">Comets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-400">
                {filteredData.links.length}
              </div>
              <div className="text-amber-200">Connections</div>
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
