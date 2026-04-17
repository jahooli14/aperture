import React, { useEffect, useState, useRef } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, GripVertical, ListOrdered, Check, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthContext'
import { SignInNudge } from '../components/SignInNudge'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { CreateListDialog } from '../components/lists/CreateListDialog'
import { QuickAddSheet } from '../components/lists/QuickAddSheet'
import { OptimizedImage } from '../components/ui/optimized-image'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import type { ListType, List } from '../types'
import { ListIcon, ListColor, ListGradient } from '../lib/listTheme'

// Returns true if the list had an item added within the last 3 days
const isRecentlyUpdated = (list: List) => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
    return new Date(list.updated_at).getTime() > threeDaysAgo
}

// Inspirational empty state example collections
const EXAMPLE_COLLECTIONS = [
    { type: 'film' as ListType, label: 'Films to Watch', desc: 'Your personal cinema queue' },
    { type: 'book' as ListType, label: 'Reading List', desc: 'Books to devour this year' },
    { type: 'music' as ListType, label: 'Albums', desc: 'Music that moves you' },
    { type: 'place' as ListType, label: 'Places to Visit', desc: 'Your world-shaped bucket list' },
    { type: 'quote' as ListType, label: 'Phrases', desc: 'Words that live rent-free' },
    { type: 'game' as ListType, label: 'Games', desc: 'Adventures waiting to be had' },
]

