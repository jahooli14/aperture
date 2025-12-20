import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Clock } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useNavigate } from 'react-router-dom'
import { ReviewDeck } from '../projects/ReviewDeck'
import { PROJECT_COLORS } from '../projects/ProjectCard'

export function FocusStream() {
    const navigate = useNavigate()
    const { allProjects, loading, initialized } = useProjectStore()
    const [showReviewDeck, setShowReviewDeck] = useState(false)

    // 1. Identify Dormant Projects (> 14 days inactive)
    const dormantProjects = useMemo(() => {
        const fourteenDaysAgo = new Date()
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

        return allProjects
            .filter(p => p.status !== 'completed' && p.status !== 'archived')
            .filter(p => {
                const lastActive = p.last_active ? new Date(p.last_active) : new Date(p.created_at)
                return lastActive < fourteenDaysAgo
            })
            .sort((a, b) => {
                // Oldest first
                const dateA = a.last_active ? new Date(a.last_active) : new Date(a.created_at)
                const dateB = b.last_active ? new Date(b.last_active) : new Date(b.created_at)
                return dateA.getTime() - dateB.getTime()
            })
    }, [allProjects])

    // 3. Priority Project
    const priorityProject = useMemo(() => {
        return allProjects.find(p => p.is_priority && p.status === 'active')
    }, [allProjects])

    // 4. Recent Project (Most active non-priority)
    const recentProject = useMemo(() => {
        return allProjects
            .filter(p => p.status === 'active' && p.id !== priorityProject?.id)
            .sort((a, b) => {
                const dateA = a.last_active ? new Date(a.last_active) : new Date(a.created_at)
                const dateB = b.last_active ? new Date(b.last_active) : new Date(b.created_at)
                return dateB.getTime() - dateA.getTime()
            })[0]
    }, [allProjects, priorityProject])


    // Pre-fetch AI suggestions for top dormant projects
    useEffect(() => {
        if (dormantProjects.length === 0) return

        // Only pre-fetch for the first 3 to save resources
        const projectsToPreload = dormantProjects.slice(0, 3)

        projectsToPreload.forEach(project => {
            // Fire and forget - this will trigger generation if needed
            // fetch(`/api/projects?resource=next-steps&id=${project.id}`)
            //     .catch(err => console.error(`Failed to pre-fetch suggestions for ${project.id}`, err))
        })
    }, [dormantProjects])


    const getTheme = (type: string, title: string) => {
        const t = type?.toLowerCase().trim() || ''

        let rgb = PROJECT_COLORS[t]

        // Deterministic fallback if type is unknown or missing
        if (!rgb) {
            const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
            let hash = 0
            for (let i = 0; i < title.length; i++) {
                hash = title.charCodeAt(i) + ((hash << 5) - hash)
            }
            rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
        }

        return {
            borderColor: `rgba(${rgb}, 0.25)`,
            backgroundColor: `rgba(${rgb}, 0.08)`,
            textColor: `rgb(${rgb})`,
            rgb: rgb
        }
    }



    if (allProjects.length === 0) return null

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="mb-0">
                <h2 className="section-header">
                    keep the <span>momentum</span>
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 0: Priority Project */}
                {priorityProject && (() => {
                    const theme = getTheme(priorityProject.type || 'other', priorityProject.title)
                    const nextTask = (priorityProject.metadata?.tasks || []).sort((a: any, b: any) => a.order - b.order).find((t: any) => !t.done)
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 relative overflow-hidden group cursor-pointer aperture-card transition-all duration-300 flex flex-col"
                            style={{
                                borderColor: theme.borderColor,
                                background: `rgba(${theme.rgb}, 0.08)`,
                                boxShadow: `0 8px 32px rgba(${theme.rgb}, 0.15)`
                            }}
                            onClick={() => navigate(`/projects/${priorityProject.id}`)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = `rgba(${theme.rgb}, 0.15)`
                                e.currentTarget.style.borderColor = theme.textColor
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = `rgba(${theme.rgb}, 0.08)`
                                e.currentTarget.style.borderColor = theme.borderColor
                            }}
                        >
                            <div className="relative z-10 flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border aperture-header" style={{
                                        backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                        color: theme.textColor,
                                        borderColor: `rgba(${theme.rgb}, 0.3)`
                                    }}>
                                        Priority
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 aperture-header">
                                    {priorityProject.title}
                                </h3>
                                <p className="text-sm text-[var(--brand-text-secondary)] mb-6 line-clamp-2 leading-relaxed aperture-body">
                                    {priorityProject.description || 'Keep moving forward on your top priority.'}
                                </p>

                                {nextTask && (
                                    <div className="p-4 rounded-xl" style={{
                                        backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                        border: `1px solid rgba(${theme.rgb}, 0.2)`
                                    }}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 aperture-header" style={{ color: theme.textColor }}>NEXT STEP</p>
                                        <p className="text-sm text-gray-200 line-clamp-2 aperture-body">{nextTask.text}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )
                })()}

                {/* Card 0.5: Recent Project */}
                {recentProject && (() => {
                    const theme = getTheme(recentProject.type || 'other', recentProject.title)
                    const nextTask = (recentProject.metadata?.tasks || []).sort((a: any, b: any) => a.order - b.order).find((t: any) => !t.done)
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 relative overflow-hidden group cursor-pointer aperture-card transition-all duration-300 flex flex-col"
                            transition={{ delay: 0.05 }}
                            style={{
                                borderColor: theme.borderColor,
                                background: theme.backgroundColor || `rgba(${theme.rgb}, 0.08)`,
                                boxShadow: 'none'
                            }}
                            onClick={() => navigate(`/projects/${recentProject.id}`)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = `rgba(${theme.rgb}, 0.15)`
                                e.currentTarget.style.borderColor = theme.textColor
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = `rgba(${theme.rgb}, 0.08)`
                                e.currentTarget.style.borderColor = theme.borderColor
                            }}
                        >
                            <div className="relative z-10 flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border aperture-header" style={{
                                        backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                        color: theme.textColor,
                                        borderColor: `rgba(${theme.rgb}, 0.3)`
                                    }}>
                                        <Clock className="h-3 w-3" /> Recent
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 aperture-header">
                                    {recentProject.title}
                                </h3>
                                <p className="text-sm text-[var(--brand-text-secondary)] mb-6 line-clamp-2 leading-relaxed aperture-body">
                                    {recentProject.description || 'Pick up where you left off.'}
                                </p>

                                {nextTask && (
                                    <div className="p-4 rounded-xl" style={{
                                        backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                        border: `1px solid rgba(${theme.rgb}, 0.2)`
                                    }}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2 aperture-header" style={{ color: theme.textColor }}>NEXT STEP</p>
                                        <p className="text-sm text-gray-200 line-clamp-2 aperture-body">{nextTask.text}</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )
                })()}

                {/* Card 1: Review Dormant Projects */}
                {dormantProjects.length > 0 && (() => {
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 relative overflow-hidden group cursor-pointer aperture-card transition-all duration-300 md:col-span-2 flex flex-col"
                            onClick={() => setShowReviewDeck(true)}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--brand-glass-bg)'
                            }}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Layers className="h-24 w-24" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-white/10 aperture-header text-[var(--brand-text-muted)] bg-white/5">
                                        Review Mode
                                    </span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header">
                                        {dormantProjects.length} projects waiting
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white mb-2 aperture-header">
                                    Dust off your archives
                                </h3>
                                <p className="text-sm text-[var(--brand-text-secondary)] line-clamp-2 leading-relaxed aperture-body">
                                    You have {dormantProjects.length} projects that haven't been touched in over 2 weeks.
                                    Take a moment to decide their future.
                                </p>
                            </div>
                        </motion.div>
                    )
                })()}
            </div>

            {/* Review Deck Modal */}
            <AnimatePresence>
                {showReviewDeck && (
                    <ReviewDeck
                        projects={dormantProjects}
                        onClose={() => setShowReviewDeck(false)}
                    />
                )}
            </AnimatePresence>
        </section>
    )
}
