import React, { useEffect, useState } from 'react'
import { Reorder, motion } from 'framer-motion'
import { Plus, Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Trash2, GripVertical } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { CreateListDialog } from '../components/lists/CreateListDialog'
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
        default: return '148, 163, 184' // Slate
    }
}

export default function ListsPage() {
    const navigate = useNavigate()
    const { lists, fetchLists, reorderLists, loading } = useListStore()
    const [createOpen, setCreateOpen] = useState(false)
    const [listCovers, setListCovers] = useState<Record<string, string>>({})

    useEffect(() => {
        fetchLists()
    }, [])

    // Fetch first item image for each list to use as cover
    useEffect(() => {
        const fetchCovers = async () => {
            const covers: Record<string, string> = {}
            for (const list of lists) {
                try {
                    const response = await fetch(`/api/list-items?listId=${list.id}&limit=10`)
                    if (response.ok) {
                        const items = await response.json()
                        const itemWithImage = items.find((item: any) => item.metadata?.image)
                        if (itemWithImage?.metadata?.image) {
                            covers[list.id] = itemWithImage.metadata.image
                        }
                    }
                } catch (error) {
                    console.error(`Failed to fetch cover for list ${list.id}:`, error)
                }
            }
            setListCovers(covers)
        }
        if (lists.length > 0) {
            fetchCovers()
        }
    }, [lists])

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
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="h-10 w-10 p-0 rounded-full border border-white/10 hover:bg-white/5 bg-transparent text-white"
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Stable 2-column Grid */}
            <Reorder.Group
                axis="y"
                values={lists}
                onReorder={handleReorder}
                className="grid grid-cols-2 gap-3 pb-20"
            >
                {lists.map((list) => {
                    const rgb = ListColor(list.type)
                    const coverImage = listCovers[list.id]

                    return (
                        <Reorder.Item
                            key={list.id}
                            value={list}
                            layoutId={list.id}
                            onClick={() => navigate(`/lists/${list.id}`)}
                            className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border border-white/5 bg-zinc-900/40"
                            whileHover={{ y: -2 }}
                        >
                            {/* Poster / Cover Image */}
                            <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950">
                                {coverImage ? (
                                    <img
                                        src={coverImage}
                                        alt=""
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
                                        {/* Background Glow */}
                                        <div
                                            className="absolute inset-0 opacity-20 blur-3xl animate-pulse"
                                            style={{ background: `radial-gradient(circle at center, rgba(${rgb}, 0.8), transparent)` }}
                                        />

                                        {/* Subtle Tiled Pattern or Large Background Icon */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] scale-[2] rotate-12">
                                            <ListIcon type={list.type} className="h-64 w-64" style={{ color: `rgb(${rgb})` }} />
                                        </div>

                                        {/* Main Icon with Glow */}
                                        <div className="relative z-10 flex flex-col items-center gap-4">
                                            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm relative group-hover:scale-110 transition-transform duration-500">
                                                <div
                                                    className="absolute inset-0 blur-xl opacity-20"
                                                    style={{ background: `rgb(${rgb})` }}
                                                />
                                                <ListIcon type={list.type} className="h-12 w-12 relative z-10" style={{ color: `rgb(${rgb})` }} />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <div className="h-px w-8 bg-gradient-to-r from-transparent via-white/20 to-transparent mb-2" />
                                                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20">Empty Space</span>
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
                        </Reorder.Item>
                    )
                })}
            </Reorder.Group>

            <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    )
}
