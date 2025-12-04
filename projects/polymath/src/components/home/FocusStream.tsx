import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Clock, Battery, ArrowRight, Sparkles } from 'lucide-react'
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

    // 2. Identify "Spark" Candidates (Active projects that fit current time)
    const sparkCandidate = useMemo(() => {
        const activeProjects = allProjects.filter(p => p.status === 'active')
        if (activeProjects.length === 0) return null

        // Filter by energy level
        const matchingProjects = activeProjects.filter(p => {
            // Check next task's energy first
            const nextTask = p.metadata?.tasks?.sort((a: any, b: any) => a.order - b.order).find((t: any) => !t.done)
            
            if (nextTask?.energy_level) {
                return nextTask.energy_level === timeContext.energy
            }
            
            // Fallback to project energy
            const projectEnergy = p.energy_level || 'moderate'
            return projectEnergy === timeContext.energy
        })

        // Use matching projects if found, otherwise fallback to any active project
        const pool = matchingProjects.length > 0 ? matchingProjects : activeProjects
        return pool[Math.floor(Math.random() * pool.length)]
    }, [allProjects, timeContext.energy])

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

    if (allProjects.length === 0) return null

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
                background: 'var(--premium-bg-2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
                <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="h-5 w-5 text-blue-400" />
                    <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                        Keep the <span style={{ color: 'var(--premium-blue)' }}>momentum</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 0: Priority Project */}
                {priorityProject && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300"
                        onClick={() => navigate(`/projects/${priorityProject.id}`)}
                        style={{
                            background: 'var(--premium-bg-2)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--premium-bg-3)'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--premium-bg-2)'
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                    Priority
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2">
                                {priorityProject.title}
                            </h3>
                            <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                {priorityProject.description || 'Keep moving forward on your top priority.'}
                            </p>

                            <button className="text-sm font-medium text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                                Open Project <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Card 0.5: Recent Project */}
                {recentProject && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300"
                        onClick={() => navigate(`/projects/${recentProject.id}`)}
                        style={{
                            background: 'var(--premium-bg-2)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--premium-bg-3)'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--premium-bg-2)'
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Recent
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2">
                                {recentProject.title}
                            </h3>
                            <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                {recentProject.description || 'Pick up where you left off.'}
                            </p>

                            <button className="text-sm font-medium text-purple-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                                Continue <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Card 1: Review Dormant Projects */}
                {dormantProjects.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300"
                        onClick={() => setShowReviewDeck(true)}
                        style={{
                            background: 'var(--premium-bg-2)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--premium-bg-3)'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--premium-bg-2)'
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Layers className="h-24 w-24" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                    Review Mode
                                </span>
                                <span className="text-xs text-slate-500">
                                    {dormantProjects.length} projects waiting
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2">
                                Dust off your archives
                            </h3>
                            <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                You have {dormantProjects.length} projects that haven't been touched in over 2 weeks.
                                Take a moment to decide their future.
                            </p>

                            <button className="text-sm font-medium text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                                Start Review <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Card 2: Time-Aware Spark */}
                {sparkCandidate && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-5 relative overflow-hidden group cursor-pointer rounded-xl backdrop-blur-xl transition-all duration-300"
                        onClick={() => navigate(`/projects/${sparkCandidate.id}`)}
                        style={{
                            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(6, 182, 212, 0.2)',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(30, 41, 59, 0.7))'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(30, 41, 59, 0.6))'
                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)'
                        }}
                    >
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 flex items-center gap-1">
                                    <Battery className="h-3 w-3" /> {timeContext.energy} Energy
                                </span>
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> ~20 min
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-2">
                                Spark: {sparkCandidate.title}
                            </h3>
                            <p className="text-sm text-slate-400 mb-4 line-clamp-2 leading-relaxed">
                                Fits your current {timeContext.energy} energy level.
                                {sparkCandidate.metadata?.tasks?.find((t: any) => !t.done)?.text
                                    ? ` Next step: "${sparkCandidate.metadata.tasks.find((t: any) => !t.done).text}"`
                                    : ` 💡 AI Suggestion: ${[
                                        "Spend 5 minutes brainstorming next steps",
                                        "Find one article that inspires you for this",
                                        "Write down your main goal for this project",
                                        "Review your motivation notes"
                                    ][Math.floor(Math.random() * 4)]}`}
                            </p>

                            <button className="text-sm font-medium text-cyan-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                                Open Project <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
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
