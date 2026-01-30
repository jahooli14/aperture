import React, { useEffect, useState } from 'react'
import { Reorder, motion } from 'framer-motion'
import { Plus, Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Quote, Trash2, GripVertical, ListOrdered, Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { CreateListDialog } from '../components/lists/CreateListDialog'
import { OptimizedImage } from '../components/ui/optimized-image'
import type { ListType } from '../types'

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
        case 'quote': return '167, 139, 250' // Violet for quotes
        case 'event': return '251, 146, 60' // Orange
        case 'software': return '34, 211, 238' // Cyan
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
        default: return 'from-slate-500/20 via-gray-500/10 to-zinc-500/20'
    }
}

export default function ListsPage() {
    const navigate = useNavigate()
    const { lists, fetchLists, reorderLists, loading } = useListStore()
    const [createOpen, setCreateOpen] = useState(false)
    const [listCovers, setListCovers] = useState<Record<string, string>>({})
    const [quoteCovers, setQuoteCovers] = useState<Record<string, string>>({})
    const [initialLoad, setInitialLoad] = useState(true)
    const [isReordering, setIsReordering] = useState(false)

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

    return (
        <div className="min-h-screen pb-32 pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto aperture-shelf overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                        your <span className="text-sky-400">collections</span>
                    </h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Curate your existence.</p>
                </div>
                <div className="flex items-center gap-2">
                    {lists.length > 0 && (
                        <button
                            onClick={() => setIsReordering(!isReordering)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                                isReordering
                                    ? 'bg-sky-500 border-sky-400 text-white'
                                    : 'border-white/10 text-white hover:bg-white/5'
                            }`}
                        >
                            {isReordering ? <Check className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {isReordering ? 'Done' : 'Order'}
                            </span>
                        </button>
                    )}
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="h-10 w-10 p-0 rounded-full border border-white/10 hover:bg-white/5 bg-transparent text-white"
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
                            className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/40"
                            style={{ width: 'calc(50% - 6px)' }}
                        >
                            <div className="aspect-[3/4] shimmer" />
                        </div>
                    ))}
                </div>
            )}

            {/* Empty State - Show helpful message when no lists */}
            {!loading && lists.length === 0 && !initialLoad && (
                <div className="text-center py-16 px-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-sky-400/10 mb-6">
                        <Box className="h-8 w-8 text-sky-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No collections yet</h3>
                    <p className="text-zinc-400 mb-6 max-w-md mx-auto">
                        Create your first collection to start organizing movies, books, places, or anything you want to track.
                    </p>
                    <Button
                        onClick={() => setCreateOpen(true)}
                        className="h-10 px-6 rounded-full border border-white/10 hover:bg-white/5 bg-transparent text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Collection
                    </Button>
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

                    return (
                        <Reorder.Item
                            key={list.id}
                            value={list}
                            className="flex items-center gap-4 bg-zinc-900/60 border border-white/10 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:bg-zinc-900/80 transition-colors"
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
                                        <p className="text-white/60 text-[8px] font-light text-center line-clamp-4" style={{ fontFamily: 'Georgia, serif' }}>
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
                                    <h3 className="text-sm font-black text-white uppercase tracking-tight truncate">
                                        {list.title}
                                    </h3>
                                </div>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
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

                    return (
                        <motion.div
                            key={list.id}
                            layoutId={list.id}
                            onClick={() => navigate(`/lists/${list.id}`)}
                            className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-white/5 bg-zinc-900/40 flex-shrink-0"
                            style={{ width: 'calc(50% - 6px)' }}
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
                                        <div className="absolute top-4 right-4 text-6xl font-serif text-white/[0.03] select-none leading-none">"</div>
                                        <div className="absolute bottom-4 left-4 text-6xl font-serif text-white/[0.03] select-none leading-none">"</div>

                                        {/* The phrase - centered and beautiful */}
                                        <div className="relative z-10 flex flex-col items-center justify-center text-center">
                                            <p className="text-white/90 font-light text-lg sm:text-xl leading-relaxed tracking-wide px-2"
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
                                    // Empty list fallback - simplified for performance
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
                                            <div className="relative p-8 rounded-full bg-white/5 border border-white/10 group-hover:border-white/20 transition-all duration-300">
                                                <ListIcon type={list.type} className="h-12 w-12" style={{ color: `rgb(${rgb})` }} />
                                            </div>

                                            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                                                Empty
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60" />
                            </div>

                            {/* Overlay Content */}
                            <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md bg-black/40 border border-white/10">
                                        <ListIcon type={list.type} className="h-3 w-3" style={{ color: `rgb(${rgb})` }} />
                                        <span className="text-[8px] font-black uppercase tracking-wider text-white">
                                            {list.type}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                if (confirm(`Delete collection "${list.title}"?`)) {
                                                    useListStore.getState().deleteList(list.id)
                                                }
                                            }}
                                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500/40 hover:text-red-500 border border-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                        <div className="opacity-0 group-hover:opacity-40 transition-opacity">
                                            <GripVertical className="h-3 w-3 text-white" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-xs font-black text-white uppercase tracking-tight drop-shadow-md leading-tight group-hover:text-sky-400 transition-colors">
                                        {list.title}
                                    </h3>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                                            {list.item_count || 0} ITEMS
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )
                })}
                </div>
            )}

            <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    )
}