export default function ListsPage() {
    const { isAuthenticated, loading: authLoading } = useAuthContext()

    if (!authLoading && !isAuthenticated) {
      return (
        <div style={{ backgroundColor: 'var(--brand-bg)' }} className="min-h-screen pt-12">
          <SignInNudge variant="lists" />
        </div>
      )
    }

    const navigate = useNavigate()
    const { lists, fetchLists, reorderLists, loading } = useListStore()
    const [createOpen, setCreateOpen] = useState(false)
    const [listCovers, setListCovers] = useState<Record<string, string>>({})
    const [quoteCovers, setQuoteCovers] = useState<Record<string, string>>({})
    const [initialLoad, setInitialLoad] = useState(true)
    const [isReordering, setIsReordering] = useState(false)

    // Quick-add sheet state
    const [quickAddList, setQuickAddList] = useState<List | null>(null)
    // Long-press action sheet state
    const [actionSheetList, setActionSheetList] = useState<List | null>(null)

    const { confirm, dialog: confirmDialog } = useConfirmDialog()

    // Long-press detection
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressActivated = useRef(false)

    useEffect(() => {
        fetchLists().finally(() => setInitialLoad(false))
    }, [])

    // Optimized cover fetching with backend, IndexedDB caching and parallelization
    useEffect(() => {
        const fetchCovers = async () => {
            const { readingDb } = await import('../lib/db')

            // Step 0: Extract covers from backend response (fastest path)
            const backendCovers: Record<string, string> = {}
            const backendQuotes: Record<string, string> = {}

            lists.forEach(list => {
                if (list.cover_image) {
                    if (list.type === 'quote') {
                        backendQuotes[list.id] = list.cover_image
                    } else {
                        backendCovers[list.id] = list.cover_image
                    }
                }
            })

            // Step 1: Load all covers from cache for lists without backend covers
            const cachedCovers: Record<string, string> = { ...backendCovers }
            const cachedQuotes: Record<string, string> = { ...backendQuotes }

            const allCachedCovers = await readingDb.getAllCachedListCoverImages()
            allCachedCovers.forEach(cover => {
                if (cover.image_type === 'quote' && !cachedQuotes[cover.list_id]) {
                    cachedQuotes[cover.list_id] = cover.image_url
                } else if (!cachedCovers[cover.list_id]) {
                    cachedCovers[cover.list_id] = cover.image_url
                }
            })

            // Set covers immediately for instant load
            setListCovers(cachedCovers)
            setQuoteCovers(cachedQuotes)

            // Step 2: Identify lists that need cover fetching (no backend, no cache)
            const missingLists = lists.filter(list =>
                !cachedCovers[list.id] && !cachedQuotes[list.id]
            )

            if (missingLists.length === 0) return

            // Step 3: Fetch missing covers in parallel (not sequential!)
            const coverPromises = missingLists.map(async (list) => {
                try {
                    // First try to extract from cached list items (zero network cost)
                    const cachedItems = await readingDb.getCachedListItems(list.id)

                    if (list.type === 'quote' && cachedItems.length > 0) {
                        const shortestPhrase = cachedItems.reduce((shortest, item) =>
                            !shortest || item.content.length < shortest.content.length ? item : shortest
                        )
                        await readingDb.cacheListCoverImage(list.id, shortestPhrase.content, 'quote')
                        return { listId: list.id, quote: shortestPhrase.content }
                    } else if (cachedItems.length > 0) {
                        const itemWithImage = cachedItems.find((item) =>
                            item.metadata?.image && typeof item.metadata.image === 'string' && item.metadata.image.trim() !== ''
                        )
                        if (itemWithImage?.metadata?.image) {
                            await readingDb.cacheListCoverImage(list.id, itemWithImage.metadata.image, 'image')
                            return { listId: list.id, image: itemWithImage.metadata.image }
                        }
                    }

                    // Only fetch from API if not in cache (fallback)
                    const response = await fetch(`/api/list-items?listId=${list.id}&limit=50`)
                    if (!response.ok) return null

                    const items = await response.json()

                    if (list.type === 'quote' && items.length > 0) {
                        const shortestPhrase = items.reduce((shortest: any, item: any) =>
                            !shortest || item.content.length < shortest.content.length ? item : shortest
                        , null)
                        if (shortestPhrase) {
                            await readingDb.cacheListCoverImage(list.id, shortestPhrase.content, 'quote')
                            return { listId: list.id, quote: shortestPhrase.content }
                        }
                    } else {
                        const itemWithImage = items.find((item: any) =>
                            item.metadata?.image && typeof item.metadata.image === 'string' && item.metadata.image.trim() !== ''
                        )
                        if (itemWithImage?.metadata?.image) {
                            await readingDb.cacheListCoverImage(list.id, itemWithImage.metadata.image, 'image')
                            return { listId: list.id, image: itemWithImage.metadata.image }
                        }
                    }
                } catch (error) {
                    console.error(`Failed to fetch cover for list ${list.id}:`, error)
                    return null
                }
            })

            // Wait for all fetches to complete in parallel
            const results = await Promise.all(coverPromises)

            // Step 4: Update state with newly fetched covers
            const newCovers: Record<string, string> = { ...cachedCovers }
            const newQuotes: Record<string, string> = { ...cachedQuotes }

            results.forEach(result => {
                if (!result) return
                if (result.image) newCovers[result.listId] = result.image
                if (result.quote) newQuotes[result.listId] = result.quote
            })

            setListCovers(newCovers)
            setQuoteCovers(newQuotes)
        }

        if (lists.length > 0) {
            fetchCovers()
        }
    }, [lists.map(l => l.id).join(',')]) // Only re-run when list IDs change, not on reorder/title changes

    const handleReorder = (newOrder: any[]) => {
        reorderLists(newOrder.map(l => l.id))
    }

    // Long press handlers - show action sheet
    const handlePointerDown = (list: List) => (e: React.PointerEvent) => {
        if (isReordering) return
        longPressActivated.current = false
        longPressTimer.current = setTimeout(() => {
            longPressActivated.current = true
            setActionSheetList(list)
        }, 500)
    }

    const handlePointerUp = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    const handlePointerCancel = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }

    const handleCardClick = (list: List) => {
        if (longPressActivated.current) return
        // Fix Queue has its own dedicated page
        if (list.type === 'fix') {
            navigate('/fixes')
            return
        }
        navigate(`/lists/${list.id}`)
    }

    return (
        <div className="min-h-screen pb-32 pt-8 sm:pt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto aperture-shelf overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <h1 className="text-[2rem] sm:text-4xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-[0.95]">
                        your <span className="page-accent">collections</span>
                    </h1>
                    <p className="section-subtitle mt-1 text-sm sm:text-base">The stuff you love, curated.</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <button
                        onClick={() => navigate('/favourites')}
                        title="Favourites"
                        className="flex items-center justify-center h-11 w-11 rounded-xl hover:bg-[var(--glass-surface)] bg-[var(--glass-surface)] text-[var(--brand-primary)] transition-all"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        <Star className="h-5 w-5" />
                    </button>
                    {lists.length > 0 && (
                        <button
                            onClick={() => setIsReordering(!isReordering)}
                            className={`flex items-center justify-center h-11 w-11 rounded-xl transition-all ${
                                isReordering
                                    ? 'text-[var(--brand-primary)]'
                                    : 'text-[var(--brand-text-primary)] hover:bg-[var(--glass-surface)]'
                            }`}
                            style={isReordering
                                ? { border: '1px solid rgba(125,211,252,0.5)', background: 'rgba(125,211,252,0.15)' }
                                : { border: '1px solid rgba(255,255,255,0.1)', background: 'var(--glass-surface)' }
                            }
                            title={isReordering ? 'Done reordering' : 'Reorder lists'}
                        >
                            {isReordering ? <Check className="h-5 w-5" /> : <ListOrdered className="h-5 w-5" />}
                        </button>
                    )}
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="h-11 w-11 p-0 rounded-xl hover:bg-[var(--glass-surface)] bg-[var(--glass-surface)] text-[var(--brand-primary)]"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        <Plus className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Loading State - Show skeleton cards while loading */}
            {initialLoad && loading && lists.length === 0 && (
                <div className="grid gap-3 pb-20" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}>
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={`skeleton-${i}`}
                            className="overflow-hidden rounded-2xl bg-zinc-900/40"
                            style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface)' }}
                        >
                            <div className="aspect-[3/4] shimmer" />
                        </div>
                    ))}
                </div>
            )}

            {/* Enhanced Empty State */}
            {!loading && lists.length === 0 && !initialLoad && (
                <div className="pt-4 pb-20">
                    {/* Hero empty state */}
                    <div className="text-center py-10 px-4 mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/10 mb-6"
                            style={{ boxShadow: 'inset 0 0 0 1px rgba(56,189,248,0.15)' }}>
                            <ListOrdered className="h-8 w-8 text-brand-primary" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-[var(--brand-text-primary)] mb-2">Start a collection</h3>
                        <p className="text-sm text-brand-text-muted mb-8 max-w-xs mx-auto leading-relaxed">
                            Every great collection starts with one item. What are you keeping track of?
                        </p>
                        <Button
                            onClick={() => setCreateOpen(true)}
                            className="h-11 px-6 rounded-full border border-[var(--glass-surface-hover)] hover:bg-[var(--glass-surface)] bg-transparent text-[var(--brand-text-primary)] font-bold uppercase tracking-widest text-xs"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Create First Collection
                        </Button>
                    </div>

                    {/* Example collections grid */}
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-4 text-center">
                            Some ideas to get you started
                        </p>
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))' }}>
                            {EXAMPLE_COLLECTIONS.map((example) => {
                                const rgb = ListColor(example.type)
                                return (
                                    <button
                                        key={example.type}
                                        onClick={() => setCreateOpen(true)}
                                        className="group relative overflow-hidden rounded-2xl cursor-pointer text-left"
                                        style={{
                                            boxShadow: `inset 0 0 0 1px rgba(${rgb}, 0.12), 0 4px 12px rgba(0,0,0,0.25)`
                                        }}
                                    >
                                        <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950/80">
                                            <div className={`absolute inset-0 bg-gradient-to-br ${ListGradient(example.type)} opacity-25`} />
                                            {/* Background icon */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] scale-150">
                                                <ListIcon type={example.type} className="h-48 w-48" style={{ color: `rgb(${rgb})` }} />
                                            </div>
                                            {/* Center icon */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="p-6 rounded-full bg-white/[0.04]"
                                                    style={{ boxShadow: `inset 0 0 0 1px rgba(${rgb}, 0.2)` }}>
                                                    <ListIcon type={example.type} className="h-8 w-8" style={{ color: `rgb(${rgb})` }} />
                                                </div>
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-70" />
                                        </div>
                                        {/* Text overlay */}
                                        <div className="absolute inset-0 p-3 flex flex-col justify-end">
                                            <p className="text-[8px] font-black uppercase tracking-wider mb-0.5"
                                                style={{ color: `rgb(${rgb})` }}>{example.type}</p>
                                            <h4 className="text-xs font-black text-[var(--brand-text-primary)] uppercase tracking-tight leading-tight">{example.label}</h4>
                                            <p className="text-[8px] text-[var(--brand-text-primary)]/30 mt-0.5">{example.desc}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Reordering Mode - Vertical list with drag handles */}
            {lists.length > 0 && isReordering && (
                <Reorder.Group
                    axis="y"
                    values={lists}
                    onReorder={handleReorder}
                    className="space-y-3 pb-20"
                >
                {lists.map((list) => {
                    const rgb = ListColor(list.type)
                    const coverImage = listCovers[list.id]
                    const quoteCover = quoteCovers[list.id]
                    const recentlyUpdated = isRecentlyUpdated(list)

                    return (
                        <Reorder.Item
                            key={list.id}
                            value={list}
                            className="flex items-center gap-4 bg-zinc-900/60 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:bg-zinc-900/80 transition-colors"
                            style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}
                        >
                            <GripVertical className="h-5 w-5 text-zinc-600 flex-shrink-0" />

                            {/* Thumbnail */}
                            <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-950 flex-shrink-0">
                                {coverImage && coverImage.trim() !== '' ? (
                                    <OptimizedImage
                                        src={coverImage}
                                        alt={list.title}
                                        className="w-full h-full"
                                        priority={false}
                                    />
                                ) : quoteCover ? (
                                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-1">
                                        <p className="text-[var(--brand-text-primary)]/60 text-[8px] font-light text-center line-clamp-4" style={{ fontFamily: 'Georgia, serif' }}>
                                            {quoteCover}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ListIcon type={list.type} className="h-6 w-6 opacity-20" style={{ color: `rgb(${rgb})` }} />
                                    </div>
                                )}
                            </div>

                            {/* List Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <ListIcon type={list.type} className="h-3 w-3 flex-shrink-0" style={{ color: `rgb(${rgb})` }} />
                                    <h3 className="text-sm font-black text-[var(--brand-text-primary)] uppercase tracking-tight truncate">
                                        {list.title}
                                    </h3>
                                    {recentlyUpdated && (
                                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: `rgb(${rgb})` }} />
                                    )}
                                </div>
                                <p className="text-[9px] font-bold text-[var(--brand-text-primary)]/40 uppercase tracking-widest">
                                    {list.item_count || 0} ITEMS
                                </p>
                            </div>
                        </Reorder.Item>
                    )
                })}
                </Reorder.Group>
            )}

            {/* Normal Mode - Responsive Grid */}
            {lists.length > 0 && !isReordering && (
                <div className="grid gap-3 pb-20" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, calc(50% - 6px)), 1fr))' }}>
                {lists.map((list) => {
                    const rgb = ListColor(list.type)
                    const coverImage = listCovers[list.id]
                    const quoteCover = quoteCovers[list.id]
                    const recentlyUpdated = isRecentlyUpdated(list)
                    const itemCount = list.item_count || 0

                    return (
                        <motion.div
                            key={list.id}
                            layoutId={list.id}
                            onClick={() => handleCardClick(list)}
                            onPointerDown={handlePointerDown(list)}
                            onPointerUp={handlePointerUp}
                            onPointerCancel={handlePointerCancel}
                            className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 bg-zinc-900/40 select-none"
                            style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface), 0 4px 12px rgba(0,0,0,0.3)' }}
                            whileHover={{ y: -2 }}
                        >
                            {/* Poster / Cover Image / Quote Cover */}
                            <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950">
                                {coverImage && coverImage.trim() !== '' ? (
                                    <OptimizedImage
                                        src={coverImage}
                                        alt={list.title}
                                        className="w-full h-full"
                                        priority={false}
                                        sizes="(max-width: 768px) 50vw, 25vw"
                                    />
                                ) : quoteCover ? (
                                    // Beautiful quote cover with shortest phrase
                                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-black p-6">
                                        {/* Simple gradient background */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${ListGradient(list.type)} opacity-40`} />

                                        {/* Minimal decorative elements */}
                                        <div className="absolute top-4 right-4 text-6xl font-serif text-[var(--brand-text-primary)]/[0.03] select-none leading-none">"</div>
                                        <div className="absolute bottom-4 left-4 text-6xl font-serif text-[var(--brand-text-primary)]/[0.03] select-none leading-none">"</div>

                                        {/* The phrase - centered and beautiful */}
                                        <div className="relative z-10 flex flex-col items-center justify-center text-center">
                                            <p className="text-[var(--brand-text-primary)]/90 font-light text-lg sm:text-xl leading-relaxed tracking-wide px-2"
                                                style={{
                                                    fontFamily: 'Georgia, serif',
                                                    textShadow: `0 2px 20px rgba(${rgb}, 0.3)`,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 6,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                {quoteCover}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    // Empty list fallback
                                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
                                        {/* Single gradient background */}
                                        <div className={`absolute inset-0 bg-gradient-to-br ${ListGradient(list.type)} opacity-30`} />

                                        {/* Simple geometric pattern */}
                                        <div className="absolute inset-0 opacity-[0.02]" style={{
                                            backgroundImage: `linear-gradient(rgba(${rgb}, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(${rgb}, 0.5) 1px, transparent 1px)`,
                                            backgroundSize: '40px 40px'
                                        }} />

                                        {/* Single background icon */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.05] scale-150">
                                            <ListIcon type={list.type} className="h-64 w-64" style={{ color: `rgb(${rgb})` }} />
                                        </div>

                                        {/* Main Icon */}
                                        <div className="relative z-10 flex flex-col items-center gap-3">
                                            <div className="relative p-6 rounded-full bg-[var(--glass-surface)] transition-all duration-300" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
                                                <ListIcon type={list.type} className="h-10 w-10" style={{ color: `rgb(${rgb})` }} />
                                            </div>
                                            <div className="text-xs font-semibold text-[var(--brand-text-primary)]/50 text-center px-2 leading-tight">
                                                {list.title}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
                            </div>

                            {/* Overlay Content */}
                            <div className="absolute inset-0 p-2.5 flex flex-col justify-between">
                                <div className="flex items-start justify-between gap-1.5">
                                    <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-black/70 backdrop-blur-sm" style={{ border: `1px solid rgba(${rgb}, 0.4)` }}>
                                        <ListIcon type={list.type} className="h-3 w-3" style={{ color: `rgb(${rgb})` }} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text-primary)]">
                                            {list.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {/* Quick add button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setQuickAddList(list)
                                            }}
                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-black/70 backdrop-blur-sm text-[var(--brand-text-primary)] transition-all"
                                            style={{ border: `1px solid rgba(${rgb}, 0.4)` }}
                                            title="Quick add"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-sm font-black text-[var(--brand-text-primary)] uppercase tracking-tight leading-tight group-hover:text-brand-primary transition-colors line-clamp-2"
                                            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.8)' }}>
                                            {list.title}
                                        </h3>
                                        {/* Recently updated dot */}
                                        {recentlyUpdated && (
                                            <span
                                                className="h-2 w-2 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: `rgb(${rgb})`, boxShadow: `0 0 6px rgb(${rgb})` }}
                                                title="Recently updated"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {/* Item count badge */}
                                        <div className="flex items-center gap-1">
                                            <span className="text-[11px] font-bold uppercase tracking-widest"
                                                style={{
                                                    color: itemCount > 0 ? `rgb(${rgb})` : 'rgba(255,255,255,0.55)',
                                                    textShadow: '0 1px 3px rgba(0,0,0,0.95)'
                                                }}>
                                                {itemCount > 0 ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'empty'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )
                })}
                </div>
            )}

            {/* Long press hint - only show when there are lists and not reordering */}
            {lists.length > 0 && !isReordering && (
                <p className="text-center text-[9px] font-bold uppercase tracking-widest text-zinc-700 pb-4">
                    Hold card for options
                </p>
            )}

            <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />

            {/* Quick Add Sheet */}
            {quickAddList && (
                <QuickAddSheet
                    list={quickAddList}
                    isOpen={!!quickAddList}
                    onClose={() => setQuickAddList(null)}
                    listRgb={ListColor(quickAddList.type)}
                />
            )}

            {/* Long-press Action Sheet */}
            <AnimatePresence>
                {actionSheetList && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                            onClick={() => setActionSheetList(null)}
                        />
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
                            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl pb-safe"
                            style={{
                                backgroundColor: 'var(--glass-surface)',
                                boxShadow: '0 -20px 60px rgba(0,0,0,0.6), inset 0 1px 0 var(--glass-surface-hover)'
                            }}
                        >
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-white/15" />
                            </div>
                            <div className="px-5 pt-3 pb-8">
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1"
                                    style={{ color: `rgb(${ListColor(actionSheetList.type)})` }}>
                                    {actionSheetList.type}
                                </p>
                                <h3 className="text-base font-black text-[var(--brand-text-primary)] uppercase tracking-tight mb-5">
                                    {actionSheetList.title}
                                </h3>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            const list = actionSheetList
                                            setActionSheetList(null)
                                            setQuickAddList(list)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-[var(--glass-surface)]"
                                        style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}
                                    >
                                        <Plus className="h-4 w-4 text-brand-primary" />
                                        <span className="text-sm font-bold text-[var(--brand-text-primary)] uppercase tracking-widest">Quick Add</span>
                                    </button>
                                    <button
                                        onClick={async () => {
                                            const listToDelete = actionSheetList
                                            setActionSheetList(null)
                                            const confirmed = await confirm({
                                                title: `Delete "${listToDelete.title}"?`,
                                                description: 'This collection and all its items will be removed.',
                                                confirmText: 'Delete',
                                                variant: 'destructive',
                                            })
                                            if (confirmed) {
                                                useListStore.getState().deleteList(listToDelete.id)
                                            }
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-red-500/10"
                                        style={{ boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.15)' }}
                                    >
                                        <Trash2 className="h-4 w-4 text-red-400" />
                                        <span className="text-sm font-bold text-red-400 uppercase tracking-widest">Delete Collection</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {confirmDialog}
        </div>
    )
}
