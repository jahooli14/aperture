import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Zap, AlertTriangle, Plus, ChevronDown, ListTodo, Target, Sparkles, History, RefreshCw, Archive, HelpCircle, ChevronRight } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface ChecklistItem {
    text: string
    is_new: boolean
    estimated_minutes: number
}

interface ProjectTask {
    id: string
    text: string
    done: boolean
    created_at?: string
    completed_at?: string
}

interface PowerTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string
    session_summary?: string
    checklist_items: ChecklistItem[]
    total_estimated_minutes: number
    impact_score: number
}

interface ProjectContext {
    motivation?: string
    endGoal?: string
    progress?: number  // 0-100
    isDormant?: boolean
    daysDormant?: number
    lastCompletedTask?: string
    projectMode?: 'completion' | 'recurring'
    completedCount?: number
}

interface PowerHourReviewProps {
    task: PowerTask
    projectColor: string
    projectTasks?: ProjectTask[]
    projectContext?: ProjectContext
    targetMinutes: number
    onClose: () => void
    onStart: (adjustedItems: ChecklistItem[], totalMinutes: number, removedAISuggestions: string[]) => void
    onArchive?: () => void
}

const DURATION_OPTIONS = [5, 15, 25, 45]
const STALE_DAYS = 21

export function PowerHourReview({
    task,
    projectColor,
    projectTasks = [],
    projectContext,
    targetMinutes = 50,
    onClose,
    onStart,
    onArchive
}: PowerHourReviewProps) {
    const MAX_MINUTES = Math.round(targetMinutes * 1.2)
    const TARGET_ZONE_MIN = Math.round(targetMinutes * 0.8)
    const TARGET_ZONE_MAX = Math.round(targetMinutes * 1.1)

    // Calculate if tasks are stale (>21 days old)
    const getTaskAge = (item: ChecklistItem): number | null => {
        const matchingTask = projectTasks.find(t => t.text.toLowerCase() === item.text.toLowerCase())
        if (!matchingTask?.created_at) return null
        const created = new Date(matchingTask.created_at)
        const now = new Date()
        return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Planning task always first
    const planningTask: ChecklistItem = {
        text: projectContext?.isDormant
            ? 'Reconnect with where you left off'
            : 'Review tasks & plan your focus',
        is_new: false,
        estimated_minutes: projectContext?.isDormant ? 5 : 3
    }

    // Initialize items with stale tasks auto-excluded
    const [items, setItems] = useState<ChecklistItem[]>(() => {
        return [
            planningTask,
            ...task.checklist_items.map(item => ({
                ...item,
                estimated_minutes: item.estimated_minutes || 15
            }))
        ]
    })

    // Auto-exclude stale tasks on init
    const [removedIndices, setRemovedIndices] = useState<Set<number>>(() => {
        const staleIndices = new Set<number>()
        task.checklist_items.forEach((item, idx) => {
            const age = getTaskAge(item)
            if (age !== null && age > STALE_DAYS) {
                staleIndices.add(idx + 1) // +1 because planning task is at index 0
            }
        })
        return staleIndices
    })

    const [showBacklog, setShowBacklog] = useState(false)
    const [showReasoningFor, setShowReasoningFor] = useState<number | null>(null)
    const [isManualMode, setIsManualMode] = useState(false)
    const [showGoalDetail, setShowGoalDetail] = useState(false)
    const [expandedTimeIdx, setExpandedTimeIdx] = useState<number | null>(null)

    // Smart backlog: sort by relevance, limit to top 5
    const availableBacklogTasks = useMemo(() => {
        const sessionTexts = new Set(items.map(i => i.text.toLowerCase()))
        const filtered = projectTasks
            .filter(t => !t.done && !sessionTexts.has(t.text.toLowerCase()))

        // Sort by relevance: recent tasks first, then by creation date
        return filtered
            .sort((a, b) => {
                // Recently created tasks get priority
                const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
                const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
                return bDate - aDate
            })
            .slice(0, 5) // Limit to top 5
    }, [projectTasks, items])

    const activeItems = useMemo(() =>
        items.filter((_, idx) => !removedIndices.has(idx)),
        [items, removedIndices]
    )

    const totalMinutes = useMemo(() =>
        activeItems.reduce((sum, item) => sum + item.estimated_minutes, 0),
        [activeItems]
    )

    // Progress toward target (with sweet spot zone)
    const progressPercent = Math.min(100, (totalMinutes / MAX_MINUTES) * 100)
    const isOvertime = totalMinutes > MAX_MINUTES
    const isIdeal = totalMinutes >= TARGET_ZONE_MIN && totalMinutes <= TARGET_ZONE_MAX
    const isUnder = totalMinutes < TARGET_ZONE_MIN

    const setDuration = (index: number, duration: number) => {
        haptic.light()
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, estimated_minutes: duration } : item
        ))
        setExpandedTimeIdx(null)
    }

    const toggleRemove = (index: number) => {
        if (index === 0) return // Can't remove planning task
        haptic.light()
        setRemovedIndices(prev => {
            const next = new Set(prev)
            if (next.has(index)) {
                next.delete(index)
            } else {
                next.add(index)
            }
            return next
        })
    }

    const addFromBacklog = (taskText: string) => {
        haptic.light()
        setItems(prev => [...prev, {
            text: taskText,
            is_new: false,
            estimated_minutes: 15
        }])
    }

    const handleStartFresh = () => {
        haptic.medium()
        setIsManualMode(true)
        // Clear all AI suggestions, keep only planning task
        setItems([planningTask])
        setRemovedIndices(new Set())
    }

    const handleStart = () => {
        haptic.heavy()
        const removedAISuggestions = items
            .filter((item, idx) => removedIndices.has(idx) && item.is_new)
            .map(item => item.text)
        onStart(activeItems, totalMinutes, removedAISuggestions)
    }

    // Generate AI reasoning for a task
    const getAIReasoning = (item: ChecklistItem, idx: number): string => {
        if (idx === 0) return ''

        const age = getTaskAge(item)
        const ageText = age !== null ? `Added ${age} days ago` : ''

        if (item.is_new) {
            if (projectContext?.progress && projectContext.progress > 70) {
                return `Suggested to help you reach the finish line. ${projectContext.endGoal ? `Drives toward: "${projectContext.endGoal}"` : ''}`
            }
            if (projectContext?.isDormant) {
                return `Low-friction task to help you reconnect after ${projectContext.daysDormant} days away.`
            }
            return `AI suggested based on your project goals and recent progress.`
        }

        return ageText || 'From your existing task list'
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="w-full max-w-lg aperture-card overflow-hidden max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                    <div>
                        <div
                            className="text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: projectColor }}
                        >
                            {task.project_title}
                        </div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-white">
                            {projectContext?.isDormant ? 'Welcome Back' : 'Plan Your Hour'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-white/50" />
                    </button>
                </div>

                {/* Context Anchor - Always visible above tasks */}
                <div className="px-4 py-3 bg-gradient-to-b from-white/[0.03] to-transparent border-b border-white/5 flex-shrink-0">
                    {/* Dormancy Reconnection Card */}
                    {projectContext?.isDormant && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-3"
                        >
                            <div className="flex items-start gap-2">
                                <Sparkles className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-amber-300 mb-1">
                                        It's been {projectContext.daysDormant} days
                                    </div>
                                    {projectContext.motivation && (
                                        <div className="text-[11px] text-amber-200/70 leading-relaxed">
                                            Remember: <span className="italic">"{projectContext.motivation}"</span>
                                        </div>
                                    )}
                                    {projectContext.lastCompletedTask && (
                                        <div className="text-[10px] text-amber-300/50 mt-2 flex items-center gap-1">
                                            <History className="h-3 w-3" />
                                            Last: "{projectContext.lastCompletedTask}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Goal / Progress Row */}
                    {!projectContext?.isDormant && (
                        <div className="flex items-center gap-3">
                            {/* Goal Pill - tappable */}
                            {projectContext?.projectMode === 'recurring' ? (
                                <div className="flex items-center gap-1.5 text-green-400/70 text-[10px]">
                                    <RefreshCw className="h-3 w-3" />
                                    <span className="font-medium">
                                        Ongoing habit • {projectContext.completedCount || 0} sessions
                                    </span>
                                </div>
                            ) : projectContext?.endGoal ? (
                                <button
                                    onClick={() => setShowGoalDetail(!showGoalDetail)}
                                    className="flex items-center gap-1.5 flex-1 min-w-0 group"
                                >
                                    <Target className="h-3 w-3 text-white/40 flex-shrink-0" />
                                    <span className="text-[10px] text-white/50 truncate group-hover:text-white/70 transition-colors">
                                        {projectContext.endGoal}
                                    </span>
                                    <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/40 flex-shrink-0" />
                                </button>
                            ) : null}

                            {/* Progress */}
                            {projectContext?.progress !== undefined && projectContext.projectMode !== 'recurring' && (
                                <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${projectContext.progress}%`,
                                                backgroundColor: projectContext.progress >= 70 ? '#22c55e' : projectColor
                                            }}
                                        />
                                    </div>
                                    <span className="text-[10px] font-bold text-white/50">
                                        {projectContext.progress}%
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Last completed task (non-dormant) */}
                    {!projectContext?.isDormant && projectContext?.lastCompletedTask && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/40">
                            <History className="h-3 w-3" />
                            <span className="truncate">Last: {projectContext.lastCompletedTask}</span>
                        </div>
                    )}
                </div>

                {/* Goal Detail Expansion */}
                <AnimatePresence>
                    {showGoalDetail && projectContext?.endGoal && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-b border-white/10"
                        >
                            <div className="p-4 bg-white/[0.02]">
                                <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2">
                                    Definition of Done
                                </div>
                                <p className="text-sm text-white/80 leading-relaxed mb-3">
                                    {projectContext.endGoal}
                                </p>
                                {projectContext.motivation && (
                                    <>
                                        <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2">
                                            Why This Matters
                                        </div>
                                        <p className="text-xs text-white/60 leading-relaxed">
                                            {projectContext.motivation}
                                        </p>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Task List - scrollable */}
                <div className="flex-1 overflow-y-auto">
                    {/* Manual Mode Banner */}
                    {isManualMode && (
                        <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
                            <div className="flex items-center gap-2 text-blue-400 text-xs">
                                <ListTodo className="h-4 w-4" />
                                <span className="font-medium">Manual Mode – Build your own session</span>
                            </div>
                        </div>
                    )}

                    <div className="p-4 space-y-2">
                        {/* Instruction hint */}
                        <p className="text-[10px] text-white/30 mb-3">
                            Tap to exclude • Tap time to change • Scroll for backlog
                        </p>

                        {items.map((item, idx) => {
                            const isRemoved = removedIndices.has(idx)
                            const isPlanningTask = idx === 0
                            const taskAge = getTaskAge(item)
                            const isStale = taskAge !== null && taskAge > STALE_DAYS
                            const showTimeOptions = expandedTimeIdx === idx

                            return (
                                <motion.div
                                    key={idx}
                                    layout
                                    className={`rounded-xl transition-all ${isPlanningTask
                                        ? 'bg-blue-500/10 border border-blue-500/20'
                                        : isRemoved
                                            ? 'bg-white/5 opacity-60'
                                            : isStale && !isRemoved
                                                ? 'bg-amber-500/5 border-l-2 border-amber-400/40'
                                                : 'bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-start gap-3 p-3">
                                        {/* Toggle Checkbox */}
                                        <button
                                            onClick={() => toggleRemove(idx)}
                                            disabled={isPlanningTask}
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all mt-0.5 ${isPlanningTask ? 'cursor-default' : ''
                                                }`}
                                            style={{
                                                borderColor: isPlanningTask
                                                    ? 'rgb(59, 130, 246)'
                                                    : isRemoved
                                                        ? 'rgba(255,255,255,0.2)'
                                                        : projectColor,
                                                backgroundColor: isPlanningTask
                                                    ? 'rgb(59, 130, 246)'
                                                    : isRemoved
                                                        ? 'transparent'
                                                        : projectColor
                                            }}
                                        >
                                            {(!isRemoved || isPlanningTask) && (
                                                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>

                                        {/* Task Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium leading-snug ${isPlanningTask
                                                ? 'text-blue-300'
                                                : isRemoved
                                                    ? 'line-through text-white/30'
                                                    : 'text-white'
                                                }`}>
                                                {item.text}
                                            </div>

                                            {/* Labels Row */}
                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                {isPlanningTask && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400">
                                                        Planning Phase
                                                    </span>
                                                )}
                                                {item.is_new && !isRemoved && !isPlanningTask && (
                                                    <span
                                                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                        style={{ backgroundColor: `${projectColor}20`, color: projectColor }}
                                                    >
                                                        AI Suggested
                                                    </span>
                                                )}
                                                {isStale && !isPlanningTask && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                                        {taskAge}d old
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* AI Reasoning Button */}
                                        {item.is_new && !isRemoved && !isPlanningTask && (
                                            <button
                                                onClick={() => setShowReasoningFor(showReasoningFor === idx ? null : idx)}
                                                className="p-1 hover:bg-white/10 rounded transition-colors"
                                            >
                                                <HelpCircle className="h-3.5 w-3.5 text-white/30" />
                                            </button>
                                        )}

                                        {/* Inline Time Picker */}
                                        {!isRemoved && (
                                            <div className="relative flex-shrink-0">
                                                <button
                                                    onClick={() => setExpandedTimeIdx(showTimeOptions ? null : idx)}
                                                    className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                                >
                                                    <span className="text-sm font-bold text-white tabular-nums">
                                                        {item.estimated_minutes}
                                                    </span>
                                                    <span className="text-[10px] text-white/50 ml-0.5">m</span>
                                                </button>

                                                {/* Expanded Time Options */}
                                                <AnimatePresence>
                                                    {showTimeOptions && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.9 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            className="absolute right-0 top-full mt-1 z-10 flex gap-1 p-1 bg-black/90 border border-white/20 rounded-lg shadow-xl"
                                                        >
                                                            {DURATION_OPTIONS.map(d => (
                                                                <button
                                                                    key={d}
                                                                    onClick={() => setDuration(idx, d)}
                                                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${item.estimated_minutes === d
                                                                        ? 'bg-white text-black'
                                                                        : 'text-white/70 hover:bg-white/10'
                                                                        }`}
                                                                >
                                                                    {d}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>

                                    {/* AI Reasoning Tooltip */}
                                    <AnimatePresence>
                                        {showReasoningFor === idx && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-3 pb-3 pt-0">
                                                    <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">
                                                            Why this task?
                                                        </div>
                                                        <p className="text-xs text-white/60 leading-relaxed">
                                                            {getAIReasoning(item, idx)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            )
                        })}
                    </div>

                    {/* Add from Backlog */}
                    {availableBacklogTasks.length > 0 && (
                        <div className="px-4 pb-4">
                            <button
                                onClick={() => {
                                    haptic.light()
                                    setShowBacklog(!showBacklog)
                                }}
                                className="w-full flex items-center justify-between p-3 rounded-xl border border-dashed border-white/20 hover:border-white/40 hover:bg-white/5 transition-all"
                            >
                                <div className="flex items-center gap-2 text-white/50">
                                    <ListTodo className="h-4 w-4" />
                                    <span className="text-xs font-medium">
                                        {isManualMode ? 'Add from your tasks' : 'Add from backlog'}
                                    </span>
                                    <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                                        {availableBacklogTasks.length}
                                    </span>
                                </div>
                                <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${showBacklog ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showBacklog && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                                            {availableBacklogTasks.map((t) => (
                                                <button
                                                    key={t.id}
                                                    onClick={() => addFromBacklog(t.text)}
                                                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/10 transition-colors text-left group"
                                                >
                                                    <Plus className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 flex-shrink-0" />
                                                    <span className="text-xs text-white/60 group-hover:text-white/80 leading-snug">
                                                        {t.text}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Start Fresh Option */}
                    {!isManualMode && (
                        <div className="px-4 pb-4">
                            <button
                                onClick={handleStartFresh}
                                className="w-full flex items-center justify-center gap-2 py-2 text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-white/50 transition-colors"
                            >
                                <RefreshCw className="h-3 w-3" />
                                Start fresh – build my own plan
                            </button>
                        </div>
                    )}
                </div>

                {/* Time Summary with Sweet Spot Zone */}
                <div className="px-4 py-3 border-t border-white/10 bg-white/5 flex-shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-white/50" />
                            <span className="text-sm text-white/70">Session Time</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={`text-xl font-bold tabular-nums ${isOvertime ? 'text-red-400' : isIdeal ? 'text-green-400' : 'text-white'
                                }`}>
                                {totalMinutes}
                            </span>
                            <span className="text-sm text-white/50">/ {targetMinutes} min</span>
                        </div>
                    </div>

                    {/* Progress bar with sweet spot zone */}
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                        {/* Sweet spot zone */}
                        <div
                            className="absolute h-full bg-green-500/20"
                            style={{
                                left: `${(TARGET_ZONE_MIN / MAX_MINUTES) * 100}%`,
                                width: `${((TARGET_ZONE_MAX - TARGET_ZONE_MIN) / MAX_MINUTES) * 100}%`
                            }}
                        />

                        {/* Actual progress */}
                        <motion.div
                            className={`h-full rounded-full transition-colors ${isOvertime ? 'bg-red-500' : isIdeal ? 'bg-green-500' : 'bg-white/50'
                                }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.3 }}
                        />

                        {/* Target marker */}
                        <div
                            className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                            style={{ left: `${(targetMinutes / MAX_MINUTES) * 100}%` }}
                        />
                    </div>

                    {/* Contextual messaging */}
                    <div className="mt-2 text-[11px] text-center">
                        {isOvertime && (
                            <span className="text-red-400 flex items-center justify-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Remove {totalMinutes - MAX_MINUTES}m to start
                            </span>
                        )}
                        {isIdeal && (
                            <span className="text-green-400">
                                Perfect! Right in the sweet spot
                            </span>
                        )}
                        {isUnder && !isOvertime && (
                            <span className="text-white/40">
                                Add {TARGET_ZONE_MIN - totalMinutes}m for a full session
                            </span>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-t border-white/10 flex-shrink-0">
                    <div className="flex gap-3">
                        {/* Archive option for dormant projects */}
                        {projectContext?.isDormant && onArchive && (
                            <button
                                onClick={() => {
                                    haptic.light()
                                    onArchive()
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl border border-amber-500/30 hover:bg-amber-500/10 transition-colors text-amber-400"
                            >
                                <Archive className="h-4 w-4" />
                            </button>
                        )}

                        {/* Start Button with contextual messaging */}
                        <button
                            onClick={handleStart}
                            disabled={isOvertime || activeItems.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            style={{
                                background: isOvertime ? 'rgba(255,255,255,0.2)' : projectColor,
                            }}
                        >
                            <Zap className="h-4 w-4 fill-current" />
                            <span className="uppercase text-sm tracking-widest">
                                {isOvertime
                                    ? 'Adjust Time First'
                                    : projectContext?.isDormant
                                        ? `Reconnect (${totalMinutes}m)`
                                        : projectContext?.progress && projectContext.progress >= 70
                                            ? `Finish Strong (${totalMinutes}m)`
                                            : `Start ${totalMinutes}m Session`
                                }
                            </span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    )
}
