/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
// import { Virtuoso } from 'react-virtuoso' // Removed Virtuoso
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOnboardingStore } from '../stores/useOnboardingStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { MemoryCard } from '../components/MemoryCard'
import { CreateMemoryDialog } from '../components/memories/CreateMemoryDialog'
// // import { EditMemoryDialog } from '../components/memories/EditMemoryDialog' // Now handled by MemoryDetailModal // Now handled by MemoryDetailModal
import { FoundationalPrompts } from '../components/onboarding/FoundationalPrompts'
import { SuggestedPrompts } from '../components/onboarding/SuggestedPrompts'
import { ThemeClusterCard } from '../components/memories/ThemeClusterCard'
import { Button } from '../components/ui/button'
// import { Card, CardContent } from '../components/ui/card' // Will use GlassCard
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { useConnectionStore } from '../stores/useConnectionStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { Brain, Zap, ArrowLeft, CloudOff, Search, Lightbulb, Leaf, Code, Palette, Heart, BookOpen, Users } from 'lucide-react'
import { BrandName } from '../components/BrandName'
import { SubtleBackground } from '../components/SubtleBackground'
// import { FocusableList, FocusableItem } from '../components/FocusableList' // Removed for masonry
import type { Memory, ThemeCluster, ThemeClustersResponse } from '../types'
import { MemoryDetailModal } from '../components/memories/MemoryDetailModal' // Import MemoryDetailModal
import { GlassCard } from '../components/ui/GlassCard' // For consistency with other cards

const getIconComponent = (name: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.includes('learn')) return Brain
  if (lowerName.includes('creat')) return Lightbulb
  if (lowerName.includes('nature')) return Leaf
  if (lowerName.includes('code') || lowerName.includes('tech')) return Code
  if (lowerName.includes('art') || lowerName.includes('design')) return Palette
  if (lowerName.includes('love') || lowerName.includes('relationship')) return Heart
  if (lowerName.includes('read') || lowerName.includes('book')) return BookOpen
  if (lowerName.includes('energy') || lowerName.includes('power')) return Zap
  if (lowerName.includes('social') || lowerName.includes('people')) return Users
  return Lightbulb // default icon
}

