import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Zap, Play, Minus, Plus, AlertTriangle, Check } from 'lucide-react'
import { haptic } from '../../utils/haptics'

interface ChecklistItem {
    text: string
    is_new: boolean
    estimated_minutes: number
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

interface PowerHourReviewProps {
    task: PowerTask
    projectColor: string
    onClose: () => void
    onStart: (adjustedItems: ChecklistItem[], totalMinutes: number) => void
}

const DURATION_OPTIONS = [5, 15, 25, 45]
const TARGET_MINUTES = 50
const MAX_MINUTES = 60

export function PowerHourReview({ task, projectColor, onClose, onStart }: PowerHourReviewProps) {
    const [items, setItems] = useState<ChecklistItem[]>(
        task.checklist_items.map(item => ({
            ...item,
            estimated_minutes: item.estimated_minutes || 15
        }))
    )
    const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set())

    const activeItems = useMemo(() =>
        items.filter((_, idx) => !removedIndices.has(idx)),
        [items, removedIndices]
    )

    const totalMinutes = useMemo(() =>
        activeItems.reduce((sum, item) => sum + item.estimated_minutes, 0),
        [activeItems]
    )

    const progressPercent = Math.min(100, (totalMinutes / MAX_MINUTES) * 100)
    const isOvertime = totalMinutes > MAX_MINUTES
    const isIdeal = totalMinutes >= 40 && totalMinutes <= 55

    const updateDuration = (index: number, newDuration: number) => {
        haptic.light()
        setItems(prev => prev.map((item, i) =>
            i === index ? { ...item, estimated_minutes: newDuration } : item
        ))
    }

    const cycleDuration = (index: number, direction: 'up' | 'down') => {
        const currentDuration = items[index].estimated_minutes
        const currentIndex = DURATION_OPTIONS.indexOf(currentDuration)

        let newIndex: number
        if (direction === 'up') {
            newIndex = currentIndex < DURATION_OPTIONS.length - 1 ? currentIndex + 1 : currentIndex
        } else {
            newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex
        }

        if (newIndex !== currentIndex) {
            updateDuration(index, DURATION_OPTIONS[newIndex])
        }
    }

    const toggleRemove = (index: number) => {
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

    const handleStart = () => {
        haptic.heavy()
        onStart(activeItems, totalMinutes)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-md aperture-card overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <div
                            className="text-[10px] font-bold uppercase tracking-widest mb-1"
                            style={{ color: projectColor }}
                        >
                            {task.project_title}
                        </div>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-white">
                            Review Your Session
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-white/50" />
                    </button>
                </div>

                {/* Task List */}
                <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
                    {items.map((item, idx) => {
                        const isRemoved = removedIndices.has(idx)
                        return (
                            <motion.div
                                key={idx}
                                layout
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isRemoved
                                    ? 'bg-white/5 opacity-40'
                                    : 'bg-white/10'
                                    }`}
                            >
                                {/* Remove/Add Toggle */}
                                <button
                                    onClick={() => toggleRemove(idx)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isRemoved
                                        ? 'bg-white/10 text-white/30'
                                        : 'text-white/50 hover:bg-white/10'
                                        }`}
                                >
                                    {isRemoved ? (
                                        <Plus className="h-3 w-3" />
                                    ) : (
                                        <Check className="h-3 w-3" />
                                    )}
                                </button>

                                {/* Task Text */}
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium truncate ${isRemoved ? 'line-through text-white/30' : 'text-white'}`}>
                                        {item.text}
                                    </div>
                                    {item.is_new && !isRemoved && (
                                        <div
                                            className="text-[9px] font-bold uppercase tracking-wider mt-0.5"
                                            style={{ color: projectColor }}
                                        >
                                            AI Suggested
                                        </div>
                                    )}
                                </div>

                                {/* Duration Controls */}
                                {!isRemoved && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => cycleDuration(idx, 'down')}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            disabled={item.estimated_minutes === DURATION_OPTIONS[0]}
                                        >
                                            <Minus className="h-3 w-3 text-white/50" />
                                        </button>
                                        <div className="w-12 text-center">
                                            <span className="text-sm font-bold text-white">
                                                {item.estimated_minutes}
                                            </span>
                                            <span className="text-[10px] text-white/50 ml-0.5">m</span>
                                        </div>
                                        <button
                                            onClick={() => cycleDuration(idx, 'up')}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            disabled={item.estimated_minutes === DURATION_OPTIONS[DURATION_OPTIONS.length - 1]}
                                        >
                                            <Plus className="h-3 w-3 text-white/50" />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )
                    })}
                </div>

                {/* Time Summary */}
                <div className="px-4 py-3 border-t border-white/10 bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-white/50" />
                            <span className="text-sm text-white/70">Session Time</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className={`text-xl font-bold ${isOvertime ? 'text-red-400' : isIdeal ? 'text-green-400' : 'text-white'}`}>
                                {totalMinutes}
                            </span>
                            <span className="text-sm text-white/50">/ {TARGET_MINUTES} min</span>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                            className={`h-full rounded-full transition-colors ${isOvertime ? 'bg-red-500' : isIdeal ? 'bg-green-500' : 'bg-white/50'
                                }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>

                    {/* Status Message */}
                    <div className="mt-2 text-[11px] text-center">
                        {isOvertime ? (
                            <span className="text-red-400 flex items-center justify-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Over time limit - remove or shorten tasks
                            </span>
                        ) : isIdeal ? (
                            <span className="text-green-400">Perfect session length</span>
                        ) : totalMinutes < 40 ? (
                            <span className="text-white/50">Consider adding more tasks for a full session</span>
                        ) : (
                            <span className="text-yellow-400">Tight schedule - leave some buffer</span>
                        )}
                    </div>
                </div>

                {/* Action Button */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleStart}
                        disabled={isOvertime || activeItems.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        style={{
                            background: isOvertime ? 'rgba(255,255,255,0.2)' : projectColor,
                        }}
                    >
                        <Zap className="h-4 w-4 fill-current" />
                        <span className="uppercase text-sm tracking-widest">
                            {isOvertime ? 'Fix Time First' : `Start ${totalMinutes}m Session`}
                        </span>
                    </button>
                </div>
            </motion.div>
        </motion.div>
    )
}
