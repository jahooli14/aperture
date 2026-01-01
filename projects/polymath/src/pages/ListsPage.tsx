import React, { useEffect, useState } from 'react'
import { Reorder, motion, AnimatePresence } from 'framer-motion'
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
                    const response = await fetch(`/api/list-items?listId=${list.id}&limit=20`)
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
        <div className="min-h-screen pb-20 pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto aperture-shelf">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="section-header !text-2xl">
                        your <span>collections</span>
                    </h1>
                    <p className="aperture-body text-[var(--brand-text-secondary)] mt-0.5 text-xs">Curate your existence.</p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl hover:bg-white/5 transition-all uppercase text-[8px] font-bold tracking-widest backdrop-blur-sm text-white aperture-header bg-transparent"
                >
                    <Plus className="h-3 w-3" />
                    New
                </Button>
            </div>

            {/* Reorderable Masonry-style Grid */}
            <Reorder.Group
                axis="y"
                values={lists}
                onReorder={handleReorder}
                className="masonry-grid"
                style={{
                    columnCount: 'auto',
                    columnFill: 'balance',
                    columnGap: '1rem',
                    columnWidth: '280px'
                }}
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
                            className="group relative overflow-hidden rounded-xl cursor-pointer mb-4 break-inside-avoid transition-all duration-300"
                            style={{
                                display: 'inline-block',
                                width: '100%',
                                border: `1px solid rgba(${rgb}, 0.25)`,
                                boxShadow: `0 4px 20px rgba(${rgb}, 0.15)`
                            }}
                            whileHover={{ y: -4, scale: 1.02 }}
                        >
                            {/* Drag Handle Overlay */}
                            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-30 transition-opacity z-20">
                                <GripVertical className="h-3 w-3 text-white" />
                            </div>

                            {/* Cover Image or Gradient Background */}
                            {coverImage ? (
                                <div className="relative aspect-[4/3] overflow-hidden">
                                    <img
                                        src={coverImage}
                                        alt={list.title}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    />
                                    {/* Gradient Overlay for Text Readability */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                                </div>
                            ) : (
                                <div
                                    className="relative aspect-[4/3]"
                                    style={{
                                        background: `linear-gradient(135deg, rgba(${rgb}, 0.3) 0%, rgba(${rgb}, 0.1) 100%)`
                                    }}
                                >
                                    {/* Icon for lists without images */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                        <ListIcon type={list.type} className="h-16 w-16" style={{ color: `rgb(${rgb})` }} />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                                </div>
                            )}

                            {/* Content Overlay */}
                            <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
                                {/* Top Badge */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md backdrop-blur-md bg-black/40 border border-white/10">
                                        <ListIcon type={list.type} className="h-3 w-3" style={{ color: `rgb(${rgb})` }} />
                                        <span className="text-[9px] font-black uppercase tracking-wider aperture-header" style={{ color: `rgb(${rgb})` }}>
                                            {list.type}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (confirm(`Delete collection "${list.title}" and all its items?`)) {
                                                const { deleteList } = useListStore.getState()
                                                deleteList(list.id)
                                            }
                                        }}
                                        className="pointer-events-auto p-1.5 rounded-lg backdrop-blur-md bg-black/40 border border-white/10 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                        title="Delete Collection"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>

                                {/* Bottom Title & Info */}
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1 aperture-header leading-tight drop-shadow-lg">
                                        {list.title}
                                    </h3>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs aperture-body text-white/80 font-medium">
                                            {list.item_count || 0} items
                                        </p>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors aperture-header flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                            View <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                                        </span>
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
