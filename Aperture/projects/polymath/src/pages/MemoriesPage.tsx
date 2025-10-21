/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import { useEffect, useState } from 'react'
import { useMemoryStore } from '../stores/useMemoryStore'
import { MemoryCard } from '../components/MemoryCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
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
      await fetch(`/api/memories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memoryId })
      })
      // Remove from resurfacing queue
      setResurfacing(prev => prev.filter(m => m.id !== memoryId))
    } catch (err) {
      console.error('Failed to mark as reviewed:', err)
    }
  }

  const displayMemories = view === 'all' ? memories : resurfacing
  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">📝 Memories</h1>
        <p className="text-muted-foreground mt-2">
          Your captured thoughts and voice notes
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-3 justify-center mb-8">
        <Button
          variant={view === 'all' ? 'default' : 'outline'}
          onClick={() => setView('all')}
        >
          All Memories ({memories.length})
        </Button>
        <Button
          variant={view === 'resurfacing' ? 'default' : 'outline'}
          onClick={() => setView('resurfacing')}
        >
          🔄 Resurface ({resurfacing.length})
        </Button>
      </div>

      {/* Resurfacing Info Banner */}
      {view === 'resurfacing' && resurfacing.length > 0 && (
        <Card className="mb-8 border-yellow-400 bg-gradient-to-br from-yellow-50 to-white">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-lg mb-2">💡 Time to Review</h3>
            <p className="text-muted-foreground leading-relaxed">
              These memories are ready for review based on spaced repetition.
              Reviewing strengthens your memory and extends the next review interval.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-muted-foreground">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4"></div>
              <p>Loading memories...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && displayMemories.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              {view === 'all' ? (
                <>
                  <h3 className="text-lg font-semibold mb-2">No memories yet</h3>
                  <p className="text-muted-foreground">
                    Start recording voice notes via Audiopen to capture your thoughts
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">Nothing to review right now</h3>
                  <p className="text-muted-foreground">
                    Check back later for memories ready to resurface
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayMemories.map((memory) => (
          <div key={memory.id} className="flex flex-col gap-2">
            <MemoryCard memory={memory} />
            {view === 'resurfacing' && (
              <Button
                onClick={() => handleReview(memory.id)}
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                ✓ Reviewed
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
