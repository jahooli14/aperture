/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import { useEffect, useState } from 'react'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOnboardingStore } from '../stores/useOnboardingStore'
import { useMemoryCache } from '../hooks/useMemoryCache'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { MemoryCard } from '../components/MemoryCard'
import { CreateMemoryDialog } from '../components/memories/CreateMemoryDialog'
import { EditMemoryDialog } from '../components/memories/EditMemoryDialog'
import { FoundationalPrompts } from '../components/onboarding/FoundationalPrompts'
import { SuggestedPrompts } from '../components/onboarding/SuggestedPrompts'
import { ThemeClusterCard } from '../components/memories/ThemeClusterCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { useToast } from '../components/ui/toast'
import { Brain, Mic, Zap, ArrowLeft, CloudOff } from 'lucide-react'
import type { Memory, ThemeCluster, ThemeClustersResponse } from '../types'

export function MemoriesPage() {
  const { memories, fetchMemories, loading, error, deleteMemory } = useMemoryStore()
  const { progress } = useOnboardingStore()
  const { addToast } = useToast()
  const { fetchWithCache, cacheMemories } = useMemoryCache()
  const { isOnline } = useOnlineStatus()
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'foundational' | 'all' | 'resurfacing'>('all')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [showingCachedData, setShowingCachedData] = useState(false)

  // Theme clustering state
  const [clusters, setClusters] = useState<ThemeCluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<ThemeCluster | null>(null)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [memoryView, setMemoryView] = useState<'themes' | 'recent'>('themes')

  useEffect(() => {
    loadMemoriesWithCache()
    if (view === 'all') {
      fetchThemeClusters()
    }
  }, [view])

  const loadMemoriesWithCache = async () => {
    try {
      const { memories: fetchedMemories, fromCache } = await fetchWithCache('/api/memories')
      setShowingCachedData(fromCache)

      if (fromCache) {
        addToast({
          title: 'Offline Mode',
          description: `Showing ${fetchedMemories.length} cached memories`,
          variant: 'default'
        })
      } else {
        // Online: also update the store
        await fetchMemories()
      }
    } catch (error) {
      console.error('Failed to load memories:', error)
    }
  }

  const fetchThemeClusters = async () => {
    setLoadingClusters(true)
    try {
      const response = await fetch('/api/memories?themes=true')
      if (!response.ok) throw new Error('Failed to fetch themes')
      const data: ThemeClustersResponse = await response.json()
      setClusters(data.clusters)
    } catch (err) {
      console.error('Failed to fetch theme clusters:', err)
    } finally {
      setLoadingClusters(false)
    }
  }

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

  const handleEdit = (memory: Memory) => {
    setSelectedMemory(memory)
    setEditDialogOpen(true)
  }

  const handleDelete = async (memory: Memory) => {
    if (confirm(`Delete "${memory.title}"? This action cannot be undone.`)) {
      try {
        await deleteMemory(memory.id)
        addToast({
          title: 'Memory deleted',
          description: `"${memory.title}" has been removed.`,
          variant: 'success',
        })
      } catch (error) {
        addToast({
          title: 'Failed to delete memory',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
      }
    }
  }

  const displayMemories = view === 'all' ? memories : resurfacing
  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <div className="min-h-screen py-12">
      {/* Header with Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        {/* Button row - pushes content down */}
        {view === 'all' && (
          <div className="flex items-center justify-end mb-6">
            <CreateMemoryDialog />
          </div>
        )}
        {/* Centered header content below button */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Brain className="h-12 w-12 text-orange-600" />
          </div>
          <h1 className="text-4xl font-bold mb-3 text-neutral-900">
            Memories
          </h1>
          <p className="text-lg text-neutral-600">
            Your captured thoughts and voice notes
          </p>
          {showingCachedData && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <CloudOff className="h-4 w-4" />
              <span className="text-sm font-medium">Showing cached data from offline mode</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* View Toggle */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          <Button
            variant={view === 'foundational' ? 'default' : 'outline'}
            onClick={() => setView('foundational')}
            className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
              view === 'foundational'
                ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            Foundational {progress && `(${progress.completed_required}/${progress.total_required})`}
          </Button>
          <Button
            variant={view === 'all' ? 'default' : 'outline'}
            onClick={() => setView('all')}
            className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
              view === 'all'
                ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            My Memories ({memories.length})
          </Button>
          <Button
            variant={view === 'resurfacing' ? 'default' : 'outline'}
            onClick={() => setView('resurfacing')}
            className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
              view === 'resurfacing'
                ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            Resurface ({resurfacing.length})
          </Button>
        </div>

        {/* Demo Data Context Banner - Only show on "My Memories" view with demo data */}
        {view === 'all' && memories.length > 0 && memories.some(m => m.audiopen_id?.startsWith('demo-')) && (
          <Card className="mb-8 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Brain className="h-5 w-5 text-orange-600" />
                Demo Memories - Cross-Domain Examples
              </h3>
              <p className="text-neutral-600 leading-relaxed mb-3">
                These 8 memories demonstrate <strong>diverse interests</strong>: React development, woodworking, parenting, photography, ML, meditation, cooking, and design.
                Notice how they span <strong>technical skills AND hobbies</strong> - this is the key to powerful synthesis.
              </p>
              <p className="text-sm text-neutral-500">
                💡 <strong>Tip:</strong> Real-world usage works best with 5-10 memories covering both your professional expertise and personal interests.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Resurfacing Info Banner */}
        {view === 'resurfacing' && resurfacing.length > 0 && (
          <Card className="mb-8 border-amber-300 bg-amber-50/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                Time to Review
              </h3>
              <p className="text-neutral-600 leading-relaxed">
                These memories are ready for review based on spaced repetition.
                Reviewing strengthens your memory and extends the next review interval.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error Banner */}
        {error && (
          <Card className="mb-6 border-red-300 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Foundational Tab */}
        {view === 'foundational' && <FoundationalPrompts />}

        {/* My Memories Tab */}
        {view === 'all' && (
          <>
            <SuggestedPrompts />

            {/* Loading State */}
            {isLoading && (
              <Card className="pro-card">
                <CardContent className="py-24">
                  <div className="text-center text-neutral-600">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent mb-4"></div>
                    <p className="text-lg">Loading memories...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Resurfacing Tab Loading */}
        {view === 'resurfacing' && isLoading && (
          <Card className="pro-card">
            <CardContent className="py-24">
              <div className="text-center text-neutral-600">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent mb-4"></div>
                <p className="text-lg">Loading memories...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && displayMemories.length === 0 && (
          <Card className="pro-card">
            <CardContent className="py-16">
              <div className="max-w-2xl mx-auto text-center space-y-8">
                {view === 'all' ? (
                  <>
                    <div className="inline-flex items-center justify-center mb-4">
                      <Mic className="h-16 w-16 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-4 text-neutral-900">Start Capturing Your Thoughts</h3>
                      <p className="text-lg text-neutral-600 mb-8">
                        Memories are the foundation of your personal knowledge graph. Capture your thoughts, ideas, and interests to power AI-generated project suggestions.
                      </p>
                    </div>

                    <div className="bg-neutral-50 rounded-xl p-8 border border-neutral-200">
                      <h4 className="font-bold text-neutral-900 mb-6 text-lg">How to Capture Memories</h4>
                      <div className="space-y-4 text-left">
                        <div className="flex gap-4">
                          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white font-bold text-sm">1</span>
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900">Manually Capture</p>
                            <p className="text-sm text-neutral-600">Click 'New Memory' to manually add thoughts, ideas, or insights</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white font-bold text-sm">2</span>
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900">Connect Audiopen</p>
                            <p className="text-sm text-neutral-600">Link your Audiopen account to automatically capture voice notes as memories</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1">
                            <span className="text-white font-bold text-sm">3</span>
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900">AI Extracts Insights</p>
                            <p className="text-sm text-neutral-600">Polymath automatically identifies entities, topics, and connections</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center px-4 sm:px-0">
                      <div className="w-full sm:w-auto">
                        <CreateMemoryDialog />
                      </div>
                    </div>

                    <p className="text-sm text-neutral-500">
                      Tip: The more memories you capture, the better your AI-generated suggestions will be
                    </p>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center mb-4">
                      <Zap className="h-16 w-16 text-orange-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900">Nothing to review right now</h3>
                    <p className="text-lg text-neutral-600">
                      Check back later for memories ready to resurface. Spaced repetition helps strengthen your knowledge over time.
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Memories: Theme Clusters or Recent View */}
        {view === 'all' && !isLoading && memories.length > 0 && (
          <>
            {/* Sub-navigation for Themes vs Recent */}
            <div className="flex gap-2 justify-center mb-8">
              {[
                { key: 'themes', label: 'By Theme' },
                { key: 'recent', label: 'Recent' }
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={memoryView === key ? 'default' : 'outline'}
                  onClick={() => setMemoryView(key as typeof memoryView)}
                  className={`whitespace-nowrap px-4 py-2.5 rounded-full font-medium transition-all ${
                    memoryView === key
                      ? 'bg-orange-600 text-white shadow-md hover:bg-orange-700'
                      : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600'
                  }`}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Theme cluster detail view */}
            {selectedCluster && memoryView === 'themes' && (
              <div className="mb-8">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCluster(null)}
                  className="mb-6 flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Themes
                </Button>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span className="text-3xl">{selectedCluster.icon}</span>
                  {selectedCluster.name}
                  <span className="text-sm font-normal text-gray-600">
                    ({selectedCluster.memory_count} memories)
                  </span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {selectedCluster.memories.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Theme clusters grid */}
            {!selectedCluster && memoryView === 'themes' && (
              <>
                {loadingClusters ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent mb-4"></div>
                    <p className="text-lg text-gray-600">Analyzing themes...</p>
                  </div>
                ) : clusters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clusters.map((cluster) => (
                      <ThemeClusterCard
                        key={cluster.id}
                        cluster={cluster}
                        onClick={() => setSelectedCluster(cluster)}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="p-8 text-center">
                    <p className="text-gray-600">No themes detected yet. Add more memories with diverse topics!</p>
                  </Card>
                )}
              </>
            )}

            {/* Recent memories view */}
            {memoryView === 'recent' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
                {memories.slice(0, 20).map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Resurfacing Memories Grid */}
        {view === 'resurfacing' && !loadingResurfacing && resurfacing.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children mt-8">
            {resurfacing.map((memory) => (
              <div key={memory.id} className="flex flex-col gap-3">
                <MemoryCard
                  memory={memory}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
                <Button
                  onClick={() => handleReview(memory.id)}
                  variant="default"
                  className="w-full btn-primary"
                >
                  Reviewed
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <EditMemoryDialog
        memory={selectedMemory}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  )
}
