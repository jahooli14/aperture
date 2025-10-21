import { useState, useEffect } from 'react'
import type { Memory, Bridge } from '../types'
import { useMemoryStore } from '../stores/useMemoryStore'

interface MemoryCardProps {
  memory: Memory
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const [bridges, setBridges] = useState<Bridge[]>([])
  const fetchBridgesForMemory = useMemoryStore(state => state.fetchBridgesForMemory)

  useEffect(() => {
    fetchBridgesForMemory(memory.id).then(setBridges)
  }, [memory.id])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="memory-card">
      <div className="memory-header">
        <h3>{memory.title}</h3>
        <span className="memory-date">{formatDate(memory.created_at)}</span>
      </div>

      <div className="memory-body">
        <p>{memory.body}</p>
      </div>

      {memory.processed && (
        <div className="memory-metadata">
          {memory.memory_type && (
            <span className="badge badge-type">{memory.memory_type}</span>
          )}
          {memory.emotional_tone && (
            <span className="badge badge-tone">{memory.emotional_tone}</span>
          )}
        </div>
      )}

      {memory.entities && (
        <div className="memory-entities">
          {memory.entities.people.length > 0 && (
            <div className="entity-group">
              <strong>People:</strong> {memory.entities.people.join(', ')}
            </div>
          )}
          {memory.entities.topics.length > 0 && (
            <div className="entity-group">
              <strong>Topics:</strong> {memory.entities.topics.join(', ')}
            </div>
          )}
        </div>
      )}

      {bridges.length > 0 && (
        <div className="memory-bridges">
          <strong>🔗 {bridges.length} connection{bridges.length > 1 ? 's' : ''}</strong>
          <div className="bridge-list">
            {bridges.slice(0, 3).map(bridge => (
              <div key={bridge.id} className="bridge-item">
                <span className="bridge-strength">
                  {Math.round(bridge.strength * 100)}%
                </span>
                <span className="bridge-type">{bridge.bridge_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!memory.processed && (
        <div className="memory-status">
          Processing...
        </div>
      )}

      {memory.error && (
        <div className="memory-error">
          Error: {memory.error}
        </div>
      )}
    </div>
  )
}
