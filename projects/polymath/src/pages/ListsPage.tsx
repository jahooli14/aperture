import React, { useEffect, useState, useRef } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
import { Plus, Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Quote, FileText, Trash2, GripVertical, ListOrdered, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { CreateListDialog } from '../components/lists/CreateListDialog'
import { QuickAddSheet } from '../components/lists/QuickAddSheet'
import { OptimizedImage } from '../components/ui/optimized-image'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import type { ListType, List } from '../types'

const ListIcon = ({ type, className, style }: { type: ListType, className?: string, style?: React.CSSProperties }) => {
    switch (type) {
        case 'film': return <Film className={className} style={style} />
        case 'music': return <Music className={className} style={style} />
        case 'tech': return <Monitor className={className} style={style} />
        case 'book': return <Book className={className} style={style} />
        case 'place': return <MapPin className={className} style={style} />
        case 'game': return <Gamepad2 className={className} style={style} />
        case 'software': return <Box className={className} style={style} />
        case 'event': return <Calendar className={className} style={style} />
        case 'quote': return <Quote className={className} style={style} />
        case 'article': return <FileText className={className} style={style} />
        default: return <Box className={className} style={style} />
    }
}

const ListColor = (type: ListType) => {
    switch (type) {
        case 'film': return '239, 68, 68' // Red
        case 'music': return '236, 72, 153' // Pink
        case 'tech': return '59, 130, 246' // Blue
        case 'book': return '245, 158, 11' // Amber
        case 'place': return '16, 185, 129' // Emerald
        case 'game': return '139, 92, 246' // Violet
        case 'quote': return '167, 139, 250' // Violet-light
        case 'event': return '251, 146, 60' // Orange
        case 'software': return '34, 211, 238' // Cyan
        case 'article': return '251, 191, 36' // Amber
        default: return '148, 163, 184' // Slate
    }
}

const ListGradient = (type: ListType) => {
    switch (type) {
        case 'film': return 'from-red-500/20 via-pink-500/10 to-purple-500/20'
        case 'music': return 'from-pink-500/20 via-fuchsia-500/10 to-violet-500/20'
        case 'tech': return 'from-blue-500/20 via-cyan-500/10 to-sky-500/20'
        case 'book': return 'from-amber-500/20 via-yellow-500/10 to-orange-500/20'
        case 'place': return 'from-emerald-500/20 via-teal-500/10 to-green-500/20'
        case 'game': return 'from-violet-500/20 via-purple-500/10 to-indigo-500/20'
        case 'quote': return 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/20'
        case 'event': return 'from-orange-500/20 via-amber-500/10 to-yellow-500/20'
        case 'software': return 'from-cyan-500/20 via-blue-500/10 to-indigo-500/20'
        case 'article': return 'from-amber-500/20 via-yellow-500/10 to-orange-500/20'
        default: return 'from-slate-500/20 via-gray-500/10 to-zinc-500/20'
    }
}

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
    const navigate = useNavigate()
    const { lists, fetchLists, reorderLists, loading } = useListStore()
    const [createOpen, setCreateOpen] = useState(false)
    const [listCovers, setListCovers] = useState<Record<string, string>>({})
    const [quoteCovers, setQuoteCovers] = useState<Record<string, string>>({})
    const [initialLoad, setInitialLoad] = useState(true)
    const [isReordering, setIsReordering] = useState(false)

    // Quick-add sheet state
    const [quickAddList, setQuickAddList] = useState<List | null>(null)

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

    // Long press handlers for quick add
    const handlePointerDown = (list: List) => (e: React.PointerEvent) => {
        if (isReordering) return
        longPressActivated.current = false
        longPressTimer.current = setTimeout(() => {
            longPressActivated.current = true
            setQuickAddList(list)
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
        navigate(`/lists/${list.id}`)
    }

    return (
        <div className="min-h-screen pb-32 pt-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto aperture-shelf overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-[var(--brand-text-primary)] leading-none">
                        your <span className="text-brand-primary">collections</span>
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted mt-1">Curate your existence.</p>
                </div>
                <div className="flex items-center gap-2">
                    {lists.length > 0 && (
                        <button
                            onClick={() => setIsReordering(!isReordering)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                                isReordering
                                    ? 'bg-brand-primary text-[var(--brand-text-primary)] rounded-lg'
                                    : 'text-[var(--brand-text-primary)] hover:bg-[var(--glass-surface)] rounded-lg'
                            }`}
                            style={isReordering
                                ? { border: '2px solid rgba(125,211,252,0.5)' }
                                : { border: '2px solid rgba(255,255,255,0.1)' }
                            }
                        >
                            {isReordering ? <Check className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {isReordering ? 'Done' : 'Order'}
                            </span>
                        </button>
                    )}
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="h-10 w-10 p-0 rounded-lg hover:bg-[var(--glass-surface)] bg-transparent text-[var(--brand-text-primary)]"
                        style={{ border: '2px solid rgba(255,255,255,0.1)' }}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Loading State - Show skeleton cards while loading */}
            {initialLoad && loading && lists.length === 0 && (
                <div className="flex flex-wrap gap-3 pb-20">
                    {[1, 2, 3, 4].map((i) => (
                        <div
                            key={`skeleton-${i}`}
                            className="overflow-hidden rounded-2xl bg-zinc-900/40"
                            style={{ width: 'calc(50% - 6px)', boxShadow: 'inset 0 0 0 1px var(--glass-surface)' }}
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
                            <Box className="h-8 w-8 text-brand-primary" />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-[var(--brand-text-primary)] mb-2">Your trophy cabinet awaits</h3>
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
                        <div className="flex flex-wrap gap-3">
                            {EXAMPLE_COLLECTIONS.map((example) => {
                                const rgb = ListColor(example.type)
                                return (
                                    <button
                                        key={example.type}
                                        onClick={() => setCreateOpen(true)}
                                        className="group relative overflow-hidden rounded-2xl cursor-pointer flex-shrink-0 text-left"
                                        style={{
                                            width: 'calc(50% - 6px)',
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

            {/* Normal Mode - Static 2-column Grid */}
            {lists.length > 0 && !isReordering && (
                <div className="flex flex-wrap gap-3 pb-20">
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
                            className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 bg-zinc-900/40 flex-shrink-0 select-none"
                            style={{ width: 'calc(50% - 6px)', boxShadow: 'inset 0 0 0 1px var(--glass-surface), 0 4px 12px rgba(0,0,0,0.3)' }}
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
                                        <div className="relative z-10 flex flex-col items-center gap-4">
                                            <div className="relative p-8 rounded-full bg-[var(--glass-surface)] transition-all duration-300" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
                                                <ListIcon type={list.type} className="h-12 w-12" style={{ color: `rgb(${rgb})` }} />
                                            </div>

                                            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--brand-text-primary)]/30">
                                                Nothing yet
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60" />
                            </div>

                            {/* Overlay Content */}
                            <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/60" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                                        <ListIcon type={list.type} className="h-3 w-3" style={{ color: `rgb(${rgb})` }} />
                                        <span className="text-[8px] font-black uppercase tracking-wider text-[var(--brand-text-primary)]">
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
                                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-black/60 text-[var(--brand-text-primary)]/50 active:text-[var(--brand-text-primary)] transition-all opacity-50"
                                            style={{ boxShadow: `inset 0 0 0 1px rgba(${rgb}, 0.25)` }}
                                            title="Quick add"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation()
                                                const confirmed = await confirm({
                                                    title: `Delete "${list.title}"?`,
                                                    description: 'This collection and all its items will be removed.',
                                                    confirmText: 'Delete',
                                                    variant: 'destructive',
                                                })
                                                if (confirmed) {
                                                    useListStore.getState().deleteList(list.id)
                                                }
                                            }}
                                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-brand-primary/10 active:bg-brand-primary/20 text-brand-text-secondary/40 active:text-brand-text-secondary transition-all opacity-50"
                                            style={{ boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.15)' }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                        <div className="opacity-30">
                                            <GripVertical className="h-3 w-3 text-[var(--brand-text-primary)]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-xs font-black text-[var(--brand-text-primary)] uppercase tracking-tight drop-shadow-md leading-tight group-hover:text-brand-primary transition-colors">
                                            {list.title}
                                        </h3>
                                        {/* Recently updated dot */}
                                        {recentlyUpdated && (
                                            <span
                                                className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: `rgb(${rgb})`, boxShadow: `0 0 4px rgb(${rgb})` }}
                                                title="Recently updated"
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {/* Item count badge */}
                                        <div className="flex items-center gap-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest"
                                                style={{ color: itemCount > 0 ? `rgba(${rgb}, 0.7)` : 'rgba(255,255,255,0.25)' }}>
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
                    Hold card to quick-add
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

            {confirmDialog}
        </div>
    )
}
