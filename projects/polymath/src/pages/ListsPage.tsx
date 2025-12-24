import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar, Trash2 } from 'lucide-react'
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
    const { lists, fetchLists, loading } = useListStore()
    const [createOpen, setCreateOpen] = useState(false)

    useEffect(() => {
        fetchLists()
    }, [])

    return (
        <div className="min-h-screen pb-20 pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto aperture-shelf">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="section-header">
                        your <span>collections</span>
                    </h1>
                    <p className="aperture-body text-[var(--brand-text-secondary)] mt-1">Curate your existence.</p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-5 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-sm text-white aperture-header bg-transparent"
                >
                    <Plus className="h-4 w-4" />
                    New List
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {lists.map((list) => {
                    const rgb = ListColor(list.type)
                    return (
                        <motion.div
                            key={list.id}
                            layoutId={list.id}
                            onClick={() => navigate(`/lists/${list.id}`)}
                            whileHover={{ y: -4 }}
                            className="group relative overflow-hidden rounded-2xl cursor-pointer h-56 flex flex-col justify-between aperture-card backdrop-blur-xl transition-all duration-300"
                            style={{
                                borderColor: `rgba(${rgb}, 0.25)`,
                                background: `rgba(${rgb}, 0.08)`,
                                boxShadow: `0 8px 32px rgba(${rgb}, 0.1)`
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = `rgba(${rgb}, 0.15)`
                                e.currentTarget.style.borderColor = `rgba(${rgb}, 0.4)`
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = `rgba(${rgb}, 0.08)`
                                e.currentTarget.style.borderColor = `rgba(${rgb}, 0.25)`
                            }}
                        >
                            {/* Aesthetic Grid Mask */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                                backgroundSize: '16px 16px',
                                maskImage: 'linear-gradient(to bottom, black, transparent)'
                            }} />

                            <div className="relative z-10 p-6 flex-1 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 rounded-lg" style={{ background: `rgba(${rgb}, 0.1)` }}>
                                        <ListIcon type={list.type} className="h-5 w-5" style={{ color: `rgb(${rgb})` }} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-50 aperture-header" style={{ color: `rgb(${rgb})` }}>
                                        {list.type}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 aperture-header leading-tight">{list.title}</h3>
                                <p className="text-sm aperture-body text-[var(--brand-text-secondary)]">{list.item_count || 0} items</p>
                            </div>

                            <div className="relative z-10 p-4 pt-0 flex justify-between items-center">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (confirm(`Delete collection "${list.title}" and all its items?`)) {
                                            const { deleteList } = useListStore.getState()
                                            deleteList(list.id)
                                        }
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                                    title="Delete Collection"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors aperture-header flex items-center gap-1">
                                    View Collection <span className="group-hover:translate-x-1 transition-transform">→</span>
                                </span>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    )
}
