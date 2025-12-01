import React, { useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { X, Check, Zap, Clock, ArrowRight, Plus, Brain, Link2 } from 'lucide-react'
import { Project } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'
import { haptic } from '../../utils/haptics'

interface ReviewDeckProps {
    projects: Project[]
    onClose: () => void
}

export function ReviewDeck({ projects, onClose }: ReviewDeckProps) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [direction, setDirection] = useState<'left' | 'right' | 'up' | null>(null)
    const { updateProject } = useProjectStore()
    const { addToast } = useToast()

    // If we've gone through all projects
    if (currentIndex >= projects.length) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="premium-card p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                        <Check className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">All Caught Up!</h2>
                    <p className="text-slate-400 mb-6">You've reviewed all your dormant projects.</p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }

    const currentProject = projects[currentIndex]

    const handleSwipe = async (dir: 'left' | 'right' | 'up') => {
        setDirection(dir)
        haptic.medium()

        // Wait for animation
        setTimeout(async () => {
            if (dir === 'right') {
                // Mark Active
                await updateProject(currentProject.id, { status: 'active', last_active: new Date().toISOString() })
                addToast({ title: 'Marked Active', description: `${currentProject.title} is back in rotation.` })
            } else if (dir === 'left') {
                // Snooze (Update last_active to now so it disappears from dormant list for 14 days)
                // Or we could have a specific 'snoozed_until' field, but updating last_active is a simple hack for "I looked at it"
                await updateProject(currentProject.id, { last_active: new Date().toISOString() })
                addToast({ title: 'Snoozed', description: `We'll remind you about ${currentProject.title} later.` })
            } else if (dir === 'up') {
                // Micro-Action: Add a generic "Review" task
                const tasks = currentProject.metadata?.tasks || []
                const newTask = {
                    id: crypto.randomUUID(),
                    text: "Review project status and next steps",
                    done: false,
                    created_at: new Date().toISOString(),
                    order: tasks.length
                }
                await updateProject(currentProject.id, {
                    last_active: new Date().toISOString(),
                    metadata: { ...currentProject.metadata, tasks: [...tasks, newTask] }
                })
                addToast({ title: 'Task Added', description: 'Added "Review project" to task list.' })
            }

            setDirection(null)
            setCurrentIndex(prev => prev + 1)
        }, 200)
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="absolute top-4 right-4">
                <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white">
                    <X className="h-6 w-6" />
                </button>
            </div>

            <div className="w-full max-w-md mb-8 text-center">
                <h2 className="text-xl font-bold text-white">Review Dormant Projects</h2>
                <p className="text-sm text-slate-400">{currentIndex + 1} of {projects.length}</p>
            </div>

            <div className="relative w-full max-w-md aspect-[3/4]">
                <AnimatePresence mode='popLayout'>
                    <Card
                        key={currentProject.id}
                        project={currentProject}
                        onSwipe={handleSwipe}
                    />
                </AnimatePresence>
            </div>

            <div className="mt-8 flex items-center gap-6">
                <button onClick={() => handleSwipe('left')} className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                        <Clock className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium">Snooze</span>
                </button>

                <button onClick={() => handleSwipe('up')} className="flex flex-col items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors">
                    <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50">
                        <Zap className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-medium">Action</span>
                </button>

                <button onClick={() => handleSwipe('right')} className="flex flex-col items-center gap-2 text-emerald-400 hover:text-emerald-300 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                        <Check className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium">Active</span>
                </button>
            </div>
        </div>
    )
}

function Card({ project, onSwipe }: { project: Project, onSwipe: (dir: 'left' | 'right' | 'up') => void }) {
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const rotate = useTransform(x, [-200, 200], [-10, 10])
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0])

    // Overlay colors
    const leftColor = useTransform(x, [-150, 0], [1, 0])
    const rightColor = useTransform(x, [0, 150], [0, 1])
    const upColor = useTransform(y, [0, -150], [0, 1])

    const handleDragEnd = (_: any, info: any) => {
        const offset = info.offset
        if (offset.x > 100) onSwipe('right')
        else if (offset.x < -100) onSwipe('left')
        else if (offset.y < -100) onSwipe('up')
    }

    return (
        <motion.div
            style={{ x, y, rotate, opacity }}
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden cursor-grab active:cursor-grabbing"
        >
            {/* Status Overlays */}
            <motion.div style={{ opacity: leftColor }} className="absolute inset-0 bg-slate-500/20 z-10 flex items-center justify-end pr-8 pointer-events-none">
                <span className="text-4xl font-bold text-slate-300 uppercase tracking-widest border-4 border-slate-300 p-2 rounded-lg transform rotate-12">Snooze</span>
            </motion.div>
            <motion.div style={{ opacity: rightColor }} className="absolute inset-0 bg-emerald-500/20 z-10 flex items-center justify-start pl-8 pointer-events-none">
                <span className="text-4xl font-bold text-emerald-400 uppercase tracking-widest border-4 border-emerald-400 p-2 rounded-lg transform -rotate-12">Active</span>
            </motion.div>
            <motion.div style={{ opacity: upColor }} className="absolute inset-0 bg-blue-500/20 z-10 flex items-end justify-center pb-8 pointer-events-none">
                <span className="text-4xl font-bold text-blue-400 uppercase tracking-widest border-4 border-blue-400 p-2 rounded-lg">Action</span>
            </motion.div>

            <div className="h-full flex flex-col p-6">
                <div className="flex-1">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Last active {project.last_active ? new Date(project.last_active).toLocaleDateString() : 'Never'}
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-4">{project.title}</h3>
                    <p className="text-slate-300 text-lg leading-relaxed">
                        {project.description || "No description provided."}
                    </p>

                    {/* Stats / Metadata */}
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-2xl font-bold text-white">{project.metadata?.tasks?.length || 0}</div>
                            <div className="text-xs text-slate-400 uppercase">Tasks</div>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="text-2xl font-bold text-white">{project.metadata?.tags?.length || 0}</div>
                            <div className="text-xs text-slate-400 uppercase">Tags</div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-white/10 text-center text-sm text-slate-500">
                    Swipe Right to Activate • Left to Snooze • Up to Add Task
                </div>
            </div>
        </motion.div>
    )
}
