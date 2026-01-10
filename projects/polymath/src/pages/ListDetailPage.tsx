import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Send, Trash2, Mic, MicOff, ListOrdered, Check, GripVertical, Film, Music, Book, MapPin, Box, Quote } from 'lucide-react'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { VoiceInput } from '../components/VoiceInput'
import { Reorder } from 'framer-motion'
import type { ListItem } from '../types'

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

    // Special layout for quotes/phrases - single column, elegant typography
    if (isQuoteType) {
        return (
            <div className="flex flex-col gap-6 max-w-2xl mx-auto">
                {items.map((item) => {
                    const isExpanded = expandedItemId === item.id
                    const hasSource = item.metadata?.subtitle || item.metadata?.specs?.Source || item.metadata?.specs?.Author

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
                            {/* Quote Card */}
                            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-white/5 p-6 sm:p-8 hover:border-white/10 transition-all duration-300">
                                {/* Decorative gradient accent */}
                                <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-transparent rounded-full blur-2xl" />
                                <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-sky-500/10 via-cyan-500/5 to-transparent rounded-full blur-2xl" />

                                {/* Opening Quote Mark */}
                                <div className="absolute top-4 left-4 text-6xl sm:text-7xl font-serif text-white/5 select-none leading-none">
                                    "
                                </div>

                                {/* The Phrase */}
                                <div className="relative z-10 pt-8 sm:pt-10">
                                    <p className="text-xl sm:text-2xl md:text-3xl text-white leading-relaxed font-light italic tracking-wide">
                                        {item.content}
                                    </p>

                                    {/* Source/Attribution */}
                                    {hasSource && (
                                        <p className="mt-4 text-sm text-zinc-500 font-medium">
                                            — {item.metadata?.specs?.Author || item.metadata?.specs?.Source || item.metadata?.subtitle}
                                        </p>
                                    )}

                                    {/* Expanded Details */}
                                    {isExpanded && item.metadata && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-6 pt-6 border-t border-white/5 space-y-3"
                                        >
                                            {item.metadata.description && (
                                                <p className="text-sm text-zinc-400 leading-relaxed">
                                                    {item.metadata.description}
                                                </p>
                                            )}

                                            {item.metadata.tags && item.metadata.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {item.metadata.tags.map((tag: string) => (
                                                        <span key={tag} className="text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full text-zinc-400">
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
                                    <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-violet-400 animate-pulse">
                                        <div className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                        Enriching...
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
                                    className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/0 hover:bg-red-500/20 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-300"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    )
                })}
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
                                        <img
                                            src={item.metadata.image}
                                            alt={item.content}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            loading="lazy"
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
    const { lists, currentListItems, fetchListItems, addListItem, fetchLists, deleteListItem, reorderItems } = useListStore()

    // Find list locally first, or wait for fetch
    const list = lists.find(l => l.id === id)

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

    if (!list) return <div className="pt-24 text-center text-white">Loading...</div>

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
                        {currentListItems.length} ITEMS
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
                                values={currentListItems}
                                onReorder={handleReorder}
                                className="space-y-2"
                            >
                                {currentListItems.map((item) => (
                                    <Reorder.Item
                                        key={item.id}
                                        value={item}
                                        className="flex items-center gap-4 bg-zinc-900/40 border border-white/5 p-4 rounded-xl cursor-grab active:cursor-grabbing hover:bg-zinc-900/60 transition-all"
                                    >
                                        <GripVertical className="h-4 w-4 text-zinc-600" />
                                        {item.metadata?.image && (
                                            <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                                <img src={item.metadata.image} className="w-full h-full object-cover" />
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
                            {currentListItems.length > 0 ? (
                                <MasonryListGrid
                                    items={currentListItems}
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
                            content={`${list.title} ${list.description || ''} ${currentListItems.map(i => i.content).join(', ')}`}
                            onCountChange={setConnectionCount}
                            onLoadingChange={setIsLoadingConnections}
                        />
                    </div>
                )}
            </div>

        </div>
    )
}
