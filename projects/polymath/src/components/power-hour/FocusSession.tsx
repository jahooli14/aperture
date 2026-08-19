import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { Check, X, PenTool } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import { FocusSummary } from './FocusSummary'
import { FocusSessionOverviewSheet } from './FocusSessionOverviewSheet'

// Helper for formatting time
const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    return `${m}m`
}

export function FocusSession() {
    const location = useLocation()
    const {
        status,
        phase,
        tasks,
        currentTaskIndex,
        elapsedSeconds,
        plannedDurationMinutes,
        completeTask,
        skipTask,
        endSession,
        tick,
        projectId
    } = useFocusStore()

    const { updateProject, allProjects } = useProjectStore()
    const { createMemory } = useMemoryStore()
    const { addToast } = useToast()

    const [parkInput, setParkInput] = useState('')
    const [isParking, setIsParking] = useState(false)
    const parkInputRef = useRef<HTMLInputElement>(null)

    // Timer effect — only runs during task phase
    useEffect(() => {
        let interval: NodeJS.Timeout
        if (status === 'focusing' && phase === 'tasks') {
            interval = setInterval(tick, 1000)
        }
        return () => clearInterval(interval)
    }, [status, phase, tick])

    // Focus input when parking starts
    useEffect(() => {
        if (isParking) {
            setTimeout(() => parkInputRef.current?.focus(), 100)
        }
    }, [isParking])

    const currentTask = tasks[currentTaskIndex]
    const isAllDone = currentTaskIndex >= tasks.length

    // Get project context
    const project = allProjects.find(p => p.id === projectId)

    // Handlers
    const handleComplete = async () => {
        if (!currentTask || !project) return

        haptic.success()
        completeTask(currentTask.id)

        // Sync to actual project in background. Map to NEW task objects — a
        // shallow [...] copy still shares the objects with the store, so
        // mutating taskToUpdate.done would change store state outside React's
        // update path.
        const existingTasks = (project.metadata?.tasks || []) as any[]
        const matched = existingTasks.some((t: any) => t.id === currentTask.id || t.text === currentTask.text)

        if (matched) {
            const projectTasks = existingTasks.map((t: any) =>
                (t.id === currentTask.id || t.text === currentTask.text)
                    ? { ...t, done: true, completed_at: new Date().toISOString() }
                    : t
            )
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

        haptic.light()
        addToast({ title: "Thought parked", variant: "default" })

        createMemory({
            body: text,
            title: "Parked Thought (Focus Session)",
            memory_type: "quick-note"
        })
    }

    if (status === 'idle') return null
    if (status === 'summary') return <FocusSummary />

    // ── Overview Phase ──────────────────────────────────────────
    // Rendered as a floating bottom sheet, not a full-screen takeover — see
    // FocusSessionOverviewSheet for why. If the user is already looking at
    // this exact project's own page, that page renders the same pending
    // state as an inline card instead, so skip the floating sheet here to
    // avoid showing it twice.
    if (phase === 'overview') {
        const isOnThisProjectsPage = projectId && location.pathname === `/projects/${projectId}`
        if (isOnThisProjectsPage) return null
        return <FocusSessionOverviewSheet />
    }

    // ── Task-by-Task Phase ──────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[var(--brand-bg)] text-[var(--brand-text-secondary)] flex flex-col overflow-hidden"
        >
            {/* Header / Top Bar */}
            <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-2 opacity-50">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest">Focus Mode</span>
                </div>

                <button
                    onClick={endSession}
                    className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-full transition-colors opacity-50 hover:opacity-100"
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
                            className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--brand-bg)]/90 backdrop-blur-md"
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
                                    className="w-full bg-transparent border-b-2 border-white/20 text-xl py-2 outline-none focus:border-brand-border0 transition-colors placeholder:text-[var(--brand-text-primary)]/20"
                                    onBlur={() => {}}
                                />
                                <div className="flex justify-end gap-4 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsParking(false)}
                                        className="text-sm text-[var(--brand-text-muted)] hover:text-[var(--brand-text-primary)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="text-sm font-bold text-[var(--brand-text-primary)] bg-[rgba(255,255,255,0.1)] px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
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
                            <h2 className="text-4xl font-serif text-[var(--brand-text-primary)] mb-4">Session Complete</h2>
                            <p className="text-[#94a3b8] mb-8">You've cleared the list.</p>
                            <button
                                onClick={endSession}
                                className="px-8 py-3 font-medium transition-colors"
                                style={{
                                  background: 'rgba(255,255,255,0.1)',
                                  border: '1px solid rgba(255,255,255,0.3)',
                                  borderRadius: '4px',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                  color: 'white',
                                }}
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
                            <div className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-text-muted)]">
                                Task {currentTaskIndex + 1} of {tasks.length}
                            </div>

                            <h1 className="text-3xl md:text-5xl font-medium font-serif leading-tight mb-12 text-[#f1f5f9]">
                                {currentTask?.text}
                            </h1>

                            <div className="flex items-center justify-center gap-6">
                                {/* Skip / Next Button (prominent) */}
                                <button
                                    onClick={skipTask}
                                    className="px-6 py-3 text-sm font-medium text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] border border-[var(--glass-surface-hover)] hover:border-white/20 rounded-lg transition-all"
                                    title="Skip for now"
                                >
                                    Next
                                </button>

                                {/* Complete Button */}
                                <button
                                    onClick={handleComplete}
                                    className="group relative flex items-center justify-center w-16 h-16 rounded-full border border-[var(--glass-surface-hover)] hover:border-white/30 hover:bg-[var(--glass-surface)] transition-all"
                                >
                                    <Check className="h-6 w-6 text-[var(--brand-text-secondary)] group-hover:text-[var(--brand-text-primary)] transition-colors" />
                                    <span className="sr-only">Done</span>
                                </button>
                            </div>

                            <p className="mt-4 text-[10px] text-[var(--brand-text-muted)] opacity-50">
                                Next = skip &middot; Tick = mark done
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* Bottom Controls */}
            <div className="p-8 flex items-end justify-between">

                {/* Timer (Minimalist) */}
                <div className="flex flex-col gap-1">
                    <div className="text-4xl font-light tabular-nums text-[#475569] font-serif">
                        {formatTime(elapsedSeconds)}{plannedDurationMinutes ? <span className="text-lg opacity-60"> / {plannedDurationMinutes}m</span> : ''}
                    </div>
                </div>

                {/* Park Thought Trigger */}
                <button
                    onClick={() => setIsParking(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--glass-surface)] text-[var(--brand-text-muted)] hover:text-[#e2e8f0] hover:bg-[var(--glass-surface)] transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    <PenTool className="h-3 w-3" />
                    Park Thought
                </button>
            </div>
        </motion.div>
    )
}
