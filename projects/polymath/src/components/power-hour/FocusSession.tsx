import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronRight, Zap, Loader2, PenTool, Sparkles } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import { FocusSummary } from './FocusSummary'

// Helper for formatting time
const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    // const s = seconds % 60
    // Keep it minimal - just minutes is often enough for "Zen" feel, 
    // but users might want to know if it's 5m or 50m.
    return `${m}m`
}

export function FocusSession() {
    const {
        status,
        tasks,
        currentTaskIndex,
        elapsedSeconds,
        completeTask,
        skipTask,
        endSession,
        tick,
        projectId
    } = useFocusStore()

    const { updateProject, allProjects } = useProjectStore() // To actually mark tasks done in DB
    const { createMemory } = useMemoryStore() // For Park Thought
    const { addToast } = useToast()

    const [parkInput, setParkInput] = useState('')
    const [isParking, setIsParking] = useState(false)
    const parkInputRef = useRef<HTMLInputElement>(null)

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (status === 'focusing') {
            interval = setInterval(tick, 1000)
        }
        return () => clearInterval(interval)
    }, [status, tick])

    // Focus input when parking starts
    useEffect(() => {
        if (isParking) {
            setTimeout(() => parkInputRef.current?.focus(), 100)
        }
    }, [isParking])

    const currentTask = tasks[currentTaskIndex]
    // If we've gone past the last task
    const isAllDone = currentTaskIndex >= tasks.length

    // Get project context for colors/theme
    const project = allProjects.find(p => p.id === projectId)

    // Handlers
    const handleComplete = async () => {
        if (!currentTask || !project) return

        haptic.success()
        completeTask(currentTask.id)

        // Sync to actual project in background
        const projectTasks = [...(project.metadata?.tasks || [])]
        const taskToUpdate = projectTasks.find((t: any) => t.id === currentTask.id || t.text === currentTask.text)

        if (taskToUpdate) {
            taskToUpdate.done = true
            taskToUpdate.completed_at = new Date().toISOString()
            await updateProject(project.id, {
                metadata: {
                    ...project.metadata,
                    tasks: projectTasks
                }
            })
        }
    }

    const handleParkThought = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!parkInput.trim()) {
            setIsParking(false)
            return
        }

        const text = parkInput
        setParkInput('')
        setIsParking(false)

        // Optimistic UI interaction first
        haptic.light()
        addToast({ title: "Thought parked", variant: "default" })

        // Save in background
        createMemory({
            body: text,
            title: "Parked Thought (Focus Session)",
            // source: "focus_session", // Removed as it caused type error
            memory_type: "quick-note" // Corrected type
        })
    }

    if (status === 'idle') return null
    if (status === 'summary') return <FocusSummary />

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#09090b] text-[#E2E8F0] flex flex-col overflow-hidden"
        >
            {/* Header / Top Bar */}
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-2 opacity-50">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest">Focus Mode</span>
                </div>

                <button
                    onClick={endSession}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors opacity-50 hover:opacity-100"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-3xl mx-auto w-full relative">

                {/* Park Thought Overlay */}
                <AnimatePresence>
                    {isParking && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 z-20 flex items-center justify-center bg-[#09090b]/90 backdrop-blur-md"
                        >
                            <form onSubmit={handleParkThought} className="w-full max-w-md">
                                <label className="block text-xs font-bold uppercase tracking-widest text-[#94a3b8] mb-2">
                                    Park a stray thought
                                </label>
                                <input
                                    ref={parkInputRef}
                                    type="text"
                                    value={parkInput}
                                    onChange={e => setParkInput(e.target.value)}
                                    placeholder="Get it out of your head..."
                                    className="w-full bg-transparent border-b-2 border-white/20 text-xl py-2 outline-none focus:border-white/50 transition-colors placeholder:text-white/20"
                                    onBlur={() => {
                                        // Optional: close on blur if empty? 
                                        // kept manual close for now to avoid losing thought accidentally
                                    }}
                                />
                                <div className="flex justify-end gap-4 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsParking(false)}
                                        className="text-sm text-[#64748b] hover:text-white transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="text-sm font-bold text-white bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
                                    >
                                        Park It
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Task Display */}
                <AnimatePresence mode="wait">
                    {isAllDone ? (
                        <motion.div
                            key="all-done"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center"
                        >
                            <h2 className="text-4xl font-serif text-white mb-4">Session Complete</h2>
                            <p className="text-[#94a3b8] mb-8">You've cleared the list.</p>
                            <button
                                onClick={endSession}
                                className="px-8 py-3 bg-white text-black font-medium rounded-full hover:bg-[#cbd5e1] transition-colors"
                            >
                                Wrap Up
                            </button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key={currentTask?.id || 'loading'}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="text-center w-full"
                        >
                            <div className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-[#64748b]">
                                Current Task {currentTaskIndex + 1} of {tasks.length}
                            </div>

                            <h1 className="text-3xl md:text-5xl font-medium font-serif leading-tight mb-12 text-[#f1f5f9]">
                                {currentTask?.text}
                            </h1>

                            <div className="flex items-center justify-center gap-6">
                                {/* Complete Button (Big) */}
                                <button
                                    onClick={handleComplete}
                                    className="group relative flex items-center justify-center w-24 h-24 rounded-full border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all"
                                >
                                    <div className="absolute inset-0 rounded-full border border-white/5 scale-110 group-hover:scale-125 transition-transform duration-500 opacity-50" />
                                    <Check className="h-8 w-8 text-[#cbd5e1] group-hover:text-white transition-colors" />
                                    <span className="sr-only">Complete Task</span>
                                </button>

                                {/* Skip Button (Small) */}
                                <button
                                    onClick={skipTask}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-4 text-[#475569] hover:text-[#94a3b8] transition-colors"
                                    title="Skip for now"
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* Bottom Controls */}
            <div className="p-8 flex items-end justify-between">

                {/* Timer (Minimalist) */}
                <div className="flex flex-col gap-1">
                    <div className="text-4xl font-light tabular-nums text-[#475569] font-serif">
                        {formatTime(elapsedSeconds)}
                    </div>
                    {/* Subtle progress bar could go here if we had a target duration */}
                </div>

                {/* Park Thought Trigger */}
                <button
                    onClick={() => setIsParking(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 text-[#64748b] hover:text-[#e2e8f0] hover:bg-white/5 transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    <PenTool className="h-3 w-3" />
                    Park Thought
                </button>
            </div>
        </motion.div>
    )
}
