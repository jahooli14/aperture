import React, { useEffect, useState, useRef, useMemo, memo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Send, Trash2, Mic, MicOff, ListOrdered, Check, GripVertical, Film, Music, Book, MapPin, Box, Quote, Pencil } from 'lucide-react'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { VoiceInput } from '../components/VoiceInput'
import { OptimizedImage } from '../components/ui/optimized-image'
import { Reorder } from 'framer-motion'
import type { ListItem } from '../types'

// Color schemes for quote variants - defined once outside component
const COLOR_SCHEMES = [
    { primary: 'violet', accent: 'fuchsia', gradient: 'from-violet-500/20 via-fuchsia-500/10 to-purple-500/20', glow: 'violet-500', border: 'violet-500/20', rgb: '139, 92, 246' },
    { primary: 'cyan', accent: 'blue', gradient: 'from-cyan-500/20 via-blue-500/10 to-sky-500/20', glow: 'cyan-500', border: 'cyan-500/20', rgb: '6, 182, 212' },
    { primary: 'rose', accent: 'pink', gradient: 'from-rose-500/20 via-pink-500/10 to-red-500/20', glow: 'rose-500', border: 'rose-500/20', rgb: '244, 63, 94' },
    { primary: 'amber', accent: 'orange', gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/20', glow: 'amber-500', border: 'amber-500/20', rgb: '245, 158, 11' },
    { primary: 'emerald', accent: 'teal', gradient: 'from-emerald-500/20 via-teal-500/10 to-green-500/20', glow: 'emerald-500', border: 'emerald-500/20', rgb: '16, 185, 129' }
] as const

// Helper to get variant based on item ID (deterministic variety) - cached
const getVariant = (id: string) => {
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return hash % 5
}

// Memoized phrase card component for performance
const PhraseCard = memo(({
    item,
    isExpanded,
    onItemClick,
    onDelete
}: {
    item: ListItem
    isExpanded: boolean
    onItemClick: (id: string) => void
    onDelete: (id: string, listId: string) => void
}) => {
    const [isEditingAuthor, setIsEditingAuthor] = useState(false)
    const [authorValue, setAuthorValue] = useState(item.metadata?.specs?.Author || 'Me')
    const updateListItemMetadata = useListStore(state => state.updateListItemMetadata)

    const hasSource = item.metadata?.subtitle || item.metadata?.specs?.Source || item.metadata?.specs?.Author
    const variant = useMemo(() => getVariant(item.id), [item.id])
    const isShort = item.content.length < 80
    const isMedium = item.content.length >= 80 && item.content.length < 150
    const colors = COLOR_SCHEMES[variant]

    const handleSaveAuthor = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (authorValue.trim()) {
            const updatedMetadata = {
                ...item.metadata,
                specs: {
                    ...item.metadata?.specs,
                    Author: authorValue.trim()
                }
            }
            await updateListItemMetadata(item.id, updatedMetadata)
        }
        setIsEditingAuthor(false)
    }

    return (
        <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => onItemClick(item.id)}
            className="group relative cursor-pointer"
        >
            {/* Quote Card - optimized with reduced effects */}
            <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${variant === 0 ? 'from-zinc-900/90 via-purple-950/20 to-zinc-900/90' : variant === 1 ? 'from-zinc-900/90 via-cyan-950/20 to-zinc-900/90' : variant === 2 ? 'from-zinc-900/90 via-rose-950/20 to-zinc-900/90' : variant === 3 ? 'from-zinc-900/90 via-amber-950/20 to-zinc-900/90' : 'from-zinc-900/90 via-emerald-950/20 to-zinc-900/90'} backdrop-blur-xl border-2 p-8 sm:p-12 hover:border-white/30 transition-all duration-500`}
            style={{
                borderColor: `rgba(${colors.rgb}, 0.2)`,
                boxShadow: `0 20px 40px rgba(${colors.rgb}, 0.05)`
            }}>
                {/* Single gradient accent - reduced from 3 */}
                <div className={`absolute top-0 left-0 w-40 h-40 bg-gradient-to-br ${colors.gradient} rounded-full blur-3xl opacity-30`} />

                {/* Minimal decorative element - variant specific */}
                {variant === 0 && (
                    <div className="absolute top-6 left-6 text-6xl font-serif text-white/[0.03] select-none leading-none">
                        "
                    </div>
                )}
                {variant === 1 && (
                    <div className="absolute top-6 right-6 w-12 h-12 border-t-2 border-r-2 border-cyan-500/10 rounded-tr-3xl" />
                )}

                {/* The Phrase - optimized typography */}
                <div className="relative z-10 pt-4 sm:pt-6">
                    <p className={`${isShort ? 'text-3xl sm:text-4xl md:text-5xl' : isMedium ? 'text-2xl sm:text-3xl md:text-4xl' : 'text-xl sm:text-2xl md:text-3xl'} text-white/95 leading-relaxed tracking-wide ${variant === 0 ? 'font-light' : variant === 1 ? 'font-normal' : variant === 2 ? 'font-light italic' : variant === 3 ? 'font-medium' : 'font-light'}`}
                    style={{
                        fontFamily: variant === 0 ? 'Georgia, serif' : variant === 1 ? 'Palatino, serif' : variant === 2 ? 'Garamond, serif' : variant === 3 ? 'Times New Roman, serif' : 'Georgia, serif',
                        textShadow: `0 2px 10px rgba(${colors.rgb}, 0.1)`
                    }}>
                        {item.content}
                    </p>

                    {/* Source/Attribution - Editable */}
                    <div className="mt-6 flex items-center gap-2 group/author">
                        {isEditingAuthor ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={authorValue}
                                    onChange={(e) => setAuthorValue(e.target.value)}
                                    className="bg-white/10 border border-white/20 rounded px-3 py-1 text-sm text-white/90 focus:outline-none focus:border-white/40"
                                    placeholder="Author name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSaveAuthor(e as any)
                                        } else if (e.key === 'Escape') {
                                            setIsEditingAuthor(false)
                                            setAuthorValue(item.metadata?.specs?.Author || 'Me')
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSaveAuthor}
                                    className="p-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <Check className="h-3.5 w-3.5 text-white/70" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className={`text-sm font-medium tracking-wider ${variant === 2 ? 'italic' : ''}`}
                                style={{
                                    color: `rgba(${variant === 0 ? '167, 139, 250' : variant === 1 ? '103, 232, 249' : variant === 2 ? '251, 113, 133' : variant === 3 ? '251, 191, 36' : '52, 211, 153'}, 0.7)`
                                }}>
                                    {variant === 3 ? '~' : '—'} {item.metadata?.specs?.Author || item.metadata?.specs?.Source || item.metadata?.subtitle || 'Me'}
                                </p>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsEditingAuthor(true)
                                    }}
                                    className="p-1.5 rounded bg-white/5 hover:bg-white/10 opacity-0 group-hover/author:opacity-100 transition-all"
                                >
                                    <Pencil className="h-3 w-3 text-white/50" />
                                </button>
                            </>
                        )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && item.metadata && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-8 pt-6 border-t border-white/10 space-y-4"
                        >
                            {item.metadata.description && (
                                <p className="text-base text-zinc-300/90 leading-relaxed italic">
                                    {item.metadata.description}
                                </p>
                            )}

                            {item.metadata.tags && item.metadata.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {item.metadata.tags.map((tag: string) => (
                                        <span key={tag} className="text-xs bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-zinc-300 font-medium tracking-wide hover:bg-white/15 transition-colors">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </div>

                {/* Enriching indicator */}
                {item.enrichment_status === 'pending' && (
                    <div className="absolute bottom-6 right-6 flex items-center gap-2 text-xs"
                    style={{
                        color: `rgba(${variant === 0 ? '167, 139, 250' : variant === 1 ? '103, 232, 249' : variant === 2 ? '251, 113, 133' : variant === 3 ? '251, 191, 36' : '52, 211, 153'}, 0.8)`
                    }}>
                        <div className="h-2 w-2 rounded-full animate-pulse"
                        style={{
                            background: `rgba(${colors.rgb}, 0.6)`
                        }} />
                        <span className="font-medium">Enriching</span>
                    </div>
                )}

                {/* Delete Action */}
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Remove this phrase?`)) {
                            onDelete(item.id, item.list_id)
                        }
                    }}
                    className="absolute top-6 right-6 p-2.5 rounded-xl bg-zinc-900/50 backdrop-blur-sm border hover:bg-red-500/20 hover:border-red-500/40 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300"
                    style={{
                        borderColor: `rgba(${colors.rgb}, 0.2)`
                    }}
                    aria-label="Delete phrase"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </motion.div>
    )
})

