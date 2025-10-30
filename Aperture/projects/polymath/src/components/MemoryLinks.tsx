/**
 * MemoryLinks Component
 * Shows bi-directional links (backlinks and forward links) for a memory
 */

import { Link2, ArrowRight, ArrowLeft } from 'lucide-react'
import type { Memory, BridgeWithMemories } from '../types'
import { motion } from 'framer-motion'

interface MemoryLinksProps {
  currentMemoryId: string
  bridges: BridgeWithMemories[]
  onMemoryClick?: (memoryId: string) => void
}

interface LinkedMemory {
  memory: Memory
  bridge_type: string
  strength: number
  direction: 'inbound' | 'outbound'
}

export function MemoryLinks({ currentMemoryId, bridges, onMemoryClick }: MemoryLinksProps) {
  // Separate bridges into inbound (backlinks) and outbound (forward links)
  const linkedMemories: LinkedMemory[] = bridges.map((bridge) => {
    const isInbound = bridge.memory_b.id === currentMemoryId
    return {
      memory: isInbound ? bridge.memory_a : bridge.memory_b,
      bridge_type: bridge.bridge_type,
      strength: bridge.strength,
      direction: isInbound ? 'inbound' : 'outbound',
    }
  })

  const backlinks = linkedMemories.filter((link) => link.direction === 'inbound')
  const forwardLinks = linkedMemories.filter((link) => link.direction === 'outbound')

  if (linkedMemories.length === 0) {
    return null
  }

  const bridgeTypeLabels: Record<string, string> = {
    entity_match: 'Shared topics',
    semantic_similarity: 'Similar ideas',
    temporal_proximity: 'Nearby in time',
  }

  return (
    <div className="pt-3 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="h-4 w-4" style={{ color: 'var(--premium-blue)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--premium-text-secondary)' }}>
          Connected Memories
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            color: 'var(--premium-blue)',
          }}
        >
          {linkedMemories.length}
        </span>
      </div>

      <div className="space-y-3">
        {/* Backlinks (memories that link TO this one) */}
        {backlinks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--premium-text-tertiary)' }}>
              <ArrowLeft className="h-3 w-3" />
              <span>Linked here from</span>
            </div>
            {backlinks.map((link) => (
              <motion.button
                key={link.memory.id}
                onClick={() => onMemoryClick?.(link.memory.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full text-left rounded-lg px-3 py-2 border transition-colors"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderColor: 'rgba(59, 130, 246, 0.3)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1" style={{ color: 'var(--premium-text-primary)' }}>
                      {link.memory.title}
                    </div>
                    <div className="text-xs mt-0.5 capitalize" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {bridgeTypeLabels[link.bridge_type] || link.bridge_type.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded-full font-bold text-xs flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(99, 102, 241, 0.8))',
                      color: '#ffffff',
                    }}
                  >
                    {Math.round(link.strength * 100)}%
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Forward links (memories this one links TO) */}
        {forwardLinks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--premium-text-tertiary)' }}>
              <ArrowRight className="h-3 w-3" />
              <span>Links to</span>
            </div>
            {forwardLinks.map((link) => (
              <motion.button
                key={link.memory.id}
                onClick={() => onMemoryClick?.(link.memory.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full text-left rounded-lg px-3 py-2 border transition-colors"
                style={{
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  borderColor: 'rgba(6, 182, 212, 0.3)',
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium line-clamp-1" style={{ color: 'var(--premium-text-primary)' }}>
                      {link.memory.title}
                    </div>
                    <div className="text-xs mt-0.5 capitalize" style={{ color: 'var(--premium-text-tertiary)' }}>
                      {bridgeTypeLabels[link.bridge_type] || link.bridge_type.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded-full font-bold text-xs flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.8), rgba(14, 165, 233, 0.8))',
                      color: '#ffffff',
                    }}
                  >
                    {Math.round(link.strength * 100)}%
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
