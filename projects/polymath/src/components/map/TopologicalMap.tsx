import React, { useEffect, useRef, useState, useCallback } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d'
import { api } from '../../lib/apiClient'
import { Loader2, ZoomIn, ZoomOut, Focus, X, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface GraphNode extends NodeObject {
  id: string
  title?: string
  body?: string
  type: 'project' | 'thought' | 'article'
  val: number
  color: string
  // For hover interactions
  neighbors?: GraphNode[]
  links?: GraphLink[]
}

interface GraphLink extends LinkObject {
  source: string | GraphNode
  target: string | GraphNode
  type?: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export function TopologicalMap() {
  const fgRef = useRef<ForceGraphMethods>()
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Fetch everything in parallel
        const [projectsRes, memoriesRes, connectionsRes] = await Promise.all([
          api.get('projects'),
          api.get('memories'),
          api.get('connections?action=list-all')
        ])

        const projects = projectsRes.projects || []
        const memories = memoriesRes.memories || []
        const connections = connectionsRes.connections || []

        const nodesMap = new Map<string, GraphNode>()

        // 1. Add Projects
        projects.forEach((p: any) => {
          nodesMap.set(String(p.id), {
            id: String(p.id),
            title: p.title,
            body: p.description, // Projects usually have description
            type: 'project',
            val: 30, // Larger influence for projects
            color: '#0ea5e9', // Sky 500
            neighbors: [],
            links: []
          })
        })

        // 2. Add Memories (Thoughts)
        memories.forEach((m: any) => {
          nodesMap.set(String(m.id), {
            id: String(m.id),
            title: m.title || 'Untitled Thought',
            body: m.body,
            type: 'thought',
            val: 15, // Medium influence
            color: '#a855f7', // Purple 500
            neighbors: [],
            links: []
          })
        })

        // 3. Process Links
        const links: GraphLink[] = []
        connections.forEach((conn: any) => {
          const sourceId = String(conn.source_id)
          const targetId = String(conn.target_id)

          if (nodesMap.has(sourceId) && nodesMap.has(targetId)) {
            links.push({
              source: sourceId,
              target: targetId,
              type: conn.connection_type
            })

            // Populate neighbors (for hover effects)
            const sourceNode = nodesMap.get(sourceId)!
            const targetNode = nodesMap.get(targetId)!

            sourceNode.neighbors?.push(targetNode)
            targetNode.neighbors?.push(sourceNode)
          }
        })

        setData({
          nodes: Array.from(nodesMap.values()),
          links
        })

      } catch (error) {
        console.error('Failed to load map data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Responsiveness
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        })
      }
    }
    window.addEventListener('resize', updateDimensions)
    updateDimensions()
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Painting Logic
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Safety check for crash prevention
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return

    const isHover = node === hoverNode
    const isSelected = node === selectedNode
    const isNeighbor = hoverNode && (hoverNode as any).neighbors?.includes(node)

    // Determine opacity/visibility based on interaction
    let alpha = 0.8
    if (hoverNode && !isHover && !isNeighbor && !isSelected) {
      alpha = 0.2 // Dim unrelated nodes
    }

    const label = node.title || node.body?.slice(0, 15) || '...'
    // Scale font size constraints
    const fontSize = Math.max(3, 12 / globalScale)

    // 1. Draw "Heatmap" Glow (The Territory)
    // We use a large radial gradient to simulate a heatmap surface
    // Using 'screen' or 'lighter' blend mode makes overlapping areas brighter/hotter
    ctx.globalCompositeOperation = 'screen'

    const glowRadius = node.val * (isHover ? 1.5 : 1)

    try {
      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowRadius)
      // Node color with low opacity
      gradient.addColorStop(0, `${node.color}40`) // ~25% opacity
      gradient.addColorStop(1, 'transparent')

      ctx.beginPath()
      ctx.arc(node.x, node.y, glowRadius, 0, 2 * Math.PI, false)
      ctx.fillStyle = gradient
      ctx.fill()
    } catch (e) {
      // Gracefully fail if gradient creation somehow fails (though we checked finite)
    }

    // Reset composite operation for solid drawing
    ctx.globalCompositeOperation = 'source-over'

    // 2. Draw the visible Core Node
    const coreRadius = isHover || isSelected ? 6 : 4
    ctx.beginPath()
    ctx.arc(node.x, node.y, coreRadius, 0, 2 * Math.PI, false)
    ctx.fillStyle = isSelected ? '#fff' : node.color
    ctx.globalAlpha = alpha
    ctx.fill()

    // Ring for selected
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, coreRadius + 2, 0, 2 * Math.PI, false)
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // 3. Label
    // Show label if:
    // - Zoom level is high enough
    // - Node is hovered or selected
    // - Node is a Project (high importance)
    if (globalScale > 2 || isHover || isSelected || node.type === 'project') {
      ctx.font = `${node.type === 'project' ? '600' : '400'} ${fontSize}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.fillText(label, node.x, node.y + (coreRadius + fontSize))
    }
  }, [hoverNode, selectedNode])

  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Highlight links connected to hover/selected node
    const isConnected =
      (hoverNode && (link.source.id === hoverNode.id || link.target.id === hoverNode.id)) ||
      (selectedNode && (link.source.id === selectedNode.id || link.target.id === selectedNode.id))

    const strokeColor = isConnected ? '#ffffff' : '#ffffff'
    const strokeAlpha = isConnected ? 0.3 : 0.05
    const lineWidth = isConnected ? 1.5 : 0.5 / globalScale

    ctx.beginPath()
    ctx.moveTo(link.source.x, link.source.y)
    ctx.lineTo(link.target.x, link.target.y)
    ctx.strokeStyle = strokeColor
    ctx.globalAlpha = strokeAlpha
    ctx.lineWidth = lineWidth
    ctx.stroke()
    ctx.globalAlpha = 1 // Reset
  }, [hoverNode, selectedNode])

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[600px] rounded-xl overflow-hidden bg-[#050505] border border-white/10 group">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#050505]/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="text-sm text-gray-400">Mapping Neural Pathways...</span>
          </div>
        </div>
      )}

      {!loading && (
        <>
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
            nodeLabel={() => ''} // We draw our own labels
            nodeCanvasObject={paintNode}
            linkCanvasObject={paintLink}
            d3AlphaDecay={0.01} // Slower physics for "floating" feel
            d3VelocityDecay={0.4}
            cooldownTicks={100}
            onNodeClick={(node) => {
              setSelectedNode(node as GraphNode)
              fgRef.current?.centerAt(node.x, node.y, 1000)
              fgRef.current?.zoom(4, 1000)
            }}
            onNodeHover={(node) => setHoverNode(node as GraphNode || null)}
            onBackgroundClick={() => setSelectedNode(null)}
          />

          {/* Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => {
                const currentZoom = fgRef.current?.zoom() || 1
                fgRef.current?.zoom(currentZoom * 1.5, 400)
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors backdrop-blur-md"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const currentZoom = fgRef.current?.zoom() || 1
                fgRef.current?.zoom(currentZoom / 1.5, 400)
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors backdrop-blur-md"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => fgRef.current?.zoomToFit(400)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-colors backdrop-blur-md"
            >
              <Focus className="h-5 w-5" />
            </button>
          </div>

          {/* Details Panel */}
          {selectedNode && (
            <div className="absolute top-4 right-4 w-80 bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl animate-in slide-in-from-right-10 fade-in duration-300">
              <div className="flex items-start justify-between mb-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider
                  ${selectedNode.type === 'project' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}
                `}>
                  {selectedNode.type}
                </span>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="text-lg font-bold text-white mb-2 leading-tight">
                {selectedNode.title || 'Untitled'}
              </h3>

              <div className="text-sm text-gray-400 line-clamp-4 leading-relaxed mb-4">
                {selectedNode.body || 'No content provided.'}
              </div>

              <button
                onClick={() => {
                  if (selectedNode.type === 'project') navigate(`/projects/${selectedNode.id}`)
                  // TODO: Handle memory navigation
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium text-white transition-all group"
              >
                <span>View Full Details</span>
                <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