// Masonry Grid Component for List Items
function MasonryListGrid({
    items,
    listType,
    expandedItemId,
    onItemClick,
    onDelete
}: {
    items: ListItem[],
    listType: string,
    expandedItemId: string | null,
    onItemClick: (id: string) => void,
    onDelete: (id: string, listId: string) => void
}) {
    const [columns, setColumns] = useState(2) // Default 2 columns for mobile

    useEffect(() => {
        const updateColumns = () => {
            if (window.innerWidth >= 1024) setColumns(3) // lg
            else setColumns(2) // mobile and tablet stay at 2 columns
        }

        updateColumns()
        window.addEventListener('resize', updateColumns)
        return () => window.removeEventListener('resize', updateColumns)
    }, [])

    // Distribute items into columns
    const distributedColumns = useMemo(() => {
        const cols: ListItem[][] = Array.from({ length: columns }, () => [])
        items.forEach((item, i) => {
            cols[i % columns].push(item)
        })
        return cols
    }, [items, columns])

    const isBook = listType === 'book'
    const isPosterType = isBook || listType === 'film' || listType === 'movie' || listType === 'show' || listType === 'tv'
    const isQuoteType = listType === 'quote'

    // Special layout for quotes/phrases - single column with memoized cards
    if (isQuoteType) {
        return (
            <div className="flex flex-col gap-8 max-w-3xl mx-auto">
                {items.map((item) => (
                    <PhraseCard
                        key={item.id}
                        item={item}
                        isExpanded={expandedItemId === item.id}
                        onItemClick={onItemClick}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        )
    }

    // Standard masonry grid for other list types
    return (
        <div className="flex gap-3 items-start w-full">
            {distributedColumns.map((colItems, colIndex) => (
                <div key={colIndex} className="flex-1 flex flex-col gap-3 min-w-0">
                    {colItems.map((item) => {
                        const isExpanded = expandedItemId === item.id
                        const hasImage = item.metadata?.image

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                onClick={() => onItemClick(item.id)}
                                className="group relative overflow-hidden rounded-xl cursor-pointer hover:scale-[1.02] transition-all duration-300 break-inside-avoid"
                                style={{
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
                                }}
                            >
                                {/* Image Background or Gradient */}
                                {hasImage ? (
                                    <div className={`relative ${isPosterType ? 'aspect-[2/3]' : 'aspect-square'} overflow-hidden`}>
                                        <OptimizedImage
                                            src={item.metadata.image}
                                            alt={item.content}
                                            className="w-full h-full"
                                            aspectRatio={isPosterType ? '2/3' : '1/1'}
                                            priority={false}
                                            sizes="(max-width: 768px) 50vw, 33vw"
                                        />
                                        {/* Gradient Overlay for Text Readability */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                                    </div>
                                ) : (
                                    <div className="relative aspect-square bg-zinc-900 border border-white/5 overflow-hidden flex items-center justify-center">
                                        <div
                                            className="absolute inset-0 opacity-10"
                                            style={{
                                                background: `linear-gradient(135deg, ${listType === 'music' ? '#ec4899' :
                                                    listType === 'film' ? '#ef4444' :
                                                        listType === 'book' ? '#f59e0b' :
                                                            listType === 'place' ? '#10b981' :
                                                                listType === 'tech' ? '#3b82f6' : '#6366f1'
                                                    }, transparent)`
                                            }}
                                        />
                                        <div className="relative z-10 flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                            <div className="h-8 w-8 rounded-full border border-white/20 flex items-center justify-center">
                                                {listType === 'music' ? <Music className="h-4 w-4" /> :
                                                    listType === 'film' ? <Film className="h-4 w-4" /> :
                                                        listType === 'book' ? <Book className="h-4 w-4" /> :
                                                            listType === 'place' ? <MapPin className="h-4 w-4" /> :
                                                                <Box className="h-4 w-4" />}
                                            </div>
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                    </div>
                                )}

                                {/* Content Overlay */}
                                <div className="absolute inset-0 p-3 flex flex-col justify-end">
                                    {/* Title */}
                                    <h3 className={`text-white font-bold leading-tight group-hover:text-sky-400 transition-colors uppercase tracking-tight drop-shadow-lg ${isExpanded ? 'text-sm mb-2' : 'text-xs mb-1'}`}>
                                        {item.content}
                                    </h3>

                                    {/* Metadata - Show when expanded */}
                                    {isExpanded && (
                                        <div className="space-y-2 backdrop-blur-sm bg-black/30 p-2 rounded-lg border border-white/10">
                                            {item.metadata?.subtitle && (
                                                <p className="text-zinc-300 text-[10px] italic leading-relaxed">
                                                    {item.metadata.subtitle}
                                                </p>
                                            )}

                                            {item.metadata?.description && (
                                                <p className="text-zinc-400 text-[10px] leading-relaxed line-clamp-3">
                                                    {item.metadata.description}
                                                </p>
                                            )}

                                            {item.metadata?.specs && (
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(item.metadata.specs).slice(0, 3).map(([key, value]) => (
                                                        <div key={key} className="flex items-baseline gap-1">
                                                            <span className="text-[8px] uppercase font-bold text-zinc-500">{key}:</span>
                                                            <span className="text-[9px] text-zinc-300">{value as string}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {item.metadata?.tags && item.metadata.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {item.metadata.tags.slice(0, 3).map((tag: string) => (
                                                        <span key={tag} className="text-[8px] bg-sky-500/20 border border-sky-500/30 px-1.5 py-0.5 rounded text-sky-300 font-medium">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {item.metadata?.link && (
                                                <a
                                                    href={item.metadata.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[9px] font-bold text-sky-400 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1 mt-1"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    Details →
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Status Indicators */}
                                    {!isExpanded && item.enrichment_status === 'pending' && (
                                        <div className="flex items-center gap-1 text-[9px] text-sky-400 font-bold animate-pulse">
                                            <div className="h-1 w-1 rounded-full bg-sky-400" />
                                            Enriching...
                                        </div>
                                    )}
                                </div>

                                {/* Quick Actions */}
                                <div className="absolute top-2 right-2 flex gap-1 transform translate-y-[-120%] group-hover:translate-y-0 transition-transform duration-300">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (confirm(`Remove "${item.content}"?`)) {
                                                onDelete(item.id, item.list_id)
                                            }
                                        }}
                                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500/50 hover:text-white backdrop-blur-md border border-red-500/20 transition-all"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </motion.div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}

export default function ListDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { lists, currentListItems, currentListId, fetchListItems, addListItem, fetchLists, deleteListItem, reorderItems } = useListStore()

    // Find list locally first, or wait for fetch
    const list = lists.find(l => l.id === id)

    // CRITICAL: Only use currentListItems if they belong to the current list
    // This prevents showing wrong list's content during navigation
    const isCorrectList = currentListId === id
    const displayItems = isCorrectList ? currentListItems : []

    const [inputText, setInputText] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)
    const [connectionCount, setConnectionCount] = useState(0)
    const [isLoadingConnections, setIsLoadingConnections] = useState(true)
    const [isVoiceMode, setIsVoiceMode] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!lists.length) fetchLists()
    }, [])

    useEffect(() => {
        if (id) {
            fetchListItems(id)
            window.scrollTo(0, 0)
        }
    }, [id])

    const handleAddItem = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!inputText.trim() || !id) return

        const content = inputText
        setInputText('') // Instant clear

        // Keep focus
        inputRef.current?.focus()

        await addListItem({
            list_id: id,
            content,
            status: 'pending'
        })
    }

    const handleVoiceTranscript = async (text: string) => {
        if (!text.trim() || !id) return
        setIsVoiceMode(false)

        await addListItem({
            list_id: id,
            content: text.trim(),
            status: 'pending'
        })
    }

    const handleReorder = async (newItems: ListItem[]) => {
        if (!id) return
        await reorderItems(id, newItems.map(item => item.id))
    }

    if (!list) {
        return (
            <div className="min-h-screen bg-black pt-24 px-4">
                <div className="max-w-4xl mx-auto">
                    <div className="shimmer h-8 w-32 rounded mb-8" />
                    <div className="shimmer h-12 w-64 rounded-lg mb-6" />
                    <div className="flex flex-wrap gap-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="shimmer h-48 rounded-2xl" style={{ width: 'calc(50% - 6px)' }} />
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Header */}
            <div className="pt-24 px-4 sm:px-6 lg:px-8 pb-4">
                <Button variant="ghost" onClick={() => navigate('/lists')} className="text-zinc-400 mb-4 pl-0 hover:text-white hover:bg-transparent">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Collections
                </Button>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl font-bold text-white mb-1 uppercase tracking-tight italic">{list.title}</h1>
                        <button
                            onClick={() => setIsReordering(!isReordering)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${isReordering ? 'bg-sky-500 border-sky-400 text-white' : 'border-white/10 text-zinc-500 hover:text-white hover:border-white/20'}`}
                        >
                            {isReordering ? <Check className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
                            <span className="text-[10px] font-black uppercase tracking-widest">{isReordering ? 'Done' : 'Order'}</span>
                        </button>
                    </div>
                    <div className="bg-zinc-800/50 px-3 py-1 rounded-full text-xs font-mono text-zinc-400">
                        {displayItems.length} ITEMS
                    </div>
                </div>
                {list.description && <p className="text-zinc-500 max-w-xl mb-6">{list.description}</p>}

                {/* Addition Box - Front & Centre */}
                {!isReordering && (
                    <div className="mt-8 mb-12 max-w-2xl">
                        <AnimatePresence mode="wait">
                            {isVoiceMode ? (
                                <motion.div
                                    key="voice-mode"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="backdrop-blur-2xl bg-zinc-900/90 border border-sky-500/30 rounded-2xl p-4 shadow-2xl"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm text-sky-400 font-medium">Voice Quick-Add</span>
                                        <button
                                            onClick={() => setIsVoiceMode(false)}
                                            className="text-zinc-500 hover:text-white transition-colors"
                                        >
                                            <MicOff className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <VoiceInput
                                        onTranscript={handleVoiceTranscript}
                                        autoSubmit={true}
                                        autoStart={true}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="text-mode"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="backdrop-blur-2xl bg-zinc-900/60 border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl focus-within:border-white/20 transition-all font-mono"
                                >
                                    <form onSubmit={handleAddItem} className="flex-1 flex px-3 text-white items-center gap-2">
                                        <Input
                                            ref={inputRef}
                                            value={inputText}
                                            onChange={e => setInputText(e.target.value)}
                                            placeholder={`Add to ${list.title.toLowerCase()}...`}
                                            className="border-0 bg-transparent focus-visible:ring-0 text-lg text-white placeholder:text-zinc-600 h-12 uppercase tracking-tight"
                                            autoFocus
                                        />
                                        <div className="flex items-center gap-2 px-1">
                                            <Button
                                                type="button"
                                                onClick={() => setIsVoiceMode(true)}
                                                className="rounded-xl bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-sky-400 h-10 w-10 p-0 shrink-0 transition-all border border-white/5"
                                            >
                                                <Mic className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="submit"
                                                disabled={!inputText.trim()}
                                                className="rounded-xl bg-white text-black hover:bg-zinc-200 h-10 px-4 gap-2 font-bold shrink-0 transition-all uppercase text-xs tracking-widest"
                                            >
                                                <span>Add</span>
                                                <Send className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Items Grid (Scrollable Area) */}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-48 max-w-5xl">
                <AnimatePresence mode="wait">
                    {isReordering ? (
                        <motion.div
                            key="reorder-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <Reorder.Group
                                axis="y"
                                values={displayItems}
                                onReorder={handleReorder}
                                className="space-y-2"
                            >
                                {displayItems.map((item) => (
                                    <Reorder.Item
                                        key={item.id}
                                        value={item}
                                        className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 p-4 rounded-xl cursor-grab active:cursor-grabbing hover:bg-zinc-900/60 transition-all"
                                    >
                                        <GripVertical className="h-4 w-4 text-zinc-600" />
                                        {item.metadata?.image && (
                                            <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                                <OptimizedImage
                                                    src={item.metadata.image}
                                                    alt={item.content}
                                                    className="w-full h-full"
                                                    aspectRatio="1/1"
                                                    priority={false}
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-bold uppercase tracking-tight truncate">{item.content}</p>
                                            {item.metadata?.subtitle && (
                                                <p className="text-[10px] text-zinc-500 italic truncate">{item.metadata.subtitle}</p>
                                            )}
                                        </div>
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="masonry-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {displayItems.length > 0 ? (
                                <MasonryListGrid
                                    items={displayItems}
                                    listType={list.type}
                                    expandedItemId={expandedItemId}
                                    onItemClick={(itemId) => setExpandedItemId(expandedItemId === itemId ? null : itemId)}
                                    onDelete={(itemId, listId) => deleteListItem(itemId, listId)}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-40 text-zinc-600">
                                    <p className="text-zinc-500 font-medium text-lg mb-1">Your collection is empty.</p>
                                    <p className="text-sm text-zinc-500 opacity-60">Begin typing below to curate your list.</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Smart Connections Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-48">
                {/* Synthesized Insights Section */}
                {(connectionCount > 0 || isLoadingConnections) && (
                    <div className="mt-12 pt-12 border-t border-white/5 pb-20">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Synthesized Insights</h3>
                                <p className="text-sm text-zinc-500">Connections discovered by the Aperture Engine.</p>
                            </div>
                            <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">
                                AI Connected
                            </div>
                        </div>

                        <ConnectionsList
                            itemType="list"
                            itemId={list.id}
                            content={`${list.title} ${list.description || ''} ${displayItems.map(i => i.content).join(', ')}`}
                            onCountChange={setConnectionCount}
                            onLoadingChange={setIsLoadingConnections}
                        />
                    </div>
                )}
            </div>

        </div>
    )
}
