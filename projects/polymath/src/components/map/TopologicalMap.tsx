import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import ForceGraph2D, { type ForceGraphMethods, type NodeObject, type LinkObject } from 'react-force-graph-2d'
import { api } from '../../lib/apiClient'
import { Loader2, ZoomIn, ZoomOut, Focus, X, ExternalLink } from 'lucide-react'
// import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'

interface GraphNode extends NodeObject {
  id: string
  title?: string
  body?: string
  type: 'project' | 'thought' | 'article'
  val: number
  color: string
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
  // const navigate = useNavigate()

  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [projectsRes, memoriesRes, connectionsRes] = await Promise.all([
          api.get('projects'),
          api.get('memories'),
          api.get('connections?action=list-all')
        ])

        const projects = projectsRes.projects || []
        const memories = memoriesRes.memories || []
        const connections = connectionsRes.connections || []

        const nodesMap = new Map<string, GraphNode>()

        projects.forEach((p: any) => {
          nodesMap.set(String(p.id), {
            id: String(p.id),
            title: p.title,
            body: p.description,
            type: 'project',
            val: 5,
            color: '#0ea5e9'
          })
        })

        memories.forEach((m: any) => {
          nodesMap.set(String(m.id), {
            id: String(m.id),
            title: m.title || 'Untitled Thought',
            body: m.body,
            type: 'thought',
            val: 3,
            color: '#a855f7'
          })
        })

        const links: GraphLink[] = []
        connections.forEach((conn: any) => {
          const sourceId = String(conn.source_id)
          const targetId = String(conn.target_id)
          if (nodesMap.has(sourceId) && nodesMap.has(targetId)) {
            links.push({ source: sourceId, target: targetId })
          }
        })

        setData({ nodes: Array.from(nodesMap.values()), links })
      } catch (error) {
        console.error('Failed to load map data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

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

  // ---------------------------------------------------------------------------
  // Heatmap / Contour Rendering
  // ---------------------------------------------------------------------------

  // Custom Color Scale for "Knowledge Terrain"
  // Deep Blue (Space) -> Purple (Nebula) -> Cyan (Hot) -> White (Core)
  const colorScale = useMemo(() => d3.scaleSequential()
    .domain([0, 0.04]) // Smoothed density values are small
    .interpolator(d3.interpolateMagma), [])

  const paintHeatmap = useCallback((ctx: CanvasRenderingContext2D, globalScale: number) => {
    const nodes = data.nodes
    if (!nodes.length) return

    // Density Calculation Parameters
    // We compute density on a fixed virtual grid regardless of viewport zoom
    // This ensures consistency. We map node simulation coordinates to this grid.
    const densityWidth = 2000
    const densityHeight = 2000
    // Simulation coordinates are roughly -500 to 500 naturally, but can expand.
    // We need to shift them to positive integers for d3.contourDensity
    const offset = 1000

    // Compute Contours only if needed? 
    // Ideally we'd memoize this if nodes don't move, but they DO move.
    // So we run this presumably every frame or throttled?
    // Doing it every frame is expensive. 
    // Check globalScale to maybe skip detail when zoomed out? No, heatmap IS the detail.

    // Performance Optimization: limit polygon resolution
    const contourGenerator = d3.contourDensity()
      .x((d: any) => d.x + offset)
      .y((d: any) => d.y + offset)
      .size([densityWidth, densityHeight])
      .bandwidth(30) // Smoothness (higher = smoother blobs)
      .thresholds(25) // Number of layers
      .cellSize(8) // Lower resolution grid (default is 4) for speed

    const contours = contourGenerator(nodes as any)

    // Draw Contours
    ctx.save()
    // The density map was computed in 0..2000 space
    // We must shift back to simulation space (-1000..1000)
    ctx.translate(-offset, -offset)

    // Optional: Add a "glow" effect
    // ctx.globalCompositeOperation = 'lighter'

    for (const contour of contours) {
      if (!contour.coordinates.length) continue

      ctx.beginPath()
      const geoPath = d3.geoPath(null, ctx)
      geoPath(contour)

      ctx.fillStyle = colorScale(contour.value)
      // Slight opacity to see overlapping layers
      ctx.globalAlpha = 0.8
      ctx.fill()
    }

    ctx.restore()
  }, [data, colorScale])

  // Minimized Node Rendering
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isHover = node === hoverNode

    // Completely hide nodes unless hovered, or heavily zoomed in
    if (!isHover && globalScale < 2.5) return

    // Even when visible, show as tiny data points ("Stars")
    const radius = isHover ? 4 : 1

    ctx.beginPath()
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
    ctx.fillStyle = isHover ? '#fff' : 'rgba(255, 255, 255, 0.5)'
    ctx.fill()

    // Labels appear only on hover or high zoom for significant items
    if (isHover || (globalScale > 3 && node.type === 'project')) {
      ctx.font = `${isHover ? 'bold' : ''} ${10 / globalScale}px Inter, sans-serif`
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const offsetY = isHover ? -8 : -4
      ctx.fillText(node.title || 'Untitled', node.x, node.y + offsetY)
    }
  }, [hoverNode])

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[600px] rounded-xl overflow-hidden bg-[#020204] border border-white/10 group">

      {/* Legend / HUD */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none select-none">
        <div className="flex flex-col gap-1 bg-black/20 backdrop-blur-sm p-2 rounded-lg border border-white/5">
          <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase">Knowledge Density</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30">Low</span>
            <div className="w-24 h-1.5 rounded-full bg-gradient-to-r from-[#000004] via-[#721F81] to-[#FCFDBF]" />
            <span className="text-[10px] text-white/30">High</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#020204]">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            <span className="text-xs text-purple-500/50 font-mono tracking-wide">GENERATING TOPOGRAPHY...</span>
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
            nodeLabel={() => ''}

            // The magic happens here: Paint density layers BEHIND nodes
            onRenderFramePre={paintHeatmap}

            // Minimalist nodes/links
            nodeCanvasObject={paintNode}
            linkColor={() => 'rgba(0,0,0,0)'} // Hide links by default

            // Physics settings for clustering
            d3AlphaDecay={0.01}
            d3VelocityDecay={0.3}
            cooldownTicks={100}

            onNodeHover={(node) => setHoverNode(node as GraphNode || null)}
            onNodeClick={(node) => {
              if (node) {
                fgRef.current?.centerAt(node.x, node.y, 800)
                fgRef.current?.zoom(4, 800)
              }
            }}
          />

          {/* Controls */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button
              onClick={() => {
                const z = fgRef.current?.zoom() || 1
                fgRef.current?.zoom(z * 1.5, 400)
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 backdrop-blur"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                const z = fgRef.current?.zoom() || 1
                fgRef.current?.zoom(z / 1.5, 400)
              }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 backdrop-blur"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => fgRef.current?.zoomToFit(400)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 backdrop-blur"
            >
              <Focus className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
