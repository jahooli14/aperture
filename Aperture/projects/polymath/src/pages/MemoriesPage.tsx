/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import React, { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Virtuoso } from 'react-virtuoso'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOnboardingStore } from '../stores/useOnboardingStore'
import { useMemoryCache } from '../hooks/useMemoryCache'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { MemoryCard } from '../components/MemoryCard'
import { CreateMemoryDialog } from '../components/memories/CreateMemoryDialog'
import { PullToRefresh } from '../components/PullToRefresh'
import { EditMemoryDialog } from '../components/memories/EditMemoryDialog'
import { FoundationalPrompts } from '../components/onboarding/FoundationalPrompts'
import { SuggestedPrompts } from '../components/onboarding/SuggestedPrompts'
import { ThemeClusterCard } from '../components/memories/ThemeClusterCard'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { useConnectionStore } from '../stores/useConnectionStore'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { Brain, Zap, ArrowLeft, CloudOff } from 'lucide-react'
import { BrandName } from '../components/BrandName'
import type { Memory, ThemeCluster, ThemeClustersResponse } from '../types'

export function MemoriesPage() {
  const { memories, fetchMemories, loading, error, deleteMemory } = useMemoryStore()
  const { progress } = useOnboardingStore()
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const { fetchWithCache, cacheMemories } = useMemoryCache()
  const { isOnline } = useOnlineStatus()
  const { addOfflineCapture } = useOfflineSync()
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'foundational' | 'all' | 'resurfacing'>('all')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [showingCachedData, setShowingCachedData] = useState(false)
  const [processingVoiceNote, setProcessingVoiceNote] = useState(false)
  const [newlyCreatedMemoryId, setNewlyCreatedMemoryId] = useState<string | null>(null)

  // Theme clustering state
  const [clusters, setClusters] = useState<ThemeCluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<ThemeCluster | null>(null)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [memoryView, setMemoryView] = useState<'themes' | 'recent'>('recent')

  const loadMemoriesWithCache = useCallback(async () => {
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
  }, [fetchWithCache, addToast, fetchMemories])

  const fetchThemeClusters = useCallback(async () => {
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
  }, [])

  const fetchResurfacing = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadMemoriesWithCache()
    if (view === 'all') {
      fetchThemeClusters()
    }
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (view === 'resurfacing') {
      fetchResurfacing()
    }
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const confirmed = await confirm({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The memory will be permanently removed.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    })

    if (confirmed) {
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

  const handleVoiceCapture = async (transcript: string) => {
    if (!transcript) return

    // Set processing state
    setProcessingVoiceNote(true)
    setNewlyCreatedMemoryId(null)

    // Switch to "All" view and "Recent" to show the new thought
    if (view !== 'all') {
      setView('all')
    }
    if (memoryView !== 'recent') {
      setMemoryView('recent')
    }

    try {
      if (isOnline) {
        // Show persistent toast during processing
        addToast({
          title: 'Processing voice note...',
          description: 'Creating your thought',
          variant: 'default',
        })

        // Online: send to memories API for parsing
        const response = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        })

        if (!response.ok) {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('text/html')) {
            throw new Error('Memories API not available. Queuing for offline sync.')
          }
          throw new Error(`Failed to save memory: ${response.statusText}`)
        }

        const data = await response.json()
        const createdMemory = data.memory
        console.log('✓ Memory created:', createdMemory)

        // Store the ID of the newly created memory
        if (createdMemory?.id) {
          setNewlyCreatedMemoryId(createdMemory.id)
        }

        // Refresh memories list
        await fetchMemories()

        // Show success toast with the title
        addToast({
          title: '✓ Thought captured!',
          description: createdMemory?.title || 'Your voice note is ready',
          variant: 'success',
        })

        // Clear the highlight after 5 seconds
        setTimeout(() => {
          setNewlyCreatedMemoryId(null)
        }, 5000)

      } else {
        // Offline: queue for later
        await addOfflineCapture(transcript)
        addToast({
          title: 'Queued for sync',
          description: 'Will process when back online',
          variant: 'default',
        })

        // Still refresh to show queued items
        await fetchMemories()
      }

    } catch (error) {
      console.error('Failed to capture:', error)

      // Fallback to offline queue if API fails
      try {
        await addOfflineCapture(transcript)
        addToast({
          title: 'Queued for offline sync',
          description: 'Will process when API is available',
          variant: 'default',
        })
        console.log('✓ Queued for offline sync')
        await fetchMemories()
      } catch (offlineError) {
        addToast({
          title: 'Capture failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    } finally {
      setProcessingVoiceNote(false)
    }
  }

  const displayMemories = view === 'all' ? memories : resurfacing
  const isLoading = view === 'all' ? loading : loadingResurfacing

  const handleRefresh = async () => {
    if (view === 'all') {
      await Promise.all([
        loadMemoriesWithCache(),
        fetchThemeClusters()
      ])
    } else if (view === 'resurfacing') {
      await fetchResurfacing()
    }
  }

  return (
    <>
      <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
        <motion.div
          className="pt-12 pb-24"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Compact Header */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <h1 className="text-2xl font-bold premium-text-platinum">Thoughts</h1>
          </div>
          {view === 'all' && <CreateMemoryDialog />}
        </div>
        {showingCachedData && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
            <CloudOff className="h-3 w-3" />
            <span className="font-medium">Offline mode</span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* View Toggle */}
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          <Button
            variant={view === 'foundational' ? 'default' : 'outline'}
            onClick={() => setView('foundational')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              view === 'foundational'
                ? 'premium-card border-2 shadow-lg'
                : 'premium-card border shadow-sm hover:shadow-md'
            }`}
            style={{
              borderColor: view === 'foundational' ? 'var(--premium-indigo)' : 'rgba(var(--premium-indigo-rgb), 0.2)',
              color: view === 'foundational' ? 'var(--premium-indigo)' : 'var(--premium-text-secondary)'
            }}
          >
            Foundational {progress && `(${progress.completed_required}/${progress.total_required})`}
          </Button>
          <Button
            variant={view === 'all' ? 'default' : 'outline'}
            onClick={() => setView('all')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              view === 'all'
                ? 'premium-card border-2 shadow-lg'
                : 'premium-card border shadow-sm hover:shadow-md'
            }`}
            style={{
              borderColor: view === 'all' ? 'var(--premium-indigo)' : 'rgba(var(--premium-indigo-rgb), 0.2)',
              color: view === 'all' ? 'var(--premium-indigo)' : 'var(--premium-text-secondary)'
            }}
          >
            All ({memories.length})
          </Button>
          <Button
            variant={view === 'resurfacing' ? 'default' : 'outline'}
            onClick={() => setView('resurfacing')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              view === 'resurfacing'
                ? 'premium-card border-2 shadow-lg'
                : 'premium-card border shadow-sm hover:shadow-md'
            }`}
            style={{
              borderColor: view === 'resurfacing' ? 'var(--premium-indigo)' : 'rgba(var(--premium-indigo-rgb), 0.2)',
              color: view === 'resurfacing' ? 'var(--premium-indigo)' : 'var(--premium-text-secondary)'
            }}
          >
            Resurface ({resurfacing.length})
          </Button>
        </div>

        {/* Demo Data Context Banner - Only show on "My Thoughts" view with demo data */}
        {view === 'all' && memories.length > 0 && memories.some(m => m.audiopen_id?.startsWith('demo-')) && (
          <Card className="premium-card mb-8 border-2" style={{ borderColor: 'var(--premium-blue)' }}>
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Brain className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
                Demo Thoughts - Cross-Domain Examples
              </h3>
              <p className="leading-relaxed mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                These 8 thoughts demonstrate <strong>diverse interests</strong>: React development, woodworking, parenting, photography, ML, meditation, cooking, and design.
                Notice how they span <strong>technical skills AND hobbies</strong> - this is the key to powerful synthesis.
              </p>
              <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                💡 <strong>Tip:</strong> Real-world usage works best with 5-10 thoughts covering both your professional expertise and personal interests.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Resurfacing Info Banner */}
        {view === 'resurfacing' && resurfacing.length > 0 && (
          <Card className="premium-card mb-8 border-2 border-amber-300">
            <CardContent className="pt-6">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                Time to Review
              </h3>
              <p className="leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                These thoughts are ready for review based on spaced repetition.
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

            {/* Voice Note Processing Banner */}
            {processingVoiceNote && (
              <Card className="premium-card mb-6 border-2" style={{ borderColor: 'var(--premium-blue)' }}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid" style={{ borderColor: 'var(--premium-blue)', borderRightColor: 'transparent' }}></div>
                    <div>
                      <h3 className="font-semibold text-lg premium-text-platinum">
                        Processing your voice note...
                      </h3>
                      <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                        AI is transcribing and creating your thought
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Loading State */}
            {isLoading && (
              <Card className="premium-card">
                <CardContent className="py-24">
                  <div className="text-center" style={{ color: 'var(--premium-text-secondary)' }}>
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid mb-4" style={{ borderColor: 'var(--premium-blue)', borderRightColor: 'transparent' }}></div>
                    <p className="text-lg">Loading memories...</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Resurfacing Tab Loading */}
        {view === 'resurfacing' && isLoading && (
          <Card className="premium-card">
            <CardContent className="py-24">
              <div className="text-center" style={{ color: 'var(--premium-text-secondary)' }}>
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid mb-4" style={{ borderColor: 'var(--premium-blue)', borderRightColor: 'transparent' }}></div>
                <p className="text-lg">Loading memories...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && displayMemories.length === 0 && (
          <Card className="premium-card">
            <CardContent className="py-16">
              <div className="max-w-2xl mx-auto text-center space-y-8">
                {view === 'all' ? (
                  <>
                    <div className="inline-flex items-center justify-center mb-4">
                      <Brain className="h-16 w-16" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold mb-4 premium-text-platinum">Start Capturing Your Thoughts</h3>
                      <p className="text-lg mb-8" style={{ color: 'var(--premium-text-secondary)' }}>
                        Thoughts are the foundation of your personal knowledge graph. Capture your ideas, insights, and interests to power AI-generated project suggestions.
                      </p>
                    </div>

                    <div className="premium-card rounded-xl p-8 border-2" style={{ borderColor: 'rgba(var(--premium-indigo-rgb), 0.2)' }}>
                      <h4 className="font-bold mb-6 text-lg premium-text-platinum">How to Capture Thoughts</h4>
                      <div className="space-y-4 text-left">
                        <div className="flex gap-4">
                          <div className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(to right, var(--premium-blue), var(--premium-indigo))' }}>
                            <span className="text-white font-bold text-sm">1</span>
                          </div>
                          <div>
                            <p className="font-semibold premium-text-platinum">Manually Capture</p>
                            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>Click 'New Memory' to manually add thoughts, ideas, or insights</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(to right, var(--premium-blue), var(--premium-indigo))' }}>
                            <span className="text-white font-bold text-sm">2</span>
                          </div>
                          <div>
                            <p className="font-semibold premium-text-platinum">Connect Audiopen</p>
                            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>Link your Audiopen account to automatically capture voice notes as thoughts</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(to right, var(--premium-blue), var(--premium-indigo))' }}>
                            <span className="text-white font-bold text-sm">3</span>
                          </div>
                          <div>
                            <p className="font-semibold premium-text-platinum">AI Extracts Insights</p>
                            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}><BrandName size="sm" /> automatically identifies entities, topics, and connections</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center px-4 sm:px-0">
                      <div className="w-full sm:w-auto">
                        <CreateMemoryDialog />
                      </div>
                    </div>

                    <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                      Tip: The more thoughts you capture, the better your AI-generated suggestions will be
                    </p>
                  </>
                ) : (
                  <>
                    <div className="inline-flex items-center justify-center mb-4">
                      <Zap className="h-16 w-16" style={{ color: 'var(--premium-blue)' }} />
                    </div>
                    <h3 className="text-2xl font-bold premium-text-platinum">Nothing to review right now</h3>
                    <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
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
            <div className="flex gap-2 justify-center mb-4">
              {[
                { key: 'themes', label: 'By Theme' },
                { key: 'recent', label: 'Recent' }
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={memoryView === key ? 'default' : 'outline'}
                  onClick={() => setMemoryView(key as typeof memoryView)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    memoryView === key
                      ? 'premium-card border-2 shadow-lg'
                      : 'premium-card border shadow-sm hover:shadow-md'
                  }`}
                  style={{
                    borderColor: memoryView === key ? 'var(--premium-indigo)' : 'rgba(var(--premium-indigo-rgb), 0.2)',
                    color: memoryView === key ? 'var(--premium-indigo)' : 'var(--premium-text-secondary)'
                  }}
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
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 premium-text-platinum">
                  <span className="text-3xl">{selectedCluster.icon}</span>
                  {selectedCluster.name}
                  <span className="text-sm font-normal" style={{ color: 'var(--premium-text-secondary)' }}>
                    ({selectedCluster.memory_count} thoughts)
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
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid mb-4" style={{ borderColor: 'var(--premium-blue)', borderRightColor: 'transparent' }}></div>
                    <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Analyzing themes...</p>
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
                  <Card className="premium-card p-8 text-center">
                    <p style={{ color: 'var(--premium-text-secondary)' }}>No themes detected yet. Add more thoughts with diverse topics!</p>
                  </Card>
                )}
              </>
            )}

            {/* Recent memories view - Virtualized Grid */}
            {memoryView === 'recent' && (
              <Virtuoso
                style={{ height: '800px' }}
                totalCount={memories.length}
                itemContent={(index) => {
                  const memory = memories[index]
                  const isNewlyCreated = memory.id === newlyCreatedMemoryId

                  return (
                    <div className="pb-6">
                      <div className={`transition-all duration-500 ${isNewlyCreated ? 'ring-4 ring-blue-500 rounded-xl animate-pulse' : ''}`}>
                        <MemoryCard
                          key={memory.id}
                          memory={memory}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      </div>
                    </div>
                  )
                }}
                components={{
                  List: React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; children?: React.ReactNode }>(
                    ({ style, children }, ref) => (
                      <div
                        ref={ref}
                        style={style}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                      >
                        {children}
                      </div>
                    )
                  )
                }}
              />
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

      {/* Confirmation Dialog */}
      {confirmDialog}
        </motion.div>
      </PullToRefresh>

      {/* Connection Suggestions */}
      {suggestions.length > 0 && sourceType === 'memory' && (
        <ConnectionSuggestion
          suggestions={suggestions}
          sourceType={sourceType}
          sourceId={sourceId!}
          onLinkCreated={(targetId, targetType) => {
            addToast({
              title: 'Connection created!',
              description: `Linked thought to ${targetType}`,
              variant: 'success',
            })
            // Refresh to show updated connection counts
            fetchMemories()
          }}
          onDismiss={clearSuggestions}
        />
      )}
    </>
  )
}
