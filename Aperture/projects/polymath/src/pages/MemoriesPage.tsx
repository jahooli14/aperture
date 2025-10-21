/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import { useEffect, useState } from 'react'
import { useMemoryStore } from '../stores/useMemoryStore'
import { MemoryCard } from '../components/MemoryCard'
import type { Memory } from '../types'

export function MemoriesPage() {
  const { memories, fetchMemories, loading, error } = useMemoryStore()
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'all' | 'resurfacing'>('all')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)

  useEffect(() => {
    fetchMemories()
  }, [])

  const fetchResurfacing = async () => {
    setLoadingResurfacing(true)
    try {
      const response = await fetch('/api/memories?resurfacing=true')
      const data = await response.json()
      setResurfacing(data.memories || [])
    } catch (err) {
      console.error('Failed to fetch resurfacing memories:', err)
    } finally {
      setLoadingResurfacing(false)
    }
  }

  useEffect(() => {
    if (view === 'resurfacing') {
      fetchResurfacing()
    }
  }, [view])

  const handleReview = async (memoryId: string) => {
    try {
      await fetch(`/api/memories/${memoryId}/review`, { method: 'POST' })
      // Remove from resurfacing queue
      setResurfacing(prev => prev.filter(m => m.id !== memoryId))
    } catch (err) {
      console.error('Failed to mark as reviewed:', err)
    }
  }

  const displayMemories = view === 'all' ? memories : resurfacing
  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <div className="memories-page">
      <header className="page-header">
        <h1>📝 Memories</h1>
        <p className="subtitle">Your captured thoughts and voice notes</p>
      </header>

      <div className="view-toggle">
        <button
          className={`toggle-btn ${view === 'all' ? 'active' : ''}`}
          onClick={() => setView('all')}
        >
          All Memories ({memories.length})
        </button>
        <button
          className={`toggle-btn ${view === 'resurfacing' ? 'active' : ''}`}
          onClick={() => setView('resurfacing')}
        >
          🔄 Resurface ({resurfacing.length})
        </button>
      </div>

      {view === 'resurfacing' && resurfacing.length > 0 && (
        <div className="resurfacing-info">
          <h3>💡 Time to Review</h3>
          <p>
            These memories are ready for review based on spaced repetition.
            Reviewing strengthens your memory and extends the next review interval.
          </p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="loading-state">
          Loading memories...
        </div>
      )}

      {!isLoading && displayMemories.length === 0 && (
        <div className="empty-state">
          {view === 'all' ? (
            <>
              <h3>No memories yet</h3>
              <p>Start recording voice notes via Audiopen to capture your thoughts</p>
            </>
          ) : (
            <>
              <h3>Nothing to review right now</h3>
              <p>Check back later for memories ready to resurface</p>
            </>
          )}
        </div>
      )}

      <div className="memories-grid">
        {displayMemories.map((memory) => (
          <div key={memory.id} className="memory-wrapper">
            <MemoryCard memory={memory} />
            {view === 'resurfacing' && (
              <button
                className="review-btn"
                onClick={() => handleReview(memory.id)}
              >
                ✓ Reviewed
              </button>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .memories-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .page-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0;
          font-size: 2.5rem;
          color: #1a1a1a;
        }

        .subtitle {
          margin: 0.5rem 0 0 0;
          color: #666;
          font-size: 1.125rem;
        }

        .view-toggle {
          display: flex;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .toggle-btn {
          padding: 0.75rem 1.5rem;
          border: 2px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          color: #666;
        }

        .toggle-btn:hover {
          border-color: #2563eb;
          color: #2563eb;
        }

        .toggle-btn.active {
          background: #2563eb;
          color: white;
          border-color: #2563eb;
        }

        .resurfacing-info {
          background: linear-gradient(135deg, #fff9e6 0%, white 50%);
          border: 2px solid #fbbf24;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 2rem;
        }

        .resurfacing-info h3 {
          margin: 0 0 0.5rem 0;
          color: #1a1a1a;
        }

        .resurfacing-info p {
          margin: 0;
          color: #666;
          line-height: 1.6;
        }

        .error-message {
          background: #fee2e2;
          border: 2px solid #ef4444;
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 2rem;
          color: #991b1b;
        }

        .loading-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #666;
          font-size: 1.125rem;
        }

        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          color: #666;
        }

        .empty-state h3 {
          margin: 0 0 0.5rem 0;
          color: #1a1a1a;
        }

        .empty-state p {
          margin: 0;
        }

        .memories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 1.5rem;
        }

        .memory-wrapper {
          position: relative;
        }

        .review-btn {
          margin-top: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          background: #10b981;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .review-btn:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        @media (max-width: 768px) {
          .memories-page {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 2rem;
          }

          .view-toggle {
            flex-direction: column;
          }

          .toggle-btn {
            width: 100%;
          }

          .memories-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
