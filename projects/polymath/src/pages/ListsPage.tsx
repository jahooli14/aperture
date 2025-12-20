import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Film, Music, Monitor, Book, MapPin, Gamepad2, Box, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useListStore } from '../stores/useListStore'
import { Button } from '../components/ui/button'
import { CreateListDialog } from '../components/lists/CreateListDialog'
import type { ListType } from '../types'

const ListIcon = ({ type, className }: { type: ListType, className?: string }) => {
    switch (type) {
        case 'film': return <Film className={className} />
        case 'music': return <Music className={className} />
        case 'tech': return <Monitor className={className} />
        case 'book': return <Book className={className} />
        case 'place': return <MapPin className={className} />
        case 'game': return <Gamepad2 className={className} />
        case 'software': return <Box className={className} /> // Using Box for software/SaaS
        case 'event': return <Calendar className={className} />
        default: return <Box className={className} />
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
        <div className="min-h-screen pb-20 pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Collections</h1>
                    <p className="text-slate-400">Curate your existence.</p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="rounded-full bg-white text-black hover:bg-slate-200"
                >
                    <Plus className="h-4 w-4 mr-2" />
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
                            className="group relative overflow-hidden rounded-2xl border p-6 cursor-pointer h-48 flex flex-col justify-between"
                            style={{
                                borderColor: 'rgba(255,255,255,0.1)',
                                background: `linear-gradient(135deg, rgba(${rgb}, 0.1), rgba(${rgb}, 0.02))`,
                                boxShadow: `0 4px 20px rgba(0,0,0,0.2)`
                            }}
                        >
                            {/* Background Glow */}
                            <div className="absolute -right-10 -top-10 w-32 h-32 blur-3xl rounded-full opacity-20 pointer-events-none"
                                style={{ background: `rgb(${rgb})` }}
                            />

                            <div className="relative z-10">
                                <div className="p-3 w-fit rounded-xl mb-4" style={{ background: `rgba(${rgb}, 0.2)` }}>
                                    <ListIcon type={list.type} className="h-6 w-6 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-1">{list.title}</h3>
                                <p className="text-sm text-white/50">{list.item_count || 0} items</p>
                            </div>

                            <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                                <span className="text-xs font-medium text-white/70">View Collection →</span>
                            </div>
                        </motion.div>
                    )
                })}
            </div>

            <CreateListDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
    )
}
