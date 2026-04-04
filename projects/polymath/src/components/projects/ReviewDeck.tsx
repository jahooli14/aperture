import React, { useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { X, Check, Zap, Clock, ArrowRight, Plus, Brain, Link2, Archive } from 'lucide-react'
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
    const [showTaskInput, setShowTaskInput] = useState(false)
    const [taskInput, setTaskInput] = useState('')
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [suggestionIndex, setSuggestionIndex] = useState(0)
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
    const { updateProject } = useProjectStore()
    const { addToast } = useToast()

    // Safe access for hooks
    const currentProject = projects[currentIndex]

    // Fetch AI suggestions when project changes
    React.useEffect(() => {
        if (!currentProject) return

        const fetchSuggestions = async () => {
            setIsLoadingSuggestions(true)
            try {
                const res = await fetch(`/api/projects?resource=next-steps&id=${currentProject.id}`)
                if (res.ok) {
                    const data = await res.json()
                    if (data.suggestions && data.suggestions.length > 0) {
                        setSuggestions(data.suggestions.map((s: any) => s.suggested_task))
                        setSuggestionIndex(0)
                    } else {
                        setSuggestions([])
                    }
                }
            } catch (error) {
                console.error('Failed to fetch suggestions:', error)
            } finally {
                setIsLoadingSuggestions(false)
            }
        }

        fetchSuggestions()
    }, [currentProject?.id])

    // If we've gone through all projects
    if (!currentProject) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="premium-card p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 rounded-full bg-brand-primary/20 flex items-center justify-center mx-auto mb-4">
                        <Check className="h-8 w-8 text-brand-text-secondary" />
                    </div>
                    <h2 className="text-2xl font-bold text-[var(--brand-text-primary)] mb-2">All Caught Up!</h2>
                    <p className="text-[var(--brand-text-secondary)] mb-6">You've reviewed all your dormant projects.</p>
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-brand-primary text-[var(--brand-text-primary)] font-bold hover:bg-brand-primary transition-colors"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        )
    }



    const handleSwipe = async (dir: 'left' | 'right' | 'up') => {
        if (dir === 'up') {
            // Intercept 'up' swipe to show input
            setShowTaskInput(true)
            // Generate suggestion based on project state
            const tasks = currentProject.metadata?.tasks || []
            const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null

            let suggestion = "Brainstorm next steps"

            // Prioritize AI suggestions if available
            if (suggestions.length > 0) {
                suggestion = suggestions[0]
            } else {
                // Fallback logic
                if (!currentProject.description) suggestion = "Draft project description"
                else if (tasks.length === 0) suggestion = "Create initial task list"
                else if (lastTask && lastTask.done) suggestion = `Follow up on: ${lastTask.text}`
                else if (currentProject.type === 'Writing') suggestion = "Outline next chapter"
                else if (currentProject.type === 'Tech') suggestion = "Review codebase status"
                else if (currentProject.type === 'Creative') suggestion = "Gather inspiration"
                else if (lastTask) suggestion = `Review output of: ${lastTask.text}`
            }

            setTaskInput(suggestion)
            return
        }

        setDirection(dir)
        haptic.medium()

        // Wait for animation
        setTimeout(async () => {
            if (dir === 'right') {
                // Mark Active
                await updateProject(currentProject.id, { status: 'active', last_active: new Date().toISOString() })
                addToast({ title: 'Marked Active', description: `${currentProject.title} is back in rotation.` })
            } else if (dir === 'left') {
                // Snooze
                await updateProject(currentProject.id, { last_active: new Date().toISOString() })
                addToast({ title: 'Snoozed', description: `We'll remind you about ${currentProject.title} later.` })
            }

            setDirection(null)
            setCurrentIndex(prev => prev + 1)
        }, 200)
    }

    const handleGraveyard = async () => {
        haptic.medium()
        await updateProject(currentProject.id, { status: 'graveyard' })
        addToast({ title: 'Sent to Graveyard', description: `${currentProject.title} has been archived.` })
        setCurrentIndex(prev => prev + 1)
    }

    const handleTaskSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!taskInput.trim()) return

        const tasks = currentProject.metadata?.tasks || []
        const newTask = {
            id: crypto.randomUUID(),
            text: taskInput.trim(),
            done: false,
            created_at: new Date().toISOString(),
            order: tasks.length
        }

        await updateProject(currentProject.id, {
            last_active: new Date().toISOString(),
            metadata: { ...currentProject.metadata, tasks: [...tasks, newTask] }
        })

        addToast({ title: 'Task Added', description: 'Action item created.' })
        setShowTaskInput(false)
        setTaskInput('')

        // Animate away
        setDirection('up')
        setTimeout(() => {
            setDirection(null)
            setCurrentIndex(prev => prev + 1)
        }, 200)
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <div className="absolute top-4 right-4">
                <button onClick={onClose} className="p-2 rounded-full bg-[rgba(255,255,255,0.1)] hover:bg-white/20 text-[var(--brand-text-primary)]">
                    <X className="h-6 w-6" />
                </button>
            </div>

            <div className="w-full max-w-md mb-8 text-center">
                <h2 className="text-xl font-bold text-[var(--brand-text-primary)]">Review Dormant Projects</h2>
                <p className="text-sm text-[var(--brand-text-secondary)]">{currentIndex + 1} of {projects.length}</p>
            </div>

            <div className="relative w-full max-w-md aspect-[3/4]">
                <AnimatePresence mode='popLayout'>
                    <Card
                        key={currentProject.id}
                        project={currentProject}
                        onSwipe={handleSwipe}
                    />
                </AnimatePresence>

                {/* Task Input Overlay */}
                {showTaskInput && (
                    <div className="absolute inset-0 z-20 bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-[var(--brand-text-primary)]">Add Action</h3>
                            <button onClick={() => setShowTaskInput(false)} className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-full">
                                <X className="h-5 w-5 text-[var(--brand-text-secondary)]" />
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col justify-center gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-brand-primary uppercase tracking-wider">
                                    Next Step
                                </label>
                                <textarea
                                    autoFocus
                                    value={taskInput}
                                    onChange={(e) => setTaskInput(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-[var(--brand-text-primary)] placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none h-32"
                                    placeholder="What needs to be done?"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleTaskSubmit()
                                        }
                                    }}
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTaskInput("Review project status")}
                                    className="px-3 py-2 rounded-lg bg-slate-800 text-xs text-[var(--brand-text-secondary)] hover:bg-slate-700 transition-colors"
                                >
                                    Review Status
                                </button>
                                <button
                                    onClick={() => {
                                        // Cycle through AI suggestions if available
                                        if (suggestions.length > 0) {
                                            const nextIndex = (suggestionIndex + 1) % suggestions.length
                                            setSuggestionIndex(nextIndex)
                                            setTaskInput(suggestions[nextIndex])
                                            return
                                        }

                                        // Fallback context-aware logic
                                        let suggestion = "Brainstorm next steps"
                                        const tasks = currentProject.metadata?.tasks || []
                                        const lastTask = tasks.length > 0 ? tasks[tasks.length - 1] : null

                                        if (!currentProject.description) suggestion = "Draft project description"
                                        else if (tasks.length === 0) suggestion = "Create initial task list"
                                        else if (lastTask && lastTask.done) suggestion = `Follow up on: ${lastTask.text}`
                                        else if (currentProject.type === 'Writing') suggestion = "Outline next chapter"
                                        else if (currentProject.type === 'Tech') suggestion = "Review codebase status"
                                        else if (currentProject.type === 'Creative') suggestion = "Gather inspiration"
                                        else if (lastTask) suggestion = `Review output of: ${lastTask.text}`

                                        setTaskInput(suggestion)
                                    }}
                                    className="px-3 py-2 rounded-lg bg-brand-primary/20 text-xs text-brand-primary border border-indigo-500/30 hover:bg-brand-primary/30 transition-colors flex items-center gap-1"
                                    disabled={isLoadingSuggestions}
                                >
                                    {isLoadingSuggestions ? (
                                        <Zap className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Zap className="h-3 w-3" />
                                    )}
                                    {suggestions.length > 1 ? `Suggest (${suggestionIndex + 1}/${suggestions.length})` : 'Suggest'}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => handleTaskSubmit()}
                            disabled={!taskInput.trim()}
                            className="w-full py-4 bg-brand-primary hover:bg-brand-primary disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-[var(--brand-text-primary)] font-bold flex items-center justify-center gap-2 transition-all mt-auto"
                        >
                            <Plus className="h-5 w-5" />
                            Add & Continue
                        </button>
                    </div>
                )}
            </div>

            <div className="mt-8 flex items-center gap-6">
                <button onClick={() => handleSwipe('left')} className="flex flex-col items-center gap-2 text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)] transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                        <Clock className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium">Snooze</span>
                </button>

                <button onClick={() => handleSwipe('up')} className="flex flex-col items-center gap-2 text-brand-primary hover:text-brand-primary transition-colors">
                    <div className="w-14 h-14 rounded-full bg-brand-primary/20 flex items-center justify-center border border-blue-500/50">
                        <Zap className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-medium">Action</span>
                </button>

                <button onClick={() => handleSwipe('right')} className="flex flex-col items-center gap-2 text-brand-text-secondary hover:text-brand-primary transition-colors">
                    <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center border border-emerald-500/50">
                        <Check className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium">Active</span>
                </button>

                <button onClick={handleGraveyard} className="flex flex-col items-center gap-2 text-[var(--brand-text-secondary)] hover:text-zinc-400 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-zinc-800/80 flex items-center justify-center border border-zinc-600/50">
                        <Archive className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-medium">Graveyard</span>
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
                <span className="text-4xl font-bold text-[var(--brand-text-secondary)] uppercase tracking-widest border-4 border-slate-300 p-2 rounded-lg transform rotate-12">Snooze</span>
            </motion.div>
            <motion.div style={{ opacity: rightColor }} className="absolute inset-0 bg-brand-primary/20 z-10 flex items-center justify-start pl-8 pointer-events-none">
                <span className="text-4xl font-bold text-brand-text-secondary uppercase tracking-widest border-4 border-emerald-400 p-2 rounded-lg transform -rotate-12">Active</span>
            </motion.div>
            <motion.div style={{ opacity: upColor }} className="absolute inset-0 bg-brand-primary/20 z-10 flex items-end justify-center pb-8 pointer-events-none">
                <span className="text-4xl font-bold text-brand-primary uppercase tracking-widest border-4 border-blue-400 p-2 rounded-lg">Action</span>
            </motion.div>

            <div className="h-full flex flex-col p-6">
                <div className="flex-1">
                    <div className="text-xs font-bold text-[var(--brand-text-secondary)] uppercase tracking-wider mb-2">
                        Last active {project.last_active ? new Date(project.last_active).toLocaleDateString() : 'Never'}
                    </div>
                    <h3 className="text-3xl font-bold text-[var(--brand-text-primary)] mb-4">{project.title}</h3>
                    <p className="text-[var(--brand-text-secondary)] text-lg leading-relaxed">
                        {project.description || "No description provided."}
                    </p>

                    {/* Stats / Metadata */}
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)]">
                            <div className="text-2xl font-bold text-[var(--brand-text-primary)]">{project.metadata?.tasks?.length || 0}</div>
                            <div className="text-xs text-[var(--brand-text-secondary)] uppercase">Tasks</div>
                        </div>
                        <div className="p-4 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)]">
                            <div className="text-2xl font-bold text-[var(--brand-text-primary)]">{project.metadata?.tags?.length || 0}</div>
                            <div className="text-xs text-[var(--brand-text-secondary)] uppercase">Tags</div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-[var(--glass-surface-hover)] text-center text-sm text-[var(--brand-text-muted)]">
                    Swipe Right to Activate · Left to Snooze · Up to Add Task
                </div>
            </div>
        </motion.div>
    )
}
