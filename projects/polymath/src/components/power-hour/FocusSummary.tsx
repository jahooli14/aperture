import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Bookmark } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'

export function FocusSummary() {
    const { tasks, elapsedSeconds, reset, projectId } = useFocusStore()
    const { updateProject } = useProjectStore()
    const [nextStep, setNextStep] = useState('')

    const completedTasks = tasks.filter(t => t.completed)
    const durationMinutes = Math.floor(elapsedSeconds / 60)

    const handleExit = async () => {
        // 1. Save "Bookmark" if provided
        if (projectId && nextStep.trim()) {
            await updateProject(projectId, {
                metadata: {
                    next_step: nextStep.trim(),
                    last_session: new Date().toISOString(),
                    last_duration: durationMinutes
                }
            })
        }

        // 2. Just reset store, which unmounts the overlay
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
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mb-6">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h2 className="text-3xl font-serif mb-2">Session Logged</h2>
                    <p className="text-[#64748b]">
                        {durationMinutes}m focus session • {completedTasks.length} tasks completed
                    </p>
                </div>

                {/* Task List - Minimal */}
                <div className="bg-white/5 rounded-2xl p-6 mb-6 border border-white/5 max-h-[30vh] overflow-y-auto">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#64748b] mb-4">
                        Completed
                    </h3>
                    {completedTasks.length > 0 ? (
                        <ul className="space-y-3">
                            {completedTasks.map(task => (
                                <li key={task.id} className="text-sm text-[#cbd5e1] leading-relaxed flex gap-3">
                                    <span className="text-emerald-500/50">•</span>
                                    {task.text}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-[#64748b] italic">No tasks completed this session.</p>
                    )}
                </div>

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
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-[#cbd5e1] focus:outline-none focus:border-white/30 transition-colors min-h-[100px] resize-none"
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleExit}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-[#f1f5f9] transition-colors flex items-center justify-center gap-2"
                    >
                        <span>Return to Day</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>
                    {/* Could add a "Continue Project" button here if deep linking back to project page */}
                </div>
            </div>
        </motion.div>
    )
}
