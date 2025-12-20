import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Trash2 } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'
import { OptimizedImage } from '../components/ui/optimized-image'

export default function ListDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { lists, currentListItems, fetchListItems, addListItem, fetchLists } = useListStore()

    // Find list locally first, or wait for fetch
    const list = lists.find(l => l.id === id)

    const [inputText, setInputText] = useState('')
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
            <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-32">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    <AnimatePresence initial={false}>
                        {currentListItems.map((item) => (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-zinc-900 border border-white/5 rounded-xl p-4 group relative overflow-hidden"
                            >
                                {/* TODO: Render Metadata logic here later */}
                                {item.metadata?.image ? (
                                    <div className="aspect-video mb-3 rounded-lg overflow-hidden bg-zinc-800">
                                        <OptimizedImage src={item.metadata.image} alt={item.content} className="w-full h-full object-cover" />
                                    </div>
                                ) : null}

                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-white font-medium">{item.content}</span>
                                </div>

                                {item.enrichment_status === 'pending' && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500 italic">
                                        <div className="h-1 w-1 rounded-full bg-zinc-500 animate-pulse" />
                                        <span>Enriching...</span>
                                    </div>
                                )}

                                {/* Metadata Rendering */}
                                {item.metadata?.subtitle && (
                                    <p className="text-zinc-400 text-sm mb-2 line-clamp-1">{item.metadata.subtitle}</p>
                                )}

                                {item.metadata?.specs && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {Object.entries(item.metadata.specs).slice(0, 2).map(([key, value]) => (
                                            <span key={key} className="text-[10px] uppercase font-mono bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 border border-white/5">
                                                {value as string}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {item.metadata?.tags && item.metadata.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mb-2">
                                        {item.metadata.tags.map((tag: string) => (
                                            <span key={tag} className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-zinc-300">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {item.metadata?.link && (
                                    <a
                                        href={item.metadata.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline block mt-2"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        View Details &rarr;
                                    </a>
                                )}
                                {/* Hover Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            // Handle delete
                                            const { deleteListItem } = useListStore.getState()
                                            if (item.list_id && item.id) {
                                                deleteListItem(item.id, item.list_id)
                                            }
                                        }}
                                        className="p-1.5 bg-black/50 hover:bg-black/80 backdrop-blur-md rounded-full text-zinc-400 hover:text-red-400 transition-colors"
                                        title="Delete Item"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div >

                {
                    currentListItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-40 text-zinc-600">
                            <p className="text-zinc-500 font-medium text-lg mb-1">Your collection is empty.</p>
                            <p className="text-sm text-zinc-500 opacity-60">Begin typing below to curate your list.</p>
                        </div>
                    )
                }
            </div >

            {/* Fixed Bottom Input Bar - Lifted to clear Nav */}
            < div className="fixed bottom-[90px] left-0 right-0 p-4 z-[100]" >
                <div className="max-w-2xl mx-auto backdrop-blur-2xl bg-zinc-900/80 border border-white/10 rounded-full p-1.5 flex items-center gap-2 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <form onSubmit={handleAddItem} className="flex-1 flex px-2">
                        <Input
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder={`Add to ${list.title}...`}
                            className="border-0 bg-transparent focus-visible:ring-0 text-white placeholder:text-zinc-500 h-10 text-base"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="rounded-full bg-white text-black hover:bg-zinc-200 h-9 w-9 p-0 shrink-0 transition-all duration-300"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
                {/* Visual anchor for the bar */}
                <div className="absolute inset-x-0 -bottom-4 h-24 bg-gradient-to-t from-black to-transparent pointer-events-none -z-10" />
            </div >
        </div >
    )
}
