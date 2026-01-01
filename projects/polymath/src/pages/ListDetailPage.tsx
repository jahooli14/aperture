import React, { useEffect, useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Trash2, Mic, MicOff } from 'lucide-react'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { ConnectionsList } from '../components/connections/ConnectionsList'
import { VoiceInput } from '../components/VoiceInput'
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
                                    <div className="relative aspect-square bg-zinc-900/80 border border-white/5">
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
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
                                            <span>...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Delete Button - Hover Only */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (item.list_id && item.id) {
                                                onDelete(item.id, item.list_id)
                                            }
                                        }}
                                        className="p-1.5 bg-black/80 hover:bg-red-500/20 backdrop-blur-md rounded-lg text-zinc-500 hover:text-red-400 border border-white/10 transition-all shadow-xl"
                                        title="Delete Item"
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
    const { lists, currentListItems, fetchListItems, addListItem, fetchLists } = useListStore()

    // Find list locally first, or wait for fetch
    const list = lists.find(l => l.id === id)

    const [inputText, setInputText] = useState('')
    const [isVoiceMode, setIsVoiceMode] = useState(false)
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!lists.length) fetchLists()
    }, [])

    useEffect(() => {
        if (id) fetchListItems(id)
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

    // Voice transcript handler - instant add on voice completion
    const handleVoiceTranscript = async (text: string) => {
        if (!text.trim() || !id) return
        setIsVoiceMode(false)

        await addListItem({
            list_id: id,
            content: text.trim(),
            status: 'pending'
        })
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
                    <h1 className="text-3xl font-bold text-white mb-1">{list.title}</h1>
                    <div className="bg-zinc-800/50 px-3 py-1 rounded-full text-xs font-mono text-zinc-400">
                        {currentListItems.length} ITEMS
                    </div>
                </div>
                {list.description && <p className="text-zinc-500 max-w-xl">{list.description}</p>}
            </div>

            {/* Items Grid (Scrollable Area) */}
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-48">
                <AnimatePresence initial={false}>
                    {currentListItems.length > 0 ? (
                        <MasonryListGrid
                            items={currentListItems}
                            listType={list.type}
                            expandedItemId={expandedItemId}
                            onItemClick={(itemId) => setExpandedItemId(expandedItemId === itemId ? null : itemId)}
                            onDelete={(itemId, listId) => {
                                const { deleteListItem } = useListStore.getState()
                                deleteListItem(itemId, listId)
                            }}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center py-40 text-zinc-600">
                            <p className="text-zinc-500 font-medium text-lg mb-1">Your collection is empty.</p>
                            <p className="text-sm text-zinc-500 opacity-60">Begin typing below to curate your list.</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Smart Connections Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-48">
                <div className="p-8 rounded-2xl border border-white/5 bg-zinc-900/30 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Synthesized Insights</h3>
                            <p className="text-sm text-zinc-500">Connections discovered by the Aperture Neural Bridge.</p>
                        </div>
                        <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">
                            Neural Sync
                        </div>
                    </div>

                    <ConnectionsList
                        itemType="list"
                        itemId={list.id}
                        content={`${list.title} ${list.description || ''} ${currentListItems.map(i => i.content).join(', ')}`}
                    />
                </div>
            </div>

            {/* Fixed Bottom Input Bar - Lifted to clear Nav */}
            <div className="fixed bottom-[100px] left-0 right-0 p-4 z-[100] pr-20 md:pr-4">
                <AnimatePresence mode="wait">
                    {isVoiceMode ? (
                        <motion.div
                            key="voice-mode"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-2xl mx-auto backdrop-blur-2xl bg-zinc-900/90 border border-sky-500/30 rounded-2xl p-4 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
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
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-2xl mx-auto backdrop-blur-2xl bg-zinc-900/80 border border-white/10 rounded-full p-1.5 flex items-center gap-2 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                        >
                            <form onSubmit={handleAddItem} className="flex-1 flex px-2 text-white items-center gap-2">
                                <Input
                                    ref={inputRef}
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    placeholder={`Add to ${list.title}...`}
                                    className="border-0 bg-transparent focus-visible:ring-0 text-white placeholder:text-zinc-500 h-10 text-base"
                                    autoFocus
                                />
                                <Button
                                    type="button"
                                    onClick={() => setIsVoiceMode(true)}
                                    className="rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-sky-400 h-9 w-9 p-0 shrink-0 transition-all duration-300"
                                >
                                    <Mic className="h-4 w-4" />
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!inputText.trim()}
                                    className="rounded-full bg-white text-black hover:bg-zinc-200 h-9 w-9 p-0 shrink-0 transition-all duration-300"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
                {/* Visual anchor for the bar */}
                <div className="absolute inset-x-0 -bottom-4 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none -z-10" />
            </div>
        </div >
    )
}
