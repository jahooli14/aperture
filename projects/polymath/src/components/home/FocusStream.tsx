import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Clock, Battery, ArrowRight, Sparkles, RefreshCw, CheckCircle2, Zap } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useNavigate } from 'react-router-dom'
import { ReviewDeck } from '../projects/ReviewDeck'
import { formatDistanceToNow } from 'date-fns'

export function FocusStream() {
    const navigate = useNavigate()
    const { allProjects, updateProject } = useProjectStore()
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
        // Random for now, but could be smarter
        return activeProjects[Math.floor(Math.random() * activeProjects.length)]
    }, [allProjects])

    // Determine Energy Level based on time (Mock logic)
    useEffect(() => {
        const hour = new Date().getHours()
        let energy = 'moderate'
        if (hour >= 9 && hour < 12) energy = 'high'
        if (hour >= 14 && hour < 16) energy = 'low'
        if (hour >= 20) energy = 'low'

        setTimeContext(prev => ({ ...prev, hour, energy }))
    }, [])

    if (allProjects.length === 0) return null

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-amber-400" />
                <h2 className="text-xl font-bold premium-text-platinum">
                    Focus Stream
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: Review Dormant Projects */}
                {dormantProjects.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="premium-card p-5 relative overflow-hidden group cursor-pointer"
                        onClick={() => setShowReviewDeck(true)}
                        style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Layers className="h-24 w-24" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300">
                                    Review Mode
                                </span>
                                <span className="text-xs text-slate-400">
                                    {dormantProjects.length} projects waiting
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1">
                                Dust off your archives
                            </h3>
                            <p className="text-sm text-slate-300 mb-4 line-clamp-2">
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
                        className="premium-card p-5 relative overflow-hidden group cursor-pointer"
                        onClick={() => navigate(`/projects/${sparkCandidate.id}`)}
                        style={{
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(30, 41, 59, 0.6))',
                            border: '1px solid rgba(16, 185, 129, 0.2)'
                        }}
                    >
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sparkles className="h-24 w-24" />
                        </div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                                    <Battery className="h-3 w-3" /> {timeContext.energy} Energy
                                </span>
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> ~20 min
                                </span>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-1">
                                Spark: {sparkCandidate.title}
                            </h3>
                            <p className="text-sm text-slate-300 mb-4 line-clamp-2">
                                Fits your current {timeContext.energy} energy level.
                                {sparkCandidate.metadata?.tasks?.find((t: any) => !t.done)?.text
                                    ? ` Next step: "${sparkCandidate.metadata.tasks.find((t: any) => !t.done).text}"`
                                    : " Why not add a quick thought or link an article?"}
                            </p>

                            <button className="text-sm font-medium text-emerald-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                                Open Project <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
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
