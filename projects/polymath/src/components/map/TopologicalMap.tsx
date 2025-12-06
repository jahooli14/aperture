import React, { useEffect, useRef, useState, useMemo } from 'react'
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d'
import { Delaunay } from 'd3-delaunay'
import * as d3 from 'd3'
import { useThemeStore } from '../../stores/useThemeStore'
import { api } from '../../lib/apiClient'
import { Loader2, ZoomIn, ZoomOut, Focus } from 'lucide-react'

interface GraphData {
  nodes: any[]
  links: any[]
}

export function TopologicalMap() {
  const fgRef = useRef<ForceGraphMethods>()
  const containerRef = useRef<HTMLDivElement>(null)
  const { accentColor } = useThemeStore()
  
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] })
  const [loading, setLoading] = useState(true)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    // Load data
    const loadData = async () => {
      setLoading(true)
      try {
        const response = await api.get('connections?action=list-all')
        const connections = response.connections || []
        
        // Transform connections into nodes and links
        const nodes = new Map()
        const links: any[] = []

        connections.forEach((conn: any) => {
          // Add source node
          if (!nodes.has(conn.source_id)) {
            nodes.set(conn.source_id, { 
              id: conn.source_id, 
              type: conn.source_type,
              // We don't have title here easily without a huge join, 
              // so ideally the API should return enriched nodes.
              // For now we will rely on what we have or fetch nodes separately.
              // Let's assume for this "Heatmap" we need positions more than details.
              // Actually, to make it useful, we need titles.
              // The 'list-all' endpoint might need enhancement or we fetch projects/memories separately.
              // Let's fetch projects/memories to populate nodes properly.
            })
          }
          // Add target node
          if (!nodes.has(conn.target_id)) {
            nodes.set(conn.target_id, { id: conn.target_id, type: conn.target_type })
          }
          
          links.push({
            source: conn.source_id,
            target: conn.target_id,
            type: conn.connection_type
          })
        })

        // Fetch node details (simplified for now, just getting everything)
        const [projects, memories] = await Promise.all([
          api.get('projects'),
          api.get('memories')
        ])

        const projectList = projects.projects || []
        const memoryList = memories.memories || []

        // Populate node data
        projectList.forEach((p: any) => {
          nodes.set(p.id, { ...p, type: 'project', val: 2 }) // val for size
        })
        memoryList.forEach((m: any) => {
          nodes.set(m.id, { ...m, type: 'thought', val: 1 })
        })

        // Filter out nodes that might have been in connections but deleted
        const validNodes = Array.from(nodes.values()).filter(n => n.title || n.body)

        setData({
          nodes: validNodes,
          links: links.filter(l => nodes.has(l.source) && nodes.has(l.target))
        })

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

  // Voronoi / Heatmap Overlay
  const paintVoronoi = React.useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // We don't paint nodes here, we paint the background layer
    // But react-force-graph's nodeCanvasObject paints PER NODE.
    // To paint a background Voronoi, we need `onRenderFramePre` or similar, 
    // but ForceGraph2D mainly exposes node/link canvas props.
    // 
    // Workaround: We can use `onRenderFramePre` if available, or just paint a large circle behind the node
    // representing its territory.
    // 
    // Better approach for Heatmap in this lib:
    // Use `nodeCanvasObject` to draw the node AND a soft gradient glow behind it.
    // The overlapping glows will create a heatmap effect.

    const label = node.title || node.body?.slice(0, 10) || 'Untitled'
    const fontSize = 12 / globalScale
    const isProject = node.type === 'project'
    const color = isProject ? '#3b82f6' : '#a855f7' // Blue for projects, Purple for thoughts

    // 1. Heatmap Glow (The "Terrain")
    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.val * 20)
    gradient.addColorStop(0, `${color}20`) // 20 = low opacity hex
    gradient.addColorStop(1, 'transparent')
    
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.val * 20, 0, 2 * Math.PI, false)
    ctx.fillStyle = gradient
    ctx.fill()

    // 2. The Node itself
    ctx.beginPath()
    ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false)
    ctx.fillStyle = color
    ctx.fill()

    // 3. Label (only if zoomed in or priority)
    if (globalScale > 1.5 || node.is_priority) {
      ctx.font = `${fontSize}px Sans-Serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
      ctx.fillText(label, node.x, node.y + 8)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative w-full h-[600px] rounded-xl overflow-hidden bg-[#050505] border border-white/10">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}
      
      {!loading && (
        <>
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
            nodeLabel="title"
            nodeCanvasObject={paintVoronoi}
            linkColor={() => 'rgba(255,255,255,0.05)'} // Very subtle links
            d3AlphaDecay={0.02} // Slower stabilization
            d3VelocityDecay={0.3} // More friction
            cooldownTicks={100}
            onEngineStop={() => fgRef.current?.zoomToFit(400)}
          />
          
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button 
              onClick={() => fgRef.current?.zoomIn()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button 
              onClick={() => fgRef.current?.zoomOut()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <button 
              onClick={() => fgRef.current?.zoomToFit(400)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <Focus className="h-5 w-5" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
