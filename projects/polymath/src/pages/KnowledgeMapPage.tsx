/**
 * Knowledge Map Page - Topological Heatmap
 * 2D visualization of knowledge clusters
 */

import { Map } from 'lucide-react'
import { TopologicalMap3D } from '../components/map/TopologicalMap3D'
import { SubtleBackground } from '../components/SubtleBackground'

export function KnowledgeMapPage() {
  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      <SubtleBackground />

      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3 premium-glass p-3 rounded-xl border border-white/10">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Map className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-200">
                Topological Map
              </h1>
              <p className="text-xs text-gray-500">
                3D Force-Directed Topography
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Map Canvas */}
      <div className="w-full h-screen">
        <TopologicalMap3D />
      </div>
    </div>
  )
}
