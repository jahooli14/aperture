import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Bookmark } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'

const REFLECTION_EMOJIS = [
  { emoji: '😤', label: 'Frustrating', value: 1 },
  { emoji: '😐', label: 'Meh', value: 2 },
  { emoji: '🙂', label: 'Decent', value: 3 },
  { emoji: '😊', label: 'Good', value: 4 },
  { emoji: '🔥', label: 'Crushed it', value: 5 },
] as const

export function FocusSummary() {
    const { tasks, elapsedSeconds, reset, projectId } = useFocusStore()
    const { updateProject } = useProjectStore()
    const [nextStep, setNextStep] = useState('')
    const [rating, setRating] = useState<number | null>(null)

    const completedTasks = tasks.filter(t => t.completed)
    const skippedTasks = tasks.filter(t => !t.completed)
    const durationMinutes = Math.floor(elapsedSeconds / 60)

    const handleExit = async () => {
        if (projectId) {
            const project = useProjectStore.getState().allProjects.find(p => p.id === projectId)
            const existingSessions = project?.metadata?.sessions || []

            await updateProject(projectId, {
                metadata: {
                    ...project?.metadata,
                    next_step: nextStep.trim() || undefined,
                    last_session: new Date().toISOString(),
                    last_duration: durationMinutes,
                    sessions: [
                        ...existingSessions,
                        {
                            date: new Date().toISOString(),
                            duration_minutes: durationMinutes,
                            tasks_completed: completedTasks.length,
                            tasks_skipped: skippedTasks.length,
                            rating: rating || undefined,
                            bookmark: nextStep.trim() || undefined,
                        },
                    ].slice(-20), // Keep last 20 sessions
                }
            })
        }

        reset()
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-[#09090b] text-[#E2E8F0] flex flex-col items-center justify-center p-8 overflow-y-auto"
        >
            <div className="max-w-md w-full py-12">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/10 mb-6">
                        <CheckCircle2 className="h-8 w-8 text-brand-text-secondary" />
                    </div>
                    <h2 className="text-3xl font-serif mb-2">Session Logged</h2>
                    <p className="text-[#64748b]">
                        {durationMinutes}m focus session  {completedTasks.length} task{completedTasks.length !== 1 ? 's' : ''} completed
                    </p>
                </div>

                {/* How did that go? */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-4 text-center">
                        How did that go?
                    </h3>
                    <div className="flex items-center justify-center gap-3">
                        {REFLECTION_EMOJIS.map(r => (
                            <button
                                key={r.value}
                                onClick={() => setRating(r.value)}
                                className="flex flex-col items-center gap-1 transition-all"
                                style={{
                                    opacity: rating === null ? 0.6 : rating === r.value ? 1 : 0.25,
                                    transform: rating === r.value ? 'scale(1.2)' : 'scale(1)',
                                }}
                                title={r.label}
                            >
                                <span className="text-2xl">{r.emoji}</span>
                                <span className="text-[9px] text-[#64748b]">{r.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Task List - Minimal */}
                {completedTasks.length > 0 && (
                    <div className="bg-[var(--glass-surface)] rounded-2xl p-6 mb-6 border border-[var(--glass-surface)] max-h-[25vh] overflow-y-auto">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-4">
                            Completed
                        </h3>
                        <ul className="space-y-3">
                            {completedTasks.map(task => (
                                <li key={task.id} className="text-sm text-[#cbd5e1] leading-relaxed flex gap-3">
                                    <span className="text-brand-text-secondary/50"></span>
                                    {task.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Bookmark / Next Step */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-4 flex items-center gap-2">
                        <Bookmark className="h-3 w-3" />
                        Leave a bookmark
                    </h3>
                    <textarea
                        value={nextStep}
                        onChange={e => setNextStep(e.target.value)}
                        placeholder="What's the very next thing you'll do when you pick this back up?"
                        className="w-full bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-xl p-4 text-sm text-[#cbd5e1] focus:outline-none focus:border-white/30 transition-colors min-h-[100px] resize-none"
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleExit}
                        className="w-full py-4 font-bold transition-colors flex items-center justify-center gap-2"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: '2px solid rgba(255,255,255,0.25)',
                          borderRadius: '4px',
                          boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
                          color: 'white',
                        }}
                    >
                        <span>Return to Day</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
