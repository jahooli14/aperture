import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Clock } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useNavigate } from 'react-router-dom'
import { ReviewDeck } from '../projects/ReviewDeck'

export function FocusStream() {
    const navigate = useNavigate()
    const { allProjects } = useProjectStore()
    const [showReviewDeck, setShowReviewDeck] = useState(false)
    const [timeContext, setTimeContext] = useState({
        isWeekend: new Date().getDay() === 0 || new Date().getDay() === 6,
        hour: new Date().getHours(),
        energy: 'moderate' // simplified for now
    })

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

    // Determine Energy Level based on time (Mock logic)
    useEffect(() => {
        const hour = new Date().getHours()
        let energy = 'moderate'
        if (hour >= 9 && hour < 12) energy = 'high'
        if (hour >= 14 && hour < 16) energy = 'low'
        if (hour >= 20) energy = 'low'

        setTimeContext(prev => ({ ...prev, hour, energy }))
    }, [])

    // Pre-fetch AI suggestions for top dormant projects
    useEffect(() => {
        if (dormantProjects.length === 0) return

        // Only pre-fetch for the first 3 to save resources
        const projectsToPreload = dormantProjects.slice(0, 3)

        projectsToPreload.forEach(project => {
            // Fire and forget - this will trigger generation if needed
            fetch(`/api/projects?resource=next-steps&id=${project.id}`)
                .catch(err => console.error(`Failed to pre-fetch suggestions for ${project.id}`, err))
        })
    }, [dormantProjects])

    // Color Coding - matching ProjectCard.tsx
    const PROJECT_COLORS: Record<string, string> = {
        tech: '59, 130, 246',      // Blue-500
        technical: '59, 130, 246', // Blue-500
        creative: '236, 72, 153',  // Pink-500
        writing: '99, 102, 241',   // Indigo-500
        business: '16, 185, 129',  // Emerald-500
        learning: '245, 158, 11',  // Amber-500
        life: '6, 182, 212',       // Cyan-500
        hobby: '249, 115, 22',     // Orange-500
        content: '168, 85, 247',   // Purple-500
        'side-project': '139, 92, 246', // Violet-500
        default: '148, 163, 184'   // Slate-400
    }

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
            borderColor: `rgba(${rgb}, 0.3)`,
            textColor: `rgb(${rgb})`,
            rgb: rgb
        }
    }

    if (allProjects.length === 0) return null

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
                background: 'var(--premium-bg-2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
                <div className="mb-5">
                    <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                        Keep the <span style={{ color: 'var(--premium-blue)' }}>momentum</span>
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
                                className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300 border flex flex-col"
                                onClick={() => navigate(`/projects/${priorityProject.id}`)}
                                style={{
                                    background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`,
                                    boxShadow: `0 4px 16px rgba(${theme.rgb}, 0.2)`,
                                    borderColor: theme.borderColor
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.25), rgba(${theme.rgb}, 0.1))`
                                    e.currentTarget.style.boxShadow = `0 8px 24px rgba(${theme.rgb}, 0.3)`
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`
                                    e.currentTarget.style.boxShadow = `0 4px 16px rgba(${theme.rgb}, 0.2)`
                                }}
                            >
                                <div className="relative z-10 flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{
                                            backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                            color: theme.textColor,
                                            borderColor: `rgba(${theme.rgb}, 0.3)`
                                        }}>
                                            Priority
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2">
                                        {priorityProject.title}
                                    </h3>
                                    <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                        {priorityProject.description || 'Keep moving forward on your top priority.'}
                                    </p>

                                    {nextTask && (
                                        <div className="p-3 rounded-lg" style={{
                                            backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                            border: `1px solid rgba(${theme.rgb}, 0.3)`
                                        }}>
                                            <p className="text-xs font-medium mb-1" style={{ color: theme.textColor }}>NEXT STEP</p>
                                            <p className="text-sm text-gray-200 line-clamp-2">{nextTask.text}</p>
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
                                transition={{ delay: 0.05 }}
                                className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300 border flex flex-col"
                                onClick={() => navigate(`/projects/${recentProject.id}`)}
                                style={{
                                    background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`,
                                    boxShadow: `0 4px 16px rgba(${theme.rgb}, 0.2)`,
                                    borderColor: theme.borderColor
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.25), rgba(${theme.rgb}, 0.1))`
                                    e.currentTarget.style.boxShadow = `0 8px 24px rgba(${theme.rgb}, 0.3)`
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`
                                    e.currentTarget.style.boxShadow = `0 4px 16px rgba(${theme.rgb}, 0.2)`
                                }}
                            >
                                <div className="relative z-10 flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1 border" style={{
                                            backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                            color: theme.textColor,
                                            borderColor: `rgba(${theme.rgb}, 0.3)`
                                        }}>
                                            <Clock className="h-3 w-3" /> Recent
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2">
                                        {recentProject.title}
                                    </h3>
                                    <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                        {recentProject.description || 'Pick up where you left off.'}
                                    </p>

                                    {nextTask && (
                                        <div className="p-3 rounded-lg" style={{
                                            backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                            border: `1px solid rgba(${theme.rgb}, 0.3)`
                                        }}>
                                            <p className="text-xs font-medium mb-1" style={{ color: theme.textColor }}>NEXT STEP</p>
                                            <p className="text-sm text-gray-200 line-clamp-2">{nextTask.text}</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )
                    })()}

                    {/* Card 1: Review Dormant Projects */}
                    {dormantProjects.length > 0 && (() => {
                        const theme = getTheme('business', 'Review')
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300 border"
                                onClick={() => setShowReviewDeck(true)}
                                style={{
                                    background: `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`,
                                    boxShadow: `0 4px 16px rgba(${theme.rgb}, 0.2)`,
                                    borderColor: theme.borderColor
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.25), rgba(${theme.rgb}, 0.1))`
                                    e.currentTarget.style.boxShadow = `0 8px 24px rgba(${theme.rgb}, 0.3)`
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = `linear-gradient(135deg, rgba(${theme.rgb}, 0.15), rgba(${theme.rgb}, 0.05))`
                                    e.currentTarget.style.boxShadow = `0 4px 16px rgba(${theme.rgb}, 0.2)`
                                }}
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Layers className="h-24 w-24" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{
                                            backgroundColor: `rgba(${theme.rgb}, 0.1)`,
                                            color: theme.textColor,
                                            borderColor: `rgba(${theme.rgb}, 0.3)`
                                        }}>
                                            Review Mode
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {dormantProjects.length} projects waiting
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2">
                                        Dust off your archives
                                    </h3>
                                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                                        You have {dormantProjects.length} projects that haven't been touched in over 2 weeks.
                                        Take a moment to decide their future.
                                    </p>
                                </div>
                            </motion.div>
                        )
                    })()}

                </div>
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
