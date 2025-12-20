import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles, Send, Trash2 } from 'lucide-react'
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
                                    <div className="mt-2 flex items-center gap-2 text-xs text-indigo-400">
                                        <Sparkles className="h-3 w-3 animate-pulse" />
                                        <span>Enriching...</span>
                                    </div>
                                )}

                                {/* Hover Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Actions placeholder */}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {currentListItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                        <Sparkles className="h-10 w-10 mb-4 opacity-20" />
                        <p>Type below to add your first item.</p>
                    </div>
                )}
            </div>

            {/* Fixed Bottom Input Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black to-transparent z-50">
                <div className="max-w-3xl mx-auto backdrop-blur-xl bg-zinc-900/90 border border-white/10 rounded-full p-2 flex items-center gap-2 shadow-2xl">
                    <form onSubmit={handleAddItem} className="flex-1 flex px-2">
                        <Input
                            ref={inputRef}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            placeholder={`Add to ${list.title}...`}
                            className="border-0 bg-transparent focus-visible:ring-0 text-white placeholder:text-zinc-500 h-10"
                            autoFocus
                        />
                        <Button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="rounded-full bg-white text-black hover:bg-zinc-200 h-10 w-10 p-0 shrink-0"
                        >
                            <Send className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
