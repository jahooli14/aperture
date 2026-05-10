/**
 * Memories Page
 * Browse all memories, view resurfacing queue, see connections
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { SignInNudge } from '../components/SignInNudge'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOnboardingStore } from '../stores/useOnboardingStore'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { MemoryCard } from '../components/MemoryCard'
import { CreateMemoryDialog } from '../components/memories/CreateMemoryDialog'
import { SuggestedPrompts } from '../components/onboarding/SuggestedPrompts'
import { ThemeClusterCard } from '../components/memories/ThemeClusterCard'
import { Button } from '../components/ui/button'
import { useToast } from '../components/ui/toast'
import { PremiumTabs } from '../components/ui/premium-tabs'
import { SkeletonCard } from '../components/ui/skeleton-card'
import { Brain, Zap, ArrowLeft, CloudOff, Search, X, Tag, Pin, Wind, Moon } from 'lucide-react'
import { BrandName } from '../components/BrandName'
import { SubtleBackground } from '../components/SubtleBackground'
import type { Memory, ThemeCluster, ThemeClustersResponse } from '../types'
import { MemoryDetailModal } from '../components/memories/MemoryDetailModal' // Import MemoryDetailModal
import { GlassCard } from '../components/ui/GlassCard' // For consistency with other cards
import { debounce } from '../lib/utils'
import { CACHE_TTL } from '../lib/cacheConfig'
import { getIconComponent } from '../lib/themeIcons'
import { DriftMode } from '../components/bedtime/DriftMode'
import { MorningFollowUp } from '../components/bedtime/MorningFollowUp'


// Helper for Google Keep style masonry (Across then Down)
function MasonryGrid({
  memories,
  onEdit,
  onDelete,
  renderExtra
}: {
  memories: Memory[],
  onEdit: (m: Memory) => void,
  onDelete: (m: Memory) => void,
  renderExtra?: (m: Memory) => React.ReactNode
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
  // Thin auth gate — keeps rules-of-hooks happy by fully short-circuiting
  // BEFORE the inner component (and all its hooks) ever mounts. The inner
  // component then runs without conditional hook calls.
  const { isAuthenticated, loading: authLoading } = useAuthContext()
  if (!authLoading && !isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--brand-bg)' }} className="min-h-screen pt-12">
        <SignInNudge variant="thoughts" />
      </div>
    )
  }
  return <MemoriesPageInner />
}

function MemoriesPageInner() {
  const navigate = useNavigate()
  const location = useLocation()
  const { memories, fetchMemories, loading, error, deleteMemory, clearError } = useMemoryStore()
  const { fetchPrompts: fetchOnboardingPrompts } = useOnboardingStore()
  const { addToast } = useToast()
  const { isOnline } = useOnlineStatus()
  const [resurfacing, setResurfacing] = useState<Memory[]>([])
  const [view, setView] = useState<'recent' | 'themes' | 'resurfacing'>('recent')
  const [loadingResurfacing, setLoadingResurfacing] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedMemoryForModal, setSelectedMemoryForModal] = useState<Memory | null>(null) // State for the detail modal
  const [showDetailModal, setShowDetailModal] = useState(false) // State to open/close the detail modal

  // Progressive scroll-load. Render the first PAGE_SIZE thoughts; as the
  // user scrolls near the bottom, grow the visible window. Avoids the
  // hit of rendering hundreds of memory cards up-front.
  const PAGE_SIZE = 30
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

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

  // Drift Mode state — after 9pm, Drift Mode flips into Bedtime (sleep) mode
  // and pulls bedtime prompts; otherwise it stays as the daytime mental reset.
  const [driftModeOpen, setDriftModeOpen] = useState(false)
  const [driftPrompts, setDriftPrompts] = useState<any[]>([])
  const [driftVariant, setDriftVariant] = useState<'sleep' | 'break'>('break')
  const [showMorningFollowUp, setShowMorningFollowUp] = useState(true)
  const { createMemory } = useMemoryStore()

  // Re-evaluate whether bedtime mode should be the main option every minute
  // so it kicks in at 9pm without needing a page reload.
  const [isAfterBedtime, setIsAfterBedtime] = useState(() => new Date().getHours() >= 21)
  useEffect(() => {
    const check = () => setIsAfterBedtime(new Date().getHours() >= 21)
    check()
    const id = window.setInterval(check, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const handleOpenDrift = async () => {
    const variant: 'sleep' | 'break' = isAfterBedtime ? 'sleep' : 'break'
    setDriftVariant(variant)
    setDriftModeOpen(true)
    const endpoint = variant === 'sleep'
      ? '/api/projects?resource=bedtime'
      : '/api/projects?resource=break'
    try {
      const response = await fetch(endpoint)
      const data = await response.json()
      if (data.prompts) setDriftPrompts(data.prompts)
    } catch (e) {
      console.error(`Failed to fetch ${variant} prompts`, e)
    }
  }

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
  // Theme clustering state
  const [clusters, setClusters] = useState<ThemeCluster[]>([])
  const [selectedCluster, setSelectedCluster] = useState<ThemeCluster | null>(null)
  const [loadingClusters, setLoadingClusters] = useState(false)
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

  // Fetch data on mount and when navigating back to this page (like HomePage).
  // Force-refresh on mount: the 5-min in-memory cache + Dexie offline cache
  // were keeping stale snapshots alive (a 25-row cap from a prior backend
  // limit was sticking around). The thoughts page is the canonical view of
  // the corpus, so always fetch fresh on entry.
  useEffect(() => {
    const loadData = async () => {
      clearError()

      if (view === 'resurfacing') {
        await fetchResurfacing()
      } else if (view === 'themes') {
        await loadMemories(true)
        await fetchThemeClusters()
      } else {
        await loadMemories(true)
        fetchOnboardingPrompts() // Load suggested follow-up prompts
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

  // useCallback so the memoized MemoryCard inside MasonryGrid actually skips
  // re-renders when unrelated state on this page changes.
  const handleOpenDetail = useCallback((memory: Memory) => {
    setSelectedMemoryForModal(memory)
    setShowDetailModal(true)
  }, [])

  // Called after MemoryCard has already confirmed and deleted the memory.
  // No need for another confirm dialog  just refresh the list.
  const handleDelete = useCallback(async (_memory: Memory) => {
    await loadMemories(true)
  }, [loadMemories])

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

  // Reset the progressive window when filters change.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [view, searchQuery, activeTags])

  // Window-scroll-based progressive loading. Capacitor / Android WebView
  // had IntersectionObserver inconsistencies (sometimes the sentinel
  // never reported as intersecting), so we just listen for scroll on
  // the document and grow the window when we're near the bottom. Works
  // identically across desktop, mobile, and Capacitor.
  const visibleCountRef = useRef(visibleCount)
  visibleCountRef.current = visibleCount
  const totalCountRef = useRef(0)
  useEffect(() => {
    const checkAndLoad = () => {
      if (visibleCountRef.current >= totalCountRef.current) return
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 800
      if (nearBottom) {
        setVisibleCount(c => c + PAGE_SIZE)
      }
    }
    window.addEventListener('scroll', checkAndLoad, { passive: true })
    window.addEventListener('resize', checkAndLoad)
    // Initial check — if the page is short enough that the bottom is
    // already in view, load more immediately.
    checkAndLoad()
    return () => {
      window.removeEventListener('scroll', checkAndLoad)
      window.removeEventListener('resize', checkAndLoad)
    }
  }, [])

  // Memoize displayMemories to prevent recalculation on every render
  const baseMemories = useMemo(() => {
    return view === 'resurfacing' ? resurfacing : memories
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

  // Keep the scroll listener's notion of total in sync without forcing
  // it to depend on displayMemories (would re-create the listener every
  // time the list changed). Set on every render — cheap.
  totalCountRef.current = displayMemories.length

  // Pinned thoughts  shown as a horizontal row above the main grid
  const pinnedMemories = useMemo(() => {
    return memories.filter(m => m.is_pinned)
  }, [memories])

  const isFiltered = searchQuery.trim().length > 0 || activeTags.length > 0

  const isLoading = view === 'resurfacing' ? loadingResurfacing : loading

  return (
    <>
      <SubtleBackground />
      {/* Editorial header — Day One language. Serif title, hairline rule,
          quiet count. Tools sit beside the title, not above it. */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-12 pb-2 flex flex-col gap-3">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="page-hero">Your thoughts.</h1>
              <div className="page-eyebrow">{memories.length} captured</div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {view !== 'resurfacing' && <CreateMemoryDialog />}
              <button
                onClick={() => navigate('/search')}
                className="h-10 w-10 rounded-full flex items-center justify-center transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.12), rgba(var(--brand-primary-rgb),0.04))',
                  border: '1px solid rgba(var(--brand-primary-rgb),0.22)',
                  color: 'rgb(var(--brand-primary-rgb))',
                }}
                title="Search everything"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Morning Follow-Up */}
          {showMorningFollowUp && (
            <MorningFollowUp
              onDismiss={() => setShowMorningFollowUp(false)}
              onCapture={(text) => {
                createMemory({ title: 'Morning insight', body: text, memory_type: 'insight', tags: ['morning-followup', 'bedtime-synthesis'] }).catch(console.error)
              }}
            />
          )}

          {/* Drift Mode button — after 9pm becomes Bedtime Mode (sleep variant) */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleOpenDrift}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(var(--brand-primary-rgb),0.06)', border: '1px solid rgba(var(--brand-primary-rgb),0.12)', color: 'rgba(var(--brand-primary-rgb),0.8)' }}
            >
              {isAfterBedtime ? (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  Bedtime Mode — wind down
                </>
              ) : (
                <>
                  <Wind className="h-3.5 w-3.5" />
                  Drift Mode — mental reset
                </>
              )}
            </button>
            {/* Cross-link to bedtime — small & unobtrusive */}
            <Link
              to="/bedtime"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] transition-opacity hover:opacity-100"
              style={{ color: 'rgba(var(--brand-primary-rgb),0.55)', opacity: 0.75 }}
            >
              <Moon className="h-3 w-3" />
              bedtime
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <PremiumTabs
              tabs={[
                { id: 'recent', label: `Thoughts (${memories.length})` },
                { id: 'themes', label: 'Themes' },
                { id: 'resurfacing', label: `Resurface (${resurfacing.length})` },
              ]}
              activeTab={view}
              onChange={(tabId) => setView(tabId as typeof view)}
              className="flex-nowrap"
            />
          </div>
        </div>

      <div className="pb-32 relative z-10" style={{ isolation: 'isolate' }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-6 pt-2">
          {/* Open spread — no nested shadow box. Memories breathe on the
              page background. Day One scrapbook feel, not "premium card." */}
          <div className="mb-6 w-full max-w-full">

            {/* Search — Dia central input, soft and quiet */}
            {(view === 'recent' || view === 'themes') && (
              <div className="mb-5 space-y-3">
                <div className="relative">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none opacity-60"
                    style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search your thoughts…"
                    className="soft-input pl-11 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full transition-colors hover:bg-white/[0.04]"
                      style={{ color: 'var(--brand-text-muted)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isFiltered && (
                  <p className="text-[10px] uppercase tracking-[0.28em] opacity-70" style={{ color: 'rgb(var(--brand-primary-rgb))' }}>
                    {displayMemories.length} of {memories.length}
                  </p>
                )}

                {/* Tag pills — refined, no shadows or bold caps */}
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
                          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide transition-all min-h-[34px]"
                          style={{
                            background: isActive ? 'rgba(var(--brand-primary-rgb),0.14)' : 'rgba(255,255,255,0.03)',
                            border: isActive ? '1px solid rgba(var(--brand-primary-rgb),0.4)' : '1px solid rgba(255,255,255,0.06)',
                            color: isActive ? 'rgb(var(--brand-primary-rgb))' : 'var(--brand-text-muted)',
                          }}
                        >
                          <Tag className="h-3 w-3" />
                          {tag}
                        </button>
                      )
                    })}
                    {activeTags.length > 0 && (
                      <button
                        onClick={() => setActiveTags([])}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] tracking-wide transition-all min-h-[34px] opacity-70 hover:opacity-100"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'var(--brand-text-muted)',
                        }}
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Inner Content */}
            <div>
              {/* On This Day — Day One-style resurfacing eyebrow */}
              {view === 'resurfacing' && resurfacing.length > 0 && (
                <div className="mb-8">
                  <div className="page-eyebrow mt-0 mb-2">Worth a second look</div>
                  <p className="meta-serif">
                    Older thoughts surfacing again. Mark them reviewed when you're done.
                  </p>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="mb-6 rounded-lg p-4 sm:p-5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 0 20px rgba(239,68,68,0.1)' }}>
                  <p className="text-sm text-brand-text-secondary">{error}</p>
                </div>
              )}

              {/* Follow-up suggestions from onboarding analysis */}

              {/* Recent Memories Tab */}
              {view === 'recent' && (
                <>
                  <SuggestedPrompts />

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
                  {(view === 'recent' || view === 'themes') && isFiltered ? (
                    /* Search returned no results */
                    <div className="max-w-xs mx-auto space-y-4">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full"
                        style={{ background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
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
                        style={{ background: 'rgba(var(--brand-primary-rgb),0.1)', border: '1px solid rgba(var(--brand-primary-rgb),0.25)', color: 'var(--brand-primary)' }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear filters
                      </button>
                    </div>
                  ) : (view === 'recent' || view === 'themes') ? (
                    /* No memories at all — rich inspirational state */
                    <div className="max-w-sm mx-auto">
                      {/* Decorative orb */}
                      <div className="relative mx-auto w-28 h-28 mb-8">
                        <div className="absolute inset-0 rounded-full opacity-20 blur-2xl" style={{ background: 'radial-gradient(circle, var(--brand-primary), transparent)' }} />
                        <div className="relative flex items-center justify-center w-28 h-28 rounded-full"
                          style={{ background: 'radial-gradient(circle at 35% 35%, rgba(var(--brand-primary-rgb),0.15), rgba(var(--brand-primary-rgb),0.08))', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
                          <Brain className="h-10 w-10 text-brand-primary opacity-60" />
                        </div>
                      </div>

                      <h3 className="page-hero-sm mb-3">Every great idea starts here.</h3>
                      <p className="meta-serif mb-8">
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
                            style={{ background: 'rgba(var(--brand-primary-rgb),0.05)', border: '1px solid rgba(var(--brand-primary-rgb),0.1)' }}>
                            <span className="text-brand-primary opacity-50 mt-0.5 text-xs">-</span>
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
                        style={{ background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}>
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

              {/* Theme Clusters View */}
              {view === 'themes' && !isLoading && memories.length > 0 && (
                <>
                  {/* Theme cluster detail view */}
                  {selectedCluster && (
                    <div className="mb-8">
                      <button
                        onClick={() => setSelectedCluster(null)}
                        className="mb-6 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
                        style={{
                          background: 'rgba(var(--brand-primary-rgb),0.08)',
                          color: "var(--brand-text-secondary)",
                          border: '1.5px solid rgba(var(--brand-primary-rgb),0.25)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        }}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Themes
                      </button>
                      <h2 className="text-xl font-black mb-6 flex items-center gap-3 uppercase tracking-wide" style={{ color: "var(--brand-primary)" }}>
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{
                            background: 'rgba(var(--brand-primary-rgb),0.12)',
                            border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
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
                  {!selectedCluster && (
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
                        <div className="p-6 rounded-lg text-center" style={{ background: 'var(--brand-glass-bg)', border: '1px solid var(--glass-surface-hover)', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }}>
                          <p className="text-xs" style={{ color: "var(--brand-primary)" }}>No themes detected yet. Add more thoughts with diverse topics!</p>
                        </div>
                      )}
                    </>
                  )}

                </>
              )}

              {/* Recent memories view - Google Keep Style Masonry (Across then Down) */}
              {view === 'recent' && !isLoading && memories.length > 0 && (
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
                          background: 'var(--brand-glass-bg)',
                          border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
                          borderLeft: '4px solid rgba(var(--brand-primary-rgb),0.6)',
                          boxShadow: '0 0 20px rgba(var(--brand-primary-rgb),0.08)',
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
                              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                            }}
                          >
                            Dismiss
                          </button>
                          <button
                            onClick={() => handleOpenDetail(resurfacedMemory)}
                            className="text-[10px] px-3 py-1.5 rounded-lg font-black uppercase tracking-wide transition-colors"
                            style={{
                              background: 'rgba(var(--brand-primary-rgb),0.12)',
                              border: '1.5px solid rgba(var(--brand-primary-rgb),0.4)',
                              color: "var(--brand-text-secondary)",
                              boxShadow: '0 0 12px rgba(var(--brand-primary-rgb),0.1)',
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
                      <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 sm:-mx-1 sm:px-1 scrollbar-hide snap-x snap-mandatory">
                        {pinnedMemories.map((memory) => (
                          <motion.div
                            key={memory.id}
                            onClick={() => handleOpenDetail(memory)}
                            whileHover={{ y: -2 }}
                            className="flex-shrink-0 w-[68vw] max-w-[260px] sm:w-56 rounded-xl p-3.5 cursor-pointer transition-all snap-start"
                            style={{
                              background: 'linear-gradient(135deg, var(--glass-surface-hover) 0%, var(--glass-surface) 100%)',
                              boxShadow: 'inset 0 0 0 1px rgba(var(--brand-primary-rgb),0.25), 0 4px 12px rgba(0,0,0,0.3)',
                              borderTop: '2px solid rgba(var(--brand-primary-rgb),0.5)',
                            }}
                          >
                            <h4 className="text-sm font-semibold truncate mb-1.5 text-[var(--brand-text-primary)]">
                              {memory.title}
                            </h4>
                            {memory.checklist_items && memory.checklist_items.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {memory.checklist_items.slice(0, 3).map((item) => (
                                  <div key={item.id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--brand-text-secondary)', opacity: item.checked ? 0.5 : 0.95 }}>
                                    <span className="w-3 h-3 rounded-sm border flex-shrink-0" style={{ borderColor: item.checked ? 'var(--brand-primary)' : 'rgba(255,255,255,0.3)', background: item.checked ? 'var(--brand-primary)' : 'transparent' }} />
                                    <span style={{ textDecoration: item.checked ? 'line-through' : 'none' }} className="truncate">{item.text}</span>
                                  </div>
                                ))}
                                {memory.checklist_items.length > 3 && (
                                  <span className="text-[11px] mt-0.5" style={{ color: 'var(--brand-text-muted)' }}>+{memory.checklist_items.length - 3} more</span>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs line-clamp-3 leading-relaxed" style={{ color: "var(--brand-text-secondary)" }}>
                                {memory.body}
                              </p>
                            )}
                            <span className="text-[11px] mt-2 block font-medium" style={{ color: "var(--brand-primary)" }}>
                              {new Date(memory.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  <MasonryGrid memories={displayMemories.slice(0, visibleCount)} onEdit={handleOpenDetail} onDelete={handleDelete} />
                  {visibleCount < displayMemories.length && (
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                      <span className="text-xs opacity-50" style={{ color: 'var(--brand-text-muted)' }}>
                        showing {visibleCount} of {displayMemories.length}
                      </span>
                      {/* Manual button fallback. The window-scroll listener
                          handles auto-loading; this is for users who'd rather
                          tap, or for cases where the scroll listener somehow
                          doesn't fire. */}
                      <button
                        type="button"
                        onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                        className="text-[10px] tracking-[0.2em] uppercase opacity-60 hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full border"
                        style={{ color: 'var(--brand-text-secondary)', borderColor: 'var(--glass-surface)' }}
                      >
                        load more
                      </button>
                    </div>
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

      {/* Drift Mode Overlay */}
      {driftModeOpen && (
        <DriftMode mode={driftVariant} prompts={driftPrompts} onClose={() => setDriftModeOpen(false)} />
      )}
    </>
  )
}
