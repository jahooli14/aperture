/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
import { useConnectionStore } from '../stores/useConnectionStore'
import { useContextEngineStore } from '../stores/useContextEngineStore'
import { ConnectionSuggestion } from '../components/ConnectionSuggestion'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { Brain, Zap, ArrowLeft, CloudOff, Search, X, Tag, Lightbulb, Leaf, Code, Palette, Heart, BookOpen, Users, Pin } from 'lucide-react'
import { BrandName } from '../components/BrandName'
import { SubtleBackground } from '../components/SubtleBackground'
// import { FocusableList, FocusableItem } from '../components/FocusableList' // Removed for masonry
import type { Memory, ThemeCluster, ThemeClustersResponse } from '../types'
import { MemoryDetailModal } from '../components/memories/MemoryDetailModal' // Import MemoryDetailModal
import { GlassCard } from '../components/ui/GlassCard' // For consistency with other cards
import { debounce } from '../lib/utils'
import { CACHE_TTL } from '../lib/cacheConfig'

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

// Helper for Google Keep style masonry (Across then Down)
function MasonryGrid({
  memories,
  onEdit,
  onDelete,
  renderExtra,
  connectionCounts
}: {
  memories: Memory[],
  onEdit: (m: Memory) => void,
  onDelete: (m: Memory) => void,
  renderExtra?: (m: Memory) => React.ReactNode,
  connectionCounts?: Record<string, number>
}) {
  const [columns, setColumns] = useState(2)

  useEffect(() => {
    const updateColumns = () => {
      if (window.innerWidth >= 1024) setColumns(3) // lg
      else if (window.innerWidth >= 768) setColumns(2) // md
      // else setColumns(1) // mobile - originally code was columns-2 even on mobile, keeping 2 for consistency with "tight packing" request unless screen is very small
      else setColumns(2)
    }

    updateColumns()
    const debouncedResize = debounce(updateColumns, 150)
    window.addEventListener('resize', debouncedResize)
    return () => window.removeEventListener('resize', debouncedResize)
  }, [])

  // Distribute memories into columns:
  // Col 1: Index 0, 3, 6...
  // Col 2: Index 1, 4, 7...
  // Col 3: Index 2, 5, 8...
  const distributedColumns = useMemo(() => {
    const cols: Memory[][] = Array.from({ length: columns }, () => [])
    memories.forEach((memory, i) => {
      cols[i % columns].push(memory)
    })
    return cols
  }, [memories, columns])

  return (
    <div className="flex gap-4 items-start w-full">
      {distributedColumns.map((colMemories, colIndex) => (
        <div key={colIndex} className="flex-1 flex flex-col gap-4 min-w-0">
          {colMemories.map((memory, index) => (
            <motion.div
              key={memory.id || `memory-${colIndex}-${index}`}
              className="w-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
              layout
            >
              <MemoryCard
                memory={memory}
                onEdit={onEdit}
                onDelete={onDelete}
                connectionCount={connectionCounts?.[memory.id]}
              />
              {renderExtra && renderExtra(memory)}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  )
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
  const { isOnline } = useOnlineStatus()
  const { addOfflineCapture } = useOfflineSync()
  const { suggestions, sourceId, sourceType, clearSuggestions } = useConnectionStore()
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'foundational' | 'all' | 'resurfacing'>('all')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedMemoryForModal, setSelectedMemoryForModal] = useState<Memory | null>(null) // State for the detail modal
  const [showDetailModal, setShowDetailModal] = useState(false) // State to open/close the detail modal

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [dismissedResurface, setDismissedResurface] = useState(false)

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
    // Check if clusters are still fresh
    const now = Date.now()

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

  // Called after MemoryCard has already confirmed and deleted the memory.
  // No need for another confirm dialog — just refresh the list.
  const handleDelete = async (_memory: Memory) => {
    await loadMemories(true)
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
      // Always attempt API call first - don't trust navigator.onLine
      // Only save offline if API actually fails with a network error
      console.log('[handleVoiceCapture] Attempting to send to API')

      // Show reassuring toast that data is saved
      addToast({
        title: '✓ Voice note saved',
        description: 'AI is processing your transcript (may take up to 30s)...',
        variant: 'success',
      })

      // Send to memories API for parsing
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

  // All unique tags from all memories
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    memories.forEach(m => m.tags?.forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [memories])

  // Pick one random memory that's 30+ days old for "Resurface" section
  // Stabilised so it doesn't re-pick on every render — only when the total count changes
  const resurfacedMemory = useMemo(() => {
    const oldMemories = memories.filter(m => {
      const age = (Date.now() - new Date(m.created_at).getTime()) / 86400000
      return age >= 30
    })
    if (oldMemories.length === 0) return null
    return oldMemories[Math.floor(Math.random() * oldMemories.length)]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memories.length]) // Only recompute when memories count changes

  // Memoize displayMemories to prevent recalculation on every render
  const baseMemories = useMemo(() => {
    return view === 'all' ? memories : resurfacing
  }, [view, memories, resurfacing])

  // Apply search and tag filters
  const displayMemories = useMemo(() => {
    let filtered = baseMemories
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      filtered = filtered.filter(m => {
        const inTitle = m.title?.toLowerCase().includes(q)
        const inBody = m.body?.toLowerCase().includes(q)
        const inTags = m.tags?.some(t => t.toLowerCase().includes(q))
        return inTitle || inBody || inTags
      })
    }
    if (activeTags.length > 0) {
      filtered = filtered.filter(m =>
        activeTags.every(tag => m.tags?.includes(tag))
      )
    }
    return filtered
  }, [baseMemories, searchQuery, activeTags])

  // Pinned thoughts — shown as a horizontal row above the main grid
  const pinnedMemories = useMemo(() => {
    return memories.filter(m => m.is_pinned)
  }, [memories])

  const isFiltered = searchQuery.trim().length > 0 || activeTags.length > 0

  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <>
      <SubtleBackground />
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-40" style={{
        backgroundColor: '#0a0f1a',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 0 rgba(0,0,0,0.6)',
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="flex items-center" style={{
            color: 'var(--brand-primary)',
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
              className="h-9 w-9 rounded-lg flex items-center justify-center transition-all"
              style={{
                color: 'var(--brand-primary)',
                border: '2px solid rgba(59,130,246,0.25)',
                boxShadow: '2px 2px 0 rgba(0,0,0,0.6)',
              }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="pb-32 relative z-10" style={{ paddingTop: '5.5rem', isolation: 'isolate' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2">
          {/* Outer Card Structure */}
          <div className="p-4 sm:p-6 rounded-lg mb-6 w-full max-w-full" style={{
            background: '#0d0f14',
            border: '2px solid rgba(255,255,255,0.1)',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.8)',
            transform: 'translate3d(0,0,0)', // Force hardware acceleration boundary
            overflowX: 'hidden'
          }}>
            {/* Title Section */}
            <div className="mb-4 flex items-center gap-2">
              <div className="w-1 h-5 rounded-lg" style={{ background: 'var(--brand-primary)' }} />
              <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Your <span style={{ color: 'var(--brand-primary)' }}>thoughts</span>
              </h2>
            </div>

            {/* Search Bar — only shown on 'all' view */}
            {view === 'all' && (
              <div className="mb-4 space-y-3">
                {/* Search input */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: 'rgba(255,255,255,0.35)' }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search thoughts..."
                    className="w-full pl-9 pr-9 py-2.5 rounded-lg text-sm outline-none transition-all"
                    style={{
                      background: '#111113',
                      border: '2px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.85)',
                      caretColor: 'var(--brand-primary)',
                      boxShadow: '2px 2px 0 rgba(0,0,0,0.6)',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.1)]"
                      style={{ color: 'rgba(255,255,255,0.4)' }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Result count */}
                {isFiltered && (
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {displayMemories.length} of {memories.length} thought{memories.length !== 1 ? 's' : ''}
                  </p>
                )}

                {/* Tag pills — horizontal scroll */}
                {allTags.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                    {allTags.map(tag => {
                      const isActive = activeTags.includes(tag)
                      return (
                        <button
                          key={tag}
                          onClick={() => setActiveTags(prev =>
                            isActive ? prev.filter(t => t !== tag) : [...prev, tag]
                          )}
                          className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
                          style={{
                            background: isActive ? 'rgba(59,130,246,0.2)' : 'var(--glass-surface)',
                            border: isActive ? '1.5px solid rgba(59,130,246,0.5)' : '1.5px solid rgba(255,255,255,0.1)',
                            color: isActive ? 'rgba(147,197,253,1)' : 'rgba(255,255,255,0.45)',
                            boxShadow: isActive ? '2px 2px 0 rgba(59,130,246,0.15)' : '2px 2px 0 rgba(0,0,0,0.4)',
                          }}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </button>
                      )
                    })}
                    {activeTags.length > 0 && (
                      <button
                        onClick={() => setActiveTags([])}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all"
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1.5px solid rgba(239,68,68,0.3)',
                          color: 'rgba(252,165,165,0.8)',
                          boxShadow: '2px 2px 0 rgba(239,68,68,0.1)',
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Inner Content */}
            <div>
              {/* Demo Data Context Banner - Only show on "My Thoughts" view with demo data */}
              {view === 'all' && memories.length > 0 && memories.some(m => m.audiopen_id?.startsWith('demo-')) && (
                <div className="mb-6 p-4 rounded-lg" style={{ background: '#111113', border: '2px solid rgba(59,130,246,0.25)', borderLeft: '4px solid rgba(59,130,246,0.6)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                  <h3 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    <Brain className="h-4 w-4" style={{ color: 'var(--brand-primary)' }} />
                    Demo Thoughts — Cross-Domain Examples
                  </h3>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--brand-text-secondary)' }}>
                    These 8 thoughts demonstrate <strong>diverse interests</strong>: React development, woodworking, parenting, photography, ML, meditation, cooking, and design.
                    Notice how they span <strong>technical skills AND hobbies</strong> — this is the key to powerful synthesis.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-text-muted)' }}>
                    💡 <strong>Tip:</strong> Real-world usage works best with 5–10 thoughts covering both your professional expertise and personal interests.
                  </p>
                </div>
              )}

              {/* Resurfacing Info Banner */}
              {view === 'resurfacing' && resurfacing.length > 0 && (
                <div className="mb-6 p-4 rounded-lg" style={{ background: '#111113', border: '2px solid rgba(139,92,246,0.25)', borderLeft: '4px solid rgba(139,92,246,0.5)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                  <h3 className="font-black text-xs uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                    Up for review
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
                    These thoughts are ready for review based on spaced repetition.
                    Reviewing strengthens your memory and extends the next review interval.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="mb-6 rounded-lg p-4 sm:p-5" style={{ background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.3)', boxShadow: '3px 3px 0 rgba(239,68,68,0.1)' }}>
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Foundational Tab */}
              {view === 'foundational' && <FoundationalPrompts />}

              {/* My Memories Tab */}
              {view === 'all' && (
                <>
                  <SuggestedPrompts />

                  {/* Voice Note Processing Banner */}
                  {processingVoiceNote && (
                    <div className="mb-6 p-4 rounded-lg animate-pulse" style={{ background: '#111113', border: '2px solid rgba(59,130,246,0.3)', boxShadow: '3px 3px 0 rgba(59,130,246,0.1)' }}>
                      <div className="flex items-center gap-4">
                        <div className="inline-block h-8 w-8 animate-spin rounded-lg border-4 border-solid" style={{ borderColor: 'var(--brand-primary)', borderRightColor: 'transparent' }}></div>
                        <div className="flex-1">
                          <h3 className="font-black text-sm uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            ✓ Voice note saved — AI processing...
                          </h3>
                          <p className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>
                            Your recording is safe. Creating a formatted thought from your transcript (this may take up to 30 seconds)
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <div className="h-[5px] flex-1" style={{ backgroundColor: 'var(--glass-surface-hover)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <div className="h-full animate-pulse" style={{
                                backgroundColor: 'var(--brand-primary)',
                                width: '60%',
                              }}></div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--brand-text-muted)' }}>Processing...</span>
                          </div>
                        </div>
                      </div>
                    </div>
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
                <div className="mb-8 rounded-lg p-8" style={{ background: '#111113', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '3px 3px 0 rgba(0,0,0,0.8)' }}>
                  <div className="py-8">
                    <div className="max-w-2xl mx-auto text-center space-y-6">
                      {view === 'all' && isFiltered ? (
                        /* Search returned no results */
                        <>
                          <div className="inline-flex items-center justify-center mb-4 p-4 rounded-lg" style={{ background: 'var(--glass-surface)', border: '2px solid rgba(255,255,255,0.1)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                            <Search className="h-12 w-12" style={{ color: 'rgba(255,255,255,0.2)' }} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-wide mb-3" style={{ color: 'rgba(255,255,255,0.85)' }}>
                              No thoughts match
                              {searchQuery ? ` "${searchQuery}"` : ' your filters'}
                            </h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--brand-text-secondary)' }}>
                              Try different keywords or clear your filters to see all thoughts.
                            </p>
                          </div>
                          <button
                            onClick={() => { setSearchQuery(''); setActiveTags([]) }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                            style={{
                              background: 'rgba(59,130,246,0.12)',
                              border: '2px solid rgba(59,130,246,0.35)',
                              color: 'rgba(147,197,253,1)',
                              boxShadow: '2px 2px 0 rgba(59,130,246,0.1)',
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Clear search
                          </button>
                        </>
                      ) : view === 'all' ? (
                        /* No memories at all */
                        <>
                          <div className="inline-flex items-center justify-center mb-4 p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '2px solid rgba(59,130,246,0.25)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                            <Brain className="h-12 w-12" style={{ color: 'var(--brand-primary)' }} />
                          </div>
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-wide mb-4" style={{ color: 'rgba(255,255,255,0.85)' }}>Start capturing your thoughts</h3>
                            <p className="text-sm mb-6" style={{ color: 'var(--brand-text-secondary)' }}>
                              Thoughts are the foundation of your personal knowledge graph. Capture your ideas, insights, and interests to power AI-generated project suggestions.
                            </p>
                          </div>

                          <div className="rounded-lg p-6 text-left" style={{ background: '#0d0f14', border: '2px solid var(--glass-surface-hover)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                            <h4 className="font-black text-xs uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>How to Capture Thoughts</h4>
                            <div className="space-y-4">
                              {[
                                { step: '1', title: 'Manually capture', desc: "Click 'New thought' to manually add ideas, insights, or observations" },
                                { step: '2', title: 'Connect Audiopen', desc: 'Link your Audiopen account to automatically capture voice notes as thoughts' },
                                { step: '3', title: 'AI Extracts Insights', desc: 'Polymath automatically identifies entities, topics, and connections' },
                              ].map(({ step, title, desc }) => (
                                <div key={step} className="flex gap-3">
                                  <div className="rounded-lg w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(59,130,246,0.15)', border: '2px solid rgba(59,130,246,0.35)', boxShadow: '2px 2px 0 rgba(0,0,0,0.5)' }}>
                                    <span className="text-blue-400 font-black text-xs">{step}</span>
                                  </div>
                                  <div>
                                    <p className="font-black text-xs uppercase tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{title}</p>
                                    <p className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>{desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-center px-4 sm:px-0">
                            <div className="w-full sm:w-auto">
                              <CreateMemoryDialog />
                            </div>
                          </div>

                          <p className="text-xs" style={{ color: 'var(--brand-text-muted)' }}>
                            Tip: The more thoughts you capture, the better your AI-generated suggestions will be
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="inline-flex items-center justify-center mb-4 p-4 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '2px solid rgba(59,130,246,0.25)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                            <Zap className="h-12 w-12" style={{ color: 'var(--brand-primary)' }} />
                          </div>
                          <h3 className="text-xl font-black uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>Nothing to review right now</h3>
                          <p className="text-sm" style={{ color: 'var(--brand-text-secondary)' }}>
                            Check back later for memories ready to resurface. Spaced repetition helps strengthen your knowledge over time.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
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
                        className="mb-6 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                        style={{
                          background: 'rgba(59,130,246,0.08)',
                          color: 'rgba(147,197,253,0.8)',
                          border: '1.5px solid rgba(59,130,246,0.25)',
                          boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                        }}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Themes
                      </button>
                      <h2 className="text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            background: 'rgba(59,130,246,0.12)',
                            border: '2px solid rgba(59,130,246,0.3)',
                            boxShadow: '2px 2px 0 rgba(0,0,0,0.6)',
                          }}
                        >
                          {React.createElement(getIconComponent(selectedCluster.name), {
                            className: 'h-6 w-6',
                            style: { color: 'var(--brand-primary)' }
                          })}
                        </div>
                        {selectedCluster.name}
                        <span className="text-sm font-normal" style={{ color: 'var(--brand-text-secondary)' }}>
                          ({selectedCluster.memory_count} thoughts)
                        </span>
                      </h2>
                      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
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
                          <div className="inline-block h-10 w-10 animate-spin rounded-lg border-4 border-solid mb-4" style={{ borderColor: 'var(--brand-primary)', borderRightColor: 'transparent' }}></div>
                          <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)' }}>Analyzing themes...</p>
                        </div>
                      ) : clusters.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {clusters.map((cluster, index) => (
                            <ThemeClusterCard
                              key={`${cluster.id}-${index}`}
                              cluster={cluster}
                              onClick={() => setSelectedCluster(cluster)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 rounded-lg text-center" style={{ background: '#111113', border: '2px solid var(--glass-surface-hover)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                          <p className="text-xs" style={{ color: 'var(--brand-text-secondary)' }}>No themes detected yet. Add more thoughts with diverse topics!</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Recent memories view - Google Keep Style Masonry (Across then Down) */}
                  {memoryView === 'recent' && (
                    <>
                      {/* Resurface a thought — one random memory 30+ days old */}
                      <AnimatePresence>
                        {!dismissedResurface && resurfacedMemory && !isFiltered && (
                          <motion.div
                            key="resurface"
                            initial={{ opacity: 0, y: -12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.25 }}
                            className="mb-6 rounded-lg p-4"
                            style={{
                              background: '#111113',
                              border: '2px solid rgba(251,191,36,0.3)',
                              borderLeft: '4px solid rgba(251,191,36,0.6)',
                              boxShadow: '3px 3px 0 rgba(251,191,36,0.08)',
                            }}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(251,191,36,0.7)' }}>
                                A thought from {Math.floor((Date.now() - new Date(resurfacedMemory.created_at).getTime()) / 86400000)} days ago...
                              </p>
                              <button
                                onClick={() => setDismissedResurface(true)}
                                className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.1)]"
                                style={{ color: 'rgba(255,255,255,0.3)' }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <h4 className="font-semibold text-sm mb-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
                              {resurfacedMemory.title}
                            </h4>
                            <p className="text-sm line-clamp-3 mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                              {resurfacedMemory.body}
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setDismissedResurface(true)}
                                className="text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-wide transition-colors"
                                style={{
                                  background: 'var(--glass-surface)',
                                  border: '1.5px solid rgba(255,255,255,0.1)',
                                  color: 'rgba(255,255,255,0.4)',
                                  boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
                                }}
                              >
                                Dismiss
                              </button>
                              <button
                                onClick={() => handleOpenDetail(resurfacedMemory)}
                                className="text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-wide transition-colors"
                                style={{
                                  background: 'rgba(251,191,36,0.12)',
                                  border: '1.5px solid rgba(251,191,36,0.4)',
                                  color: 'rgba(251,191,36,0.9)',
                                  boxShadow: '2px 2px 0 rgba(251,191,36,0.1)',
                                }}
                              >
                                Connect to today
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Pinned Thoughts Section */}
                      {pinnedMemories.length > 0 && !searchQuery && activeTags.length === 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--brand-text-secondary)' }}>
                            <Pin className="w-3.5 h-3.5 text-amber-400" style={{ fill: 'currentColor' }} />
                            Pinned
                          </h3>
                          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                            {pinnedMemories.map((memory) => (
                              <motion.div
                                key={memory.id}
                                onClick={() => handleOpenDetail(memory)}
                                whileHover={{ y: -2 }}
                                className="flex-shrink-0 w-56 rounded-xl p-3 cursor-pointer transition-all"
                                style={{
                                  background: 'linear-gradient(135deg, var(--glass-surface-hover) 0%, var(--glass-surface) 100%)',
                                  boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.2), 0 4px 12px rgba(0,0,0,0.2)',
                                  borderTop: '2px solid rgba(251,191,36,0.4)',
                                }}
                              >
                                <h4 className="text-sm font-semibold truncate mb-1" style={{ color: 'var(--brand-text-primary)' }}>
                                  {memory.title}
                                </h4>
                                <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
                                  {memory.body}
                                </p>
                                <span className="text-[10px] mt-2 block" style={{ color: 'var(--brand-text-muted)' }}>
                                  {new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )}

                      <MasonryGrid memories={displayMemories} onEdit={handleOpenDetail} onDelete={handleDelete} />
                    </>
                  )}
                </>
              )}

              {/* Resurfacing Memories Grid - Google Keep Style Masonry */}
              {view === 'resurfacing' && !isLoading && resurfacing.length > 0 && (
                <MasonryGrid
                  memories={resurfacing}
                  onEdit={handleOpenDetail}
                  onDelete={handleDelete}
                  renderExtra={(memory) => (
                    <Button
                      onClick={() => handleReview(memory.id)}
                      variant="default"
                      className="w-full btn-primary mt-3"
                    >
                      Reviewed
                    </Button>
                  )}
                />
              )}
            </div>
          </div>
        </div>



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
