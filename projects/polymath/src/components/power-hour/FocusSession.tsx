import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, ChevronRight, Loader2, PenTool, ArrowRight } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import { FocusSummary } from './FocusSummary'

// Helper for formatting time
const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    return `${m}m`
}

// Group tasks by their ID prefix for the overview
function groupTasks(tasks: { id: string; text: string }[]) {
    const ignition = tasks.filter(t => t.id.startsWith('ign-'))
    const core = tasks.filter(t => t.id.startsWith('core-'))
    const shutdown = tasks.filter(t => t.id.startsWith('shut-'))
    // If no prefix-based grouping works, treat all as core
    if (ignition.length === 0 && core.length === 0 && shutdown.length === 0) {
        return [{ label: 'Tasks', tasks }]
    }
    const groups = []
    if (ignition.length > 0) groups.push({ label: 'Warm up', tasks: ignition })
    if (core.length > 0) groups.push({ label: 'Core work', tasks: core })
    if (shutdown.length > 0) groups.push({ label: 'Wind down', tasks: shutdown })
    return groups
}

export function FocusSession() {
    const {
        status,
        phase,
        tasks,
        currentTaskIndex,
        elapsedSeconds,
        beginTasks,
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
    if (phase === 'overview') {
        const taskGroups = groupTasks(tasks)

        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-[var(--brand-bg)] text-[var(--brand-text-secondary)] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-2 opacity-50">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest">Session Plan</span>
                    </div>
                    <button
                        onClick={() => { endSession(); useFocusStore.getState().reset() }}
                        className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-full transition-colors opacity-50 hover:opacity-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Task Overview */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-lg mx-auto w-full overflow-y-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="w-full"
                    >
                        {project && (
                            <h2 className="text-2xl font-serif text-[var(--brand-text-primary)] mb-1 text-center">
                                {project.title}
                            </h2>
                        )}
                        <p className="text-xs text-[var(--brand-text-muted)] text-center mb-8">
                            {tasks.length} task{tasks.length !== 1 ? 's' : ''} planned
                        </p>

                        <div className="space-y-6 mb-10">
                            {taskGroups.map((group, gi) => (
                                <motion.div
                                    key={group.label}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 + gi * 0.08 }}
                                >
                                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-text-muted)] mb-3">
                                        {group.label}
                                    </h3>
                                    <ul className="space-y-2">
                                        {group.tasks.map((task, ti) => (
                                            <motion.li
                                                key={task.id}
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 + gi * 0.08 + ti * 0.04 }}
                                                className="text-sm text-[var(--brand-text-secondary)] leading-relaxed flex items-start gap-3"
                                            >
                                                <span className="w-1 h-1 rounded-full bg-[var(--brand-text-muted)] mt-2 flex-shrink-0" />
                                                {task.text}
                                            </motion.li>
                                        ))}
                                    </ul>
                                </motion.div>
                            ))}
                        </div>

                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            onClick={() => { haptic.medium(); beginTasks() }}
                            className="w-full py-3 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110"
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.25)',
                                borderRadius: '4px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                color: 'white',
                            }}
                        >
                            Begin
                            <ArrowRight className="h-3.5 w-3.5" />
                        </motion.button>
                    </motion.div>
                </div>
            </motion.div>
        )
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
                        {formatTime(elapsedSeconds)}
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
