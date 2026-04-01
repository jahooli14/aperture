/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
// import { Virtuoso } from 'react-virtuoso' // Removed Virtuoso
import { useAuthContext } from '../contexts/AuthContext'
import { SignInNudge } from '../components/SignInNudge'
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
import { useContextEngineStore } from '../stores/useContextEngineStore'
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
  const columns = 2

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
    <div className="flex gap-3 items-start w-full">
      {distributedColumns.map((colMemories, colIndex) => (
        <div key={colIndex} className="flex-1 flex flex-col gap-3 min-w-0">
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
  const { isAuthenticated, loading: authLoading } = useAuthContext()

  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--brand-bg)' }} className="min-h-screen pt-12">
        <SignInNudge variant="thoughts" />
      </div>
    )
  }

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
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'foundational' | 'all' | 'resurfacing'>('all')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedMemoryForModal, setSelectedMemoryForModal] = useState<Memory | null>(null) // State for the detail modal
  const [showDetailModal, setShowDetailModal] = useState(false) // State to open/close the detail modal

  // Always pass a live copy from the store so pin/unpin state stays fresh in the modal
  const liveSelectedMemory = useMemo(
    () => selectedMemoryForModal
      ? (memories.find(m => m.id === selectedMemoryForModal.id) ?? selectedMemoryForModal)
      : null,
    [memories, selectedMemoryForModal]
  )

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
      console.log(` Polling for thought updates (${unprocessedCount} unprocessed)`)
      isPollingRef.current = true
    }

    const pollInterval = setInterval(async () => {
      console.log(' Polling tick - checking for updates...')
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
  // No need for another confirm dialog  just refresh the list.
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
        title: ' Voice note saved',
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
      console.log('[handleVoiceCapture]  Memory created:', createdMemory)

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
        title: ' Thought captured!',
        description: createdMemory?.title || 'Your voice note is ready',
        variant: 'success',
      })

      // Store the ID for highlighting (will only show if user is on memories page)
      // Clear the highlight after 8 seconds
      setTimeout(() => {
        setNewlyCreatedMemoryId(null)
      }, 8000)

    } catch (error) {
      console.error('[handleVoiceCapture]  ERROR:', error)
      console.error('[handleVoiceCapture] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      // Show prominent error toast
      addToast({
        title: ' Voice capture failed',
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
        console.log('[handleVoiceCapture]  Queued for offline sync')
        await loadMemories(true)
      } catch (offlineError) {
        console.error('[handleVoiceCapture]  Offline queue also failed:', offlineError)
        addToast({
          title: ' Complete failure',
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
  // Stabilised so it doesn't re-pick on every render  only when the total count changes
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
    return filtered.slice().sort((a, b) => {
      const dateA = new Date(a.audiopen_created_at || a.created_at).getTime()
      const dateB = new Date(b.audiopen_created_at || b.created_at).getTime()
      return dateB - dateA
    })
  }, [baseMemories, searchQuery, activeTags])

  // Pinned thoughts  shown as a horizontal row above the main grid
  const pinnedMemories = useMemo(() => {
    return memories.filter(m => m.is_pinned)
  }, [memories])

  const isFiltered = searchQuery.trim().length > 0 || activeTags.length > 0

  const isLoading = view === 'all' ? loading : loadingResurfacing

  return (
    <>
      <SubtleBackground />
      {/* Header */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-6 flex flex-col gap-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)]">
                your <span className="text-brand-primary">thoughts</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">Capture everything, loose nothing.</p>
            </div>
            <div className="flex items-center gap-2">
              {view === 'all' && <CreateMemoryDialog />}
              <button
                onClick={() => navigate('/search')}
                className="h-10 w-10 rounded-xl flex items-center justify-center transition-all bg-[var(--glass-surface)] border border-white/10"
                style={{ color: "var(--brand-primary)" }}
                title="Search everything"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
          </div>
        </div>

      <div className="pb-32 relative z-10" style={{ isolation: 'isolate' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-2">
          {/* Outer Card Structure */}
          <div className="p-4 sm:p-6 rounded-2xl mb-6 w-full max-w-full relative premium-glass shadow-2xl" style={{
            background: 'var(--brand-glass-bg)',
            border: '2px solid var(--glass-surface-hover)',
          }}>
            {/* Title Section */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black uppercase tracking-tight text-[var(--brand-text-primary)]">
                  {view === 'all' ? 'Your Graph' : view === 'resurfacing' ? 'Review Queue' : 'Core Beliefs'}
                </h2>
              </div>
            </div>

            {/* Search Bar  only shown on 'all' view */}
            {view === 'all' && (
              <div className="mb-4 space-y-3">
                {/* Search input */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ color: "var(--brand-primary)" }}
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
                      color: "var(--brand-text-secondary)",
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
                      style={{ color: "var(--brand-primary)" }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Result count */}
                {isFiltered && (
                  <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
                    {displayMemories.length} of {memories.length} thought{memories.length !== 1 ? 's' : ''}
                  </p>
                )}

                {/* Tag pills  horizontal scroll */}
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
                          color: "var(--brand-text-secondary)",
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
                  <h3 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
                    <Brain className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                    Demo Thoughts  Cross-Domain Examples
                  </h3>
                  <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--brand-primary)" }}>
                    These 8 thoughts demonstrate <strong>diverse interests</strong>: React development, woodworking, parenting, photography, ML, meditation, cooking, and design.
                    Notice how they span <strong>technical skills AND hobbies</strong>  this is the key to powerful synthesis.
                  </p>
                  <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
                     <strong>Tip:</strong> Real-world usage works best with 510 thoughts covering both your professional expertise and personal interests.
                  </p>
                </div>
              )}

              {/* Resurfacing Info Banner */}
              {view === 'resurfacing' && resurfacing.length > 0 && (
                <div className="mb-6 p-4 rounded-lg" style={{ background: '#111113', border: '2px solid rgba(139,92,246,0.25)', borderLeft: '4px solid rgba(139,92,246,0.5)', boxShadow: '3px 3px 0 rgba(0,0,0,0.6)' }}>
                  <h3 className="font-black text-xs uppercase tracking-widest mb-2" style={{ color: "var(--brand-primary)" }}>
                    Up for review
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--brand-primary)" }}>
                    These thoughts are ready for review based on spaced repetition.
                    Reviewing strengthens your memory and extends the next review interval.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="mb-6 rounded-lg p-4 sm:p-5" style={{ background: 'rgba(239,68,68,0.08)', border: '2px solid rgba(239,68,68,0.3)', boxShadow: '3px 3px 0 rgba(239,68,68,0.1)' }}>
                  <p className="text-sm text-brand-text-secondary">{error}</p>
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
                          <h3 className="font-black text-sm uppercase tracking-widest mb-1" style={{ color: "var(--brand-primary)" }}>
                             Voice note saved  AI processing...
                          </h3>
                          <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
                            Your recording is safe. Creating a formatted thought from your transcript (this may take up to 30 seconds)
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <div className="h-[5px] flex-1" style={{ backgroundColor: 'var(--glass-surface-hover)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <div className="h-full animate-pulse" style={{
                                backgroundColor: 'var(--brand-primary)',
                                width: '60%',
                              }}></div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>Processing...</span>
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
                <div className="mb-8 py-16 px-6 text-center">
                  {view === 'all' && isFiltered ? (
                    /* Search returned no results */
                    <div className="max-w-xs mx-auto space-y-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <Search className="h-6 w-6 text-brand-primary opacity-50" />
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-[var(--brand-text-primary)]">
                        Nothing matches
                      </h3>
                      <p className="text-sm text-[var(--brand-text-muted)] leading-relaxed">
                        {searchQuery ? `No thoughts containing "${searchQuery}"` : 'No thoughts match your current filters'}
                      </p>
                      <button
                        onClick={() => { setSearchQuery(''); setActiveTags([]) }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: 'var(--brand-primary)' }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear filters
                      </button>
                    </div>
                  ) : view === 'all' ? (
                    /* No memories at all — rich inspirational state */
                    <div className="max-w-sm mx-auto">
                      {/* Decorative orb */}
                      <div className="relative mx-auto w-28 h-28 mb-8">
                        <div className="absolute inset-0 rounded-full opacity-20 blur-2xl" style={{ background: 'radial-gradient(circle, var(--brand-primary), transparent)' }} />
                        <div className="relative flex items-center justify-center w-28 h-28 rounded-full"
                          style={{ background: 'radial-gradient(circle at 35% 35%, rgba(59,130,246,0.15), rgba(139,92,246,0.08))', border: '1px solid rgba(59,130,246,0.2)' }}>
                          <Brain className="h-10 w-10 text-brand-primary opacity-60" />
                        </div>
                      </div>

                      <h3 className="text-3xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-none mb-3">
                        Every great idea<br />
                        <span className="text-brand-primary">starts here.</span>
                      </h3>
                      <p className="text-sm text-[var(--brand-text-muted)] leading-relaxed mb-8">
                        Tap the mic below, say something interesting — and watch it become part of your universe.
                      </p>

                      {/* Three gentle prompts */}
                      <div className="space-y-2 mb-8 text-left">
                        {[
                          'Something you noticed today',
                          'An idea you keep coming back to',
                          'A question you can\'t stop asking',
                        ].map((prompt) => (
                          <div key={prompt} className="flex items-start gap-3 px-4 py-3 rounded-xl"
                            style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}>
                            <span className="text-brand-primary opacity-50 mt-0.5 text-xs">✦</span>
                            <p className="text-sm text-[var(--brand-text-muted)] italic">{prompt}</p>
                          </div>
                        ))}
                      </div>

                      <CreateMemoryDialog />
                    </div>
                  ) : (
                    /* Nothing to resurface */
                    <div className="max-w-xs mx-auto space-y-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full"
                        style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                        <Zap className="h-6 w-6 text-brand-primary opacity-50" />
                      </div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-[var(--brand-text-primary)]">All caught up</h3>
                      <p className="text-sm text-[var(--brand-text-muted)] leading-relaxed">
                        Nothing to revisit right now. Keep capturing thoughts and they'll resurface when the time is right.
                      </p>
                    </div>
                  )}
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
                          color: "var(--brand-text-secondary)",
                          border: '1.5px solid rgba(59,130,246,0.25)',
                          boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
                        }}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Themes
                      </button>
                      <h2 className="text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>
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
                        <span className="text-sm font-normal" style={{ color: "var(--brand-primary)" }}>
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
                          <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--brand-primary)" }}>Analyzing themes...</p>
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
                          <p className="text-xs" style={{ color: "var(--brand-primary)" }}>No themes detected yet. Add more thoughts with diverse topics!</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Recent memories view - Google Keep Style Masonry (Across then Down) */}
                  {memoryView === 'recent' && (
                    <>
                      {/* Resurface a thought  one random memory 30+ days old */}
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
                              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-primary)" }}>
                                A thought from {Math.floor((Date.now() - new Date(resurfacedMemory.created_at).getTime()) / 86400000)} days ago...
                              </p>
                              <button
                                onClick={() => setDismissedResurface(true)}
                                className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.1)]"
                                style={{ color: "var(--brand-primary)" }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <h4 className="font-semibold text-sm mb-1" style={{ color: "var(--brand-primary)" }}>
                              {resurfacedMemory.title}
                            </h4>
                            <p className="text-sm line-clamp-3 mb-4" style={{ color: "var(--brand-primary)" }}>
                              {resurfacedMemory.body}
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setDismissedResurface(true)}
                                className="text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-wide transition-colors"
                                style={{
                                  background: 'var(--glass-surface)',
                                  border: '1.5px solid rgba(255,255,255,0.1)',
                                  color: "var(--brand-text-secondary)",
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
                                  color: "var(--brand-text-secondary)",
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
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
                            <Pin className="w-3.5 h-3.5 text-brand-text-secondary" style={{ fill: 'currentColor' }} />
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
                                <h4 className="text-sm font-semibold truncate mb-1" style={{ color: "var(--brand-primary)" }}>
                                  {memory.title}
                                </h4>
                                {memory.checklist_items && memory.checklist_items.length > 0 ? (
                                  <div className="flex flex-col gap-0.5">
                                    {memory.checklist_items.slice(0, 3).map((item) => (
                                      <div key={item.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--brand-primary)', opacity: item.checked ? 0.4 : 0.8 }}>
                                        <span style={{ fontSize: '9px' }}>{item.checked ? '☑' : '☐'}</span>
                                        <span style={{ textDecoration: item.checked ? 'line-through' : 'none' }} className="truncate">{item.text}</span>
                                      </div>
                                    ))}
                                    {memory.checklist_items.length > 3 && (
                                      <span className="text-[10px]" style={{ color: 'var(--brand-primary)', opacity: 0.4 }}>+{memory.checklist_items.length - 3} more</span>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--brand-primary)" }}>
                                    {memory.body}
                                  </p>
                                )}
                                <span className="text-[10px] mt-2 block" style={{ color: "var(--brand-primary)" }}>
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
      {liveSelectedMemory && (
        <MemoryDetailModal
          memory={liveSelectedMemory}
          isOpen={showDetailModal}
          onClose={handleCloseModal}
        />
      )}

    </>
  )
}