export function MemoriesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { memories, fetchMemories, loading, error, deleteMemory, clearError } = useMemoryStore()
  const { progress } = useOnboardingStore()
  const { addToast } = useToast()
  const { setContext } = useContextEngineStore()

  useEffect(() => {
    setContext('page', 'memories', 'Thoughts')
  }, [])
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const { isOnline } = useOnlineStatus()
  const { addOfflineCapture } = useOfflineSync()
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'foundational' | 'all' | 'resurfacing'>('all')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedMemoryForModal, setSelectedMemoryForModal] = useState<Memory | null>(null) // State for the detail modal
  const [showDetailModal, setShowDetailModal] = useState(false) // State to open/close the detail modal

  // Effect to handle deep linking via ID
  useEffect(() => {
    const memoryId = searchParams.get('id')

    // If no ID or already showing this memory, skip
    if (!memoryId || selectedMemoryForModal?.id === memoryId) return

    // 1. Try to find in loaded memories
    const memory = memories.find(m => m.id === memoryId) || resurfacing.find(m => m.id === memoryId)

    if (memory) {
      setSelectedMemoryForModal(memory)
      setShowDetailModal(true)
    } else {
      // 2. If not locally available, fetch from API
      console.log(`[MemoriesPage] Memory ${memoryId} not in list, fetching...`)
      fetch(`/api/memories?id=${memoryId}`)
        .then(res => {
          if (!res.ok) throw new Error('Memory not found')
          return res.json()
        })
        .then(data => {
          if (data.memory) {
            setSelectedMemoryForModal(data.memory)
            setShowDetailModal(true)
          }
        })
        .catch(err => {
          console.error('[MemoriesPage] Failed to load deep-linked memory:', err)
          addToast({
            title: 'Thought not found',
            description: 'Could not load the requested thought.',
            variant: 'destructive'
          })
        })
    }
  }, [searchParams, memories, resurfacing])

  // Clear URL param when modal closes
  const handleCloseModal = () => {
    setShowDetailModal(false)
    setSelectedMemoryForModal(null)
    setSearchParams(params => {
      params.delete('id')
      return params
    })
  }
  const [processingVoiceNote, setProcessingVoiceNote] = useState(false)
  const [newlyCreatedMemoryId, setNewlyCreatedMemoryId] = useState<string | null>(null)

  // Theme clustering state
  const [clusters, setClusters] = useState<ThemeCluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<ThemeCluster | null>(null)
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [memoryView, setMemoryView] = useState<'themes' | 'recent'>('recent')
  const [clustersLastFetched, setClustersLastFetched] = useState<number>(0)

  // Use store's fetchMemories directly - it has built-in caching!
  const loadMemories = useCallback(async (force = false) => {
    try {
      await fetchMemories(force)
    } catch (error) {
      console.error('Failed to load memories:', error)
    }
  }, [fetchMemories])

  const fetchThemeClusters = useCallback(async (force = false) => {
    // Check if clusters are still fresh (5 minutes = 300000ms)
    const now = Date.now()
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    if (!force && clusters.length > 0 && (now - clustersLastFetched) < CACHE_TTL) {
      console.log('[MemoriesPage] Using cached clusters')
      return
    }

    setLoadingClusters(true)
    try {
      const response = await fetch('/api/memories?themes=true')
      if (!response.ok) {
        console.error('Failed to fetch themes:', response.status, response.statusText)
        // Don't throw, just return empty clusters to prevent crash
        setClusters([])
        return
      }
      const data: ThemeClustersResponse = await response.json()
      setClusters(data.clusters)
      setClustersLastFetched(now)
    } catch (err) {
      console.error('Failed to fetch theme clusters:', err)
      setClusters([]) // Fallback to empty
    } finally {
      setLoadingClusters(false)
    }
  }, [clusters.length, clustersLastFetched])

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

  // Fetch data on mount and when navigating back to this page (like HomePage)
  useEffect(() => {
    const loadData = async () => {
      clearError()

      if (view === 'resurfacing') {
        await fetchResurfacing()
      } else {
        await loadMemories()
        if (view === 'all') {
          await fetchThemeClusters()
        }
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, view]) // Re-run when navigating to page OR when view changes

  // Memoize unprocessed count to avoid unnecessary re-renders
  const unprocessedCount = useMemo(() => {
    return memories.filter(m => !m.processed).length
  }, [memories])

  // Track if we're currently polling to prevent duplicate fetches
  const isPollingRef = useRef(false)

  // Poll for updates when there are unprocessed memories
  // Use normal fetch (not forced) so store's smart state updates prevent unnecessary re-renders
  useEffect(() => {
    if (unprocessedCount === 0) {
      isPollingRef.current = false
      return
    }

    if (!isPollingRef.current) {
      console.log(`🔄 Polling for thought updates (${unprocessedCount} unprocessed)`)
      isPollingRef.current = true
    }

    const pollInterval = setInterval(async () => {
      console.log('⏰ Polling tick - checking for updates...')
      try {
        // Don't force refresh - let store's smart state updates handle it
        // This prevents flickering by skipping updates when data hasn't changed
        await loadMemories(false)
      } catch (error) {
        console.error('Polling error:', error)
      }
    }, 10000) // Poll every 10 seconds

    return () => {
      clearInterval(pollInterval)
      isPollingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unprocessedCount]) // Only re-run when unprocessed count changes

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

  const handleOpenDetail = (memory: Memory) => {
    setSelectedMemoryForModal(memory)
    setShowDetailModal(true)
  }

  const handleDelete = async (memory: Memory) => {
    const confirmed = await confirm({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The thought will be permanently removed.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    })

    if (confirmed) {
      try {
        await deleteMemory(memory.id)
        addToast({
          title: 'Thought deleted',
          description: `"${memory.title}" has been removed.`,
          variant: 'success',
        })

        // Force refresh to ensure server state matches
        await loadMemories(true)
      } catch (error) {
        addToast({
          title: 'Failed to delete thought',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        })
        // Refresh to restore state if delete failed
        await loadMemories(true)
      }
    }
  }

  const handleVoiceCapture = async (transcript: string) => {
    if (!transcript) {
      console.warn('[handleVoiceCapture] No transcript provided')
      return
    }

    console.log('[handleVoiceCapture] Starting voice capture, transcript length:', transcript.length)

    // Set processing state - but DON'T force view changes
    // User should be free to navigate while processing happens in background
    setProcessingVoiceNote(true)
    setNewlyCreatedMemoryId(null)

    try {
      if (isOnline) {
        console.log('[handleVoiceCapture] Online - sending to API')

        // Show reassuring toast that data is saved
        addToast({
          title: '✓ Voice note saved',
          description: 'AI is processing your transcript (may take up to 30s)...',
          variant: 'success',
        })

        // Online: send to memories API for parsing
        const response = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        })

        console.log('[handleVoiceCapture] API response status:', response.status, response.statusText)

        if (!response.ok) {
          const contentType = response.headers.get('content-type')
          let errorDetails = `Status: ${response.status}`

          try {
            const errorText = await response.text()
            errorDetails += `, Response: ${errorText.substring(0, 200)}`
          } catch (e) {
            errorDetails += ', Could not read error response'
          }

          console.error('[handleVoiceCapture] API error:', errorDetails)

          if (contentType?.includes('text/html')) {
            throw new Error('Memories API not available. Queuing for offline sync.')
          }
          throw new Error(`Failed to save memory: ${response.statusText}. ${errorDetails}`)
        }

        const data = await response.json()
        const createdMemory = data.memory
        console.log('[handleVoiceCapture] ✓ Memory created:', createdMemory)

        // Store the ID of the newly created memory
        if (createdMemory?.id) {
          setNewlyCreatedMemoryId(createdMemory.id)
        }

        console.log('[handleVoiceCapture] Fetching memories list')
        // Refresh memories list (user can navigate away, this just updates the data)
        await loadMemories(true) // Force refresh to get the new memory
        console.log('[handleVoiceCapture] Memories fetched successfully')

        // Show success toast with the title - they can click to go to memories if they want
        addToast({
          title: '✓ Thought captured!',
          description: createdMemory?.title || 'Your voice note is ready',
          variant: 'success',
        })

        // Store the ID for highlighting (will only show if user is on memories page)
        // Clear the highlight after 8 seconds
        setTimeout(() => {
          setNewlyCreatedMemoryId(null)
        }, 8000)

      } else {
        console.log('[handleVoiceCapture] Offline - queueing for sync')
        // Offline: queue for later
        await addOfflineCapture(transcript)
        addToast({
          title: 'Queued for sync',
          description: 'Will process when back online',
          variant: 'default',
        })

        // Still refresh to show queued items
        await loadMemories(true)
      }

    } catch (error) {
      console.error('[handleVoiceCapture] ❌ ERROR:', error)
      console.error('[handleVoiceCapture] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      // Show prominent error toast
      addToast({
        title: '❌ Voice capture failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      })

      // Fallback to offline queue if API fails
      try {
        console.log('[handleVoiceCapture] Attempting offline queue fallback')
        await addOfflineCapture(transcript)
        addToast({
          title: 'Queued for offline sync',
          description: 'Will process when API is available',
          variant: 'default',
        })
        console.log('[handleVoiceCapture] ✓ Queued for offline sync')
        await loadMemories(true)
      } catch (offlineError) {
        console.error('[handleVoiceCapture] ❌ Offline queue also failed:', offlineError)
        addToast({
          title: '❌ Complete failure',
          description: 'Could not save or queue your voice note. Please try again.',
          variant: 'destructive',
        })
      }
    } finally {
      console.log('[handleVoiceCapture] Cleaning up, setting processingVoiceNote to false')
      setProcessingVoiceNote(false)
    }
  }

  // Memoize displayMemories to prevent recalculation on every render
  const displayMemories = useMemo(() => {
    return view === 'all' ? memories : resurfacing
  }, [view, memories, resurfacing])

  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <>
      <SubtleBackground />
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md" style={{
        backgroundColor: 'rgba(15, 24, 41, 0.7)'
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center" style={{
            color: 'var(--premium-blue)',
            opacity: 0.7
          }}>
            <Brain className="h-7 w-7" />
          </div>

          {/* View Toggle */}
          <PremiumTabs
            tabs={[
              {
                id: 'foundational',
                label: `Core${progress ? ` (${progress.completed_required}/${progress.total_required})` : ''}`,
              },
              { id: 'all', label: `All (${memories.length})` },
              { id: 'resurfacing', label: `Resurface (${resurfacing.length})` },
            ]}
            activeTab={view}
            onChange={(tabId) => setView(tabId as typeof view)}
            className="flex-nowrap"
          />

          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {view === 'all' && <CreateMemoryDialog />}
            <button
              onClick={() => navigate('/search')}
              className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
              style={{
                color: 'var(--premium-blue)'
              }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="pb-24 relative z-10" style={{ paddingTop: '5.5rem' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2">
          {/* Outer Card Structure */}
          <div className="p-6 rounded-xl backdrop-blur-xl mb-6" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Title Section */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                Your <span style={{ color: 'var(--premium-blue)' }}>thoughts</span>
              </h2>
            </div>

            {/* Inner Content */}
            <div>
              {/* Demo Data Context Banner - Only show on "My Thoughts" view with demo data */}
              {view === 'all' && memories.length > 0 && memories.some(m => m.audiopen_id?.startsWith('demo-')) && (
                <GlassCard isInteractive={false} className="mb-8">
                  <div className="pt-6">
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
                  </div>
                </GlassCard>
              )}

              {/* Resurfacing Info Banner */}
              {view === 'resurfacing' && resurfacing.length > 0 && (
                <GlassCard isInteractive={false} className="mb-8">
                  <div className="pt-6">
                    <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                      Up for review
                    </h3>
                    <p className="leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                      These thoughts are ready for review based on spaced repetition.
                      Reviewing strengthens your memory and extends the next review interval.
                    </p>
                  </div>
                </GlassCard>
              )}

              {/* Error Banner */}
              {error && (
                <GlassCard isInteractive={false} className="mb-6 border-red-300 bg-red-50">
                  <div className="pt-6">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </GlassCard>
              )}

              {/* Foundational Tab */}
              {view === 'foundational' && <FoundationalPrompts />}

              {/* My Memories Tab */}
              {view === 'all' && (
                <>
                  <SuggestedPrompts />

                  {/* Voice Note Processing Banner */}
                  {processingVoiceNote && (
                    <GlassCard isInteractive={false} className="mb-6 animate-pulse">
                      <div className="pt-6">
                        <div className="flex items-center gap-4">
                          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid" style={{ borderColor: 'var(--premium-blue)', borderRightColor: 'transparent' }}></div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg premium-text-platinum flex items-center gap-2">
                              <span>✓</span> Voice note saved - AI processing...
                            </h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
                              Your recording is safe. Creating a formatted thought from your transcript (this may take up to 30 seconds)
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                              <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                                <div className="h-full rounded-full animate-pulse" style={{
                                  backgroundColor: 'var(--premium-blue)',
                                  width: '60%',
                                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                                }}></div>
                              </div>
                              <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>Processing...</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {/* Loading State - Show skeleton loaders like HomePage */}
                  {isLoading && memories.length === 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <SkeletonCard variant="grid" count={6} />
                    </div>
                  )}
                </>
              )}

              {/* Resurfacing Tab Loading - Show skeleton loaders */}
              {view === 'resurfacing' && isLoading && resurfacing.length === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <SkeletonCard variant="grid" count={3} />
                </div>
              )}

              {/* Empty State */}
              {!isLoading && displayMemories.length === 0 && (
                <GlassCard isInteractive={false} className="mb-8">
                  <div className="py-16">
                    <div className="max-w-2xl mx-auto text-center space-y-8">
                      {view === 'all' ? (
                        <>
                          <div className="inline-flex items-center justify-center mb-4">
                            <Brain className="h-16 w-16" style={{ color: 'var(--premium-blue)' }} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold mb-4 premium-text-platinum">Start capturing your thoughts</h3>
                            <p className="text-lg mb-8" style={{ color: 'var(--premium-text-secondary)' }}>
                              Thoughts are the foundation of your personal knowledge graph. Capture your ideas, insights, and interests to power AI-generated project suggestions.
                            </p>
                          </div>

                          <GlassCard isInteractive={false} className="p-8">
                            <h4 className="font-bold mb-6 text-lg premium-text-platinum">How to Capture Thoughts</h4>
                            <div className="space-y-4 text-left">
                              <div className="flex gap-4">
                                <div className="rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(to right, var(--premium-blue), var(--premium-indigo))' }}>
                                  <span className="text-white font-bold text-sm">1</span>
                                </div>
                                <div>
                                  <p className="font-semibold premium-text-platinum">Manually capture</p>
                                  <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>Click 'New thought' to manually add ideas, insights, or observations</p>
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
                          </GlassCard>

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
                  </div>
                </GlassCard>
              )}

              {/* My Memories: Theme Clusters or Recent View */}
              {view === 'all' && !isLoading && memories.length > 0 && (
                <>
                  {/* Sub-navigation for Themes vs Recent - Minimal pill tabs */}
                  <div className="mb-6">
                    <PremiumTabs
                      tabs={[
                        { id: 'recent', label: 'Recent' },
                        { id: 'themes', label: 'By Theme' }
                      ]}
                      activeTab={memoryView}
                      onChange={(tabId) => setMemoryView(tabId as typeof memoryView)}
                    />
                  </div>

                  {/* Theme cluster detail view */}
                  {selectedCluster && memoryView === 'themes' && (
                    <div className="mb-8">
                      <button
                        onClick={() => setSelectedCluster(null)}
                        className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border"
                        style={{
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          color: 'var(--premium-text-tertiary)',
                          borderColor: 'transparent',
                          backdropFilter: 'blur(12px)'
                        }}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Themes
                      </button>
                      <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 premium-text-platinum">
                        <div
                          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(59, 130, 246, 0.2)'
                          }}
                        >
                          {React.createElement(getIconComponent(selectedCluster.name), {
                            className: 'h-6 w-6',
                            style: { color: 'var(--premium-blue)' }
                          })}
                        </div>
                        {selectedCluster.name}
                        <span className="text-sm font-normal" style={{ color: 'var(--premium-text-secondary)' }}>
                          ({selectedCluster.memory_count} thoughts)
                        </span>
                      </h2>
                      <div className="columns-2 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {selectedCluster.memories.map((memory) => (
                          <div key={memory.id} className="mb-4 break-inside-avoid">
                            <MemoryCard
                              memory={memory}
                              onEdit={handleOpenDetail}
                              onDelete={handleDelete}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Theme clusters grid */}
                  {!selectedCluster && memoryView === 'themes' && (
                    <>
                      {loadingClusters && clusters.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid mb-4" style={{ borderColor: 'var(--premium-blue)', borderRightColor: 'transparent' }}></div>
                          <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Analyzing themes...</p>
                        </div>
                      ) : clusters.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {clusters.map((cluster, index) => (
                            <ThemeClusterCard
                              key={`${cluster.id}-${index}`}
                              cluster={cluster}
                              onClick={() => setSelectedCluster(cluster)}
                            />
                          ))}
                        </div>
                      ) : (
                        <GlassCard isInteractive={false} className="p-8 text-center">
                          <p style={{ color: 'var(--premium-text-secondary)' }}>No themes detected yet. Add more thoughts with diverse topics!</p>
                        </GlassCard>
                      )}
                    </>
                  )}

                  {/* Recent memories view - Masonry Grid */}
                  {memoryView === 'recent' && (
                    <div className="columns-2 md:columns-2 lg:columns-3 gap-4 space-y-4">
                      {displayMemories.map((memory) => (
                        <div key={memory.id} className="mb-4 break-inside-avoid">
                          <MemoryCard
                            memory={memory}
                            onEdit={handleOpenDetail}
                            onDelete={handleDelete}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Resurfacing Memories Grid - Masonry */}
              {view === 'resurfacing' && !isLoading && resurfacing.length > 0 && (
                <div className="columns-2 md:columns-2 lg:columns-3 gap-4 space-y-4">
                  {resurfacing.map((memory) => (
                    <div key={memory.id} className="flex flex-col gap-3 mb-4 break-inside-avoid">
                      <MemoryCard
                        memory={memory}
                        onEdit={handleOpenDetail}
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
          </div>
        </div>



        {/* Confirmation Dialog */}
        {confirmDialog}
      </div>

      {/* Detail Modal for Deep Linking or Edit */}
      {selectedMemoryForModal && (
        <MemoryDetailModal
          memory={selectedMemoryForModal}
          isOpen={showDetailModal}
          onClose={handleCloseModal}
        />
      )}

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
