/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import { useEffect, useState } from 'react'
import { useMemoryStore } from '../stores/useMemoryStore'
import { MemoryCard } from '../components/MemoryCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Brain, Mic, Zap } from 'lucide-react'
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
      setResurfacing(prev => prev.filter(m => m.id !== memoryId))
    } catch (err) {
      console.error('Failed to mark as reviewed:', err)
    }
  }

  const displayMemories = view === 'all' ? memories : resurfacing
  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 relative">
          <div className="inline-block mb-4">
            <div className="relative">
              <Brain className="h-16 w-16 text-purple-600 mx-auto mb-4 float-animation" />
              <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            📝 Memories
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your captured thoughts and voice notes
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-3 justify-center mb-8">
          <Button
            variant={view === 'all' ? 'default' : 'outline'}
            onClick={() => setView('all')}
            className={view === 'all' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg' : 'hover:scale-105 transition-transform'}
          >
            All Memories ({memories.length})
          </Button>
          <Button
            variant={view === 'resurfacing' ? 'default' : 'outline'}
            onClick={() => setView('resurfacing')}
            className={view === 'resurfacing' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg' : 'hover:scale-105 transition-transform'}
          >
            🔄 Resurface ({resurfacing.length})
          </Button>
        </div>

        {/* Resurfacing Info Banner */}
        {view === 'resurfacing' && resurfacing.length > 0 && (
          <Card className="mb-8 border-yellow-400 bg-gradient-to-br from-yellow-50/90 to-white/80 backdrop-blur-xl shadow-xl">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                💡 Time to Review
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                These memories are ready for review based on spaced repetition.
                Reviewing strengthens your memory and extends the next review interval.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-gradient-to-r from-red-50 to-pink-50">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
            <CardContent className="py-24">
              <div className="text-center text-muted-foreground">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-purple-600 border-r-transparent mb-4"></div>
                <p className="text-lg">Loading memories...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && displayMemories.length === 0 && (
          <Card className="backdrop-blur-xl bg-white/80 border-white/20 shadow-xl">
            <CardContent className="py-16">
              <div className="max-w-2xl mx-auto text-center space-y-8">
                {view === 'all' ? (
                  <>
                    <div className="relative inline-block">
                      <Mic className="h-20 w-20 text-purple-600 mx-auto float-animation" />
                      <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-4">Start Capturing Your Thoughts</h3>
                      <p className="text-lg text-gray-600 mb-8">
                        Memories are the foundation of your personal knowledge graph. Capture your thoughts, ideas, and interests to power AI-generated project suggestions.
                      </p>
                    </div>

                    <div className="backdrop-blur-xl bg-white/60 rounded-2xl p-8 border border-white/20 shadow-lg">
                      <h4 className="font-bold text-gray-900 mb-4 text-lg">How to Capture Memories</h4>
                      <div className="space-y-4 text-left">
                        <div className="flex gap-4">
                          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white font-bold text-sm">1</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Connect Audiopen</p>
                            <p className="text-sm text-gray-600">Link your Audiopen account to automatically capture voice notes as memories</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white font-bold text-sm">2</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">Record Your Thoughts</p>
                            <p className="text-sm text-gray-600">Speak naturally about your interests, ideas, and what you're working on</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white font-bold text-sm">3</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">AI Extracts Insights</p>
                            <p className="text-sm text-gray-600">Polymath automatically identifies entities, topics, and connections</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-500">
                      💡 Tip: The more memories you capture, the better your AI-generated suggestions will be!
                    </p>
                  </>
                ) : (
                  <>
                    <div className="relative inline-block">
                      <Zap className="h-20 w-20 text-purple-600 mx-auto float-animation" />
                      <div className="absolute inset-0 bg-purple-600/20 blur-2xl" />
                    </div>
                    <h3 className="text-2xl font-bold">Nothing to review right now</h3>
                    <p className="text-lg text-gray-600">
                      Check back later for memories ready to resurface. Spaced repetition helps strengthen your knowledge over time.
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Memories Grid */}
        {!isLoading && displayMemories.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayMemories.map((memory) => (
              <div key={memory.id} className="flex flex-col gap-2">
                <MemoryCard memory={memory} />
                {view === 'resurfacing' && (
                  <Button
                    onClick={() => handleReview(memory.id)}
                    variant="default"
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                  >
                    ✓ Reviewed
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
