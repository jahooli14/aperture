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
                    className="relative w-full max-w-md bg-[#1a1f2e] border border-[var(--glass-surface-hover)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-[var(--glass-surface-hover)] flex items-center justify-between bg-[var(--glass-surface)]">
                        <h2 className="text-lg font-semibold text-[var(--brand-text-primary)]">{title}</h2>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Search */}
                    <div className="p-4 border-b border-[var(--glass-surface)]">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-text-secondary)]" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/20 border border-[var(--glass-surface-hover)] rounded-xl py-2.5 pl-10 pr-4 text-[var(--brand-text-primary)] placeholder-gray-500 focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/50 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {sortedProjects.length === 0 ? (
                            <div className="py-8 text-center text-[var(--brand-text-muted)]">
                                <p>No active projects found.</p>
                            </div>
                        ) : (
                            sortedProjects.map((project) => (
                                <button
                                    key={project.id}
                                    onClick={() => onSelect(project)}
                                    className="w-full text-left p-3 rounded-xl hover:bg-[var(--glass-surface)] transition-colors flex items-center gap-3 group"
                                >
                                    <div className={`p-2 rounded-lg ${project.status === 'active' ? 'bg-brand-primary/20 text-brand-primary' :
                                            project.status === 'upcoming' ? 'bg-brand-primary/20 text-brand-primary' :
                                                'bg-gray-500/20 text-[var(--brand-text-secondary)]'
                                        }`}>
                                        <Layers className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-medium text-gray-200 group-hover:text-[var(--brand-text-primary)] truncate">
                                            {project.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded-xl ${project.status === 'active' ? 'bg-brand-primary/10 text-brand-primary' :
                                                    project.status === 'upcoming' ? 'bg-brand-primary/10 text-brand-primary' :
                                                        'bg-gray-500/10 text-[var(--brand-text-secondary)]'
                                                }`}>
                                                {project.status}
                                            </span>
                                            <span className="text-xs text-[var(--brand-text-muted)] flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <Check className="h-4 w-4 text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
