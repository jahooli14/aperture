import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, Layers, Clock, Check } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { Project } from '../../types'

interface ProjectPickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (project: Project) => void
    title?: string
}

export function ProjectPickerDialog({
    open,
    onOpenChange,
    onSelect,
    title = "Add to Project"
}: ProjectPickerDialogProps) {
    const { projects, fetchProjects } = useProjectStore()
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (open && projects.length === 0) {
            fetchProjects()
        }
    }, [open])

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        p.status !== 'archived' &&
        p.status !== 'completed'
    )

    // Sort by recently updated
    const sortedProjects = [...filteredProjects].sort((a, b) => {
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    })

    if (!open) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onOpenChange(false)}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Dialog */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 10 }}
                    className="relative w-full max-w-md bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-white/5">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {sortedProjects.length === 0 ? (
                            <div className="py-8 text-center text-gray-500">
                                <p>No active projects found.</p>
                            </div>
                        ) : (
                            sortedProjects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => onSelect(project)}
                                    className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-colors flex items-center gap-3 group"
                                >
                                    <div className={`p-2 rounded-lg ${project.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                                            project.status === 'upcoming' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        <Layers className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-gray-200 group-hover:text-white truncate">
                                            {project.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${project.status === 'active' ? 'bg-blue-500/10 text-blue-400' :
                                                    project.status === 'upcoming' ? 'bg-purple-500/10 text-purple-400' :
                                                        'bg-gray-500/10 text-gray-400'
                                                }`}>
                                                {project.status}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <Check className="h-4 w-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
