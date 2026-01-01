import React, { useEffect, useState } from 'react'
import { Reorder } from 'framer-motion'
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

    useEffect(() => {
        fetchLists()
    }, [])

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

            <Reorder.Group
                axis="y"
                values={lists}
                onReorder={handleReorder}
                className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
            >
                {lists.map((list) => {
                    const rgb = ListColor(list.type)
                    return (
                        <Reorder.Item
                            key={list.id}
                            value={list}
                            className="group relative overflow-hidden rounded-xl cursor-pointer h-32 flex flex-col justify-between aperture-card backdrop-blur-xl transition-all duration-300"
                            style={{
                                borderColor: `rgba(${rgb}, 0.2)`,
                                background: `rgba(${rgb}, 0.05)`,
                                boxShadow: `0 4px 20px rgba(${rgb}, 0.05)`
                            }}
                            onMouseEnter={(e: any) => {
                                e.currentTarget.style.background = `rgba(${rgb}, 0.12)`
                                e.currentTarget.style.borderColor = `rgba(${rgb}, 0.35)`
                            }}
                            onMouseLeave={(e: any) => {
                                e.currentTarget.style.background = `rgba(${rgb}, 0.05)`
                                e.currentTarget.style.borderColor = `rgba(${rgb}, 0.2)`
                            }}
                            onClick={() => navigate(`/lists/${list.id}`)}
                        >
                            {/* Drag Handle Overlay */}
                            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-30 transition-opacity z-20">
                                <GripVertical className="h-3 w-3 text-white" />
                            </div>

                            {/* Aesthetic Grid Mask */}
                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                                backgroundSize: '12px 12px',
                                maskImage: 'linear-gradient(to bottom, black, transparent)'
                            }} />

                            <div className="relative z-10 p-3 flex-1 flex flex-col justify-center">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-1.5 rounded-md" style={{ background: `rgba(${rgb}, 0.1)` }}>
                                        <ListIcon type={list.type} className="h-4 w-4" style={{ color: `rgb(${rgb})` }} />
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-40 aperture-header" style={{ color: `rgb(${rgb})` }}>
                                        {list.type}
                                    </span>
                                </div>

                                <h3 className="text-sm font-bold text-white aperture-header leading-tight line-clamp-2">{list.title}</h3>
                                <p className="text-[10px] aperture-body text-[var(--brand-text-secondary)] mt-0.5">{list.item_count || 0} items</p>
                            </div>

                            <div className="relative z-10 p-2 pt-0 flex justify-between items-center bg-black/10">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirm(`Delete collection "${list.title}" and all its items?`)) {
                                            const { deleteList } = useListStore.getState()
                                            deleteList(list.id)
                                        }
                                    }}
                                    className="p-1 rounded-md hover:bg-red-500/20 text-white/10 hover:text-red-400 transition-all"
                                    title="Delete Collection"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                                <div className="h-0.5 w-4 bg-white/10 rounded-full group-hover:w-8 group-hover:bg-white/30 transition-all duration-500" />
                            </div>
                        </Reorder.Item>
                    )
                })}
            </Reorder.Group>

            <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    )
}
