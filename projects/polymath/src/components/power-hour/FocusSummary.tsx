import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, Bookmark, ThumbsDown, Minus, ThumbsUp, Smile, Flame, Mic, AlertTriangle } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { VoiceInput } from '../VoiceInput'

const REFLECTION_RATINGS = [
  { icon: ThumbsDown, label: 'Frustrating', value: 1 },
  { icon: Minus, label: 'Meh', value: 2 },
  { icon: ThumbsUp, label: 'Decent', value: 3 },
  { icon: Smile, label: 'Good', value: 4 },
  { icon: Flame, label: 'Crushed it', value: 5 },
] as const

export function FocusSummary() {
    const { tasks, elapsedSeconds, reset, projectId } = useFocusStore()
    const { updateProject } = useProjectStore()
    const [nextStep, setNextStep] = useState('')
    const [blocker, setBlocker] = useState('')
    const [rating, setRating] = useState<number | null>(null)
    const [showVoiceCapture, setShowVoiceCapture] = useState(false)
    const [sessionNoteRecorded, setSessionNoteRecorded] = useState(false)

    const completedTasks = tasks.filter(t => t.completed)
    const skippedTasks = tasks.filter(t => !t.completed)
    const durationMinutes = Math.floor(elapsedSeconds / 60)

    // Surface the blocker prompt only when the session genuinely
    // didn't go well — low self-rating, or more tasks skipped than
    // completed. Nagging "what's blocked?" after every successful
    // session would just make the user dismiss it on autopilot.
    const sessionStalled = (rating !== null && rating <= 2) ||
        (tasks.length > 0 && skippedTasks.length > completedTasks.length)

    const handleExit = async () => {
        if (projectId) {
            const project = useProjectStore.getState().allProjects.find(p => p.id === projectId)
            const existingSessions = project?.metadata?.sessions || []

            const cleanedBlocker = blocker.trim()
            await updateProject(projectId, {
                metadata: {
                    ...project?.metadata,
                    next_step: nextStep.trim() || undefined,
                    // Latest blocker — overrides any previous one so the
                    // current truth wins. Cleared when the user pauses
                    // without noting anything new.
                    blocker: cleanedBlocker || (project?.metadata?.blocker as string | undefined),
                    blocker_at: cleanedBlocker ? new Date().toISOString() : (project?.metadata?.blocker_at as string | undefined),
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
                            blocker: cleanedBlocker || undefined,
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
            className="fixed inset-0 z-[100] bg-[var(--brand-bg)] text-[var(--brand-text-secondary)] flex flex-col items-center justify-center p-8 overflow-y-auto"
        >
            <div className="max-w-md w-full py-12">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/10 mb-6">
                        <CheckCircle2 className="h-8 w-8 text-brand-text-secondary" />
                    </div>
                    <h2 className="text-3xl font-serif mb-2">Session Logged</h2>
                    <p className="text-[var(--brand-text-muted)]">
                        {durationMinutes}m focus session  {completedTasks.length} task{completedTasks.length !== 1 ? 's' : ''} completed
                    </p>
                </div>

                {/* How did that go? */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header mb-4 text-center">
                        How did that go?
                    </h3>
                    <div className="flex items-center justify-center gap-3">
                        {REFLECTION_RATINGS.map(r => {
                            const Icon = r.icon
                            return (
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
                                    <Icon className="h-6 w-6" style={{ color: 'var(--brand-text-secondary)' }} />
                                    <span className="text-[9px] text-[var(--brand-text-muted)]">{r.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Task List - Minimal */}
                {completedTasks.length > 0 && (
                    <div className="bg-[var(--glass-surface)] rounded-2xl p-6 mb-6 border border-[var(--glass-surface)] max-h-[25vh] overflow-y-auto">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header mb-4">
                            Completed
                        </h3>
                        <ul className="space-y-3">
                            {completedTasks.map(task => (
                                <li key={task.id} className="text-sm text-[var(--brand-text-secondary)] leading-relaxed flex gap-3">
                                    <span className="text-brand-text-secondary/50"></span>
                                    {task.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Post-session voice capture — captures what happened + what's next */}
                <div className="mb-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header mb-3 flex items-center gap-2">
                        <Mic className="h-3 w-3" />
                        What did you do? What's next?
                    </h3>
                    {sessionNoteRecorded ? (
                        <p className="text-xs text-[var(--brand-text-muted)] italic opacity-60">
                            Captured. ✓
                        </p>
                    ) : showVoiceCapture ? (
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <VoiceInput
                                onTranscript={(transcript) => {
                                    if (transcript.trim() && projectId) {
                                        fetch('/api/memories?capture=true', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                transcript,
                                                source_reference: { type: 'project', id: projectId },
                                                context: 'post_session',
                                            }),
                                        }).catch(() => {/* silent */})
                                    }
                                    setSessionNoteRecorded(true)
                                    setShowVoiceCapture(false)
                                }}
                                maxDuration={30}
                                autoStart
                            />
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowVoiceCapture(true)}
                            className="flex items-center gap-2 text-xs text-[var(--brand-text-muted)] opacity-50 hover:opacity-90 transition-opacity"
                        >
                            <Mic className="h-3.5 w-3.5" />
                            <span>30-second voice note</span>
                        </button>
                    )}
                </div>

                {/* Blocker prompt — only when the session stalled (low
                    rating or more skips than completes). One sentence,
                    captured at the moment of pause; powers the Mode 2b
                    reshape later by giving the next session something to
                    react to. */}
                {sessionStalled && (
                    <div className="mb-6">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-3 w-3" />
                            What got in the way?
                        </h3>
                        <textarea
                            value={blocker}
                            onChange={e => setBlocker(e.target.value)}
                            placeholder="One sentence — what blocked you, what felt off, what shifted."
                            className="w-full bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-xl p-4 text-sm text-[var(--brand-text-secondary)] focus:outline-none focus:border-white/30 transition-colors min-h-[72px] resize-none"
                        />
                    </div>
                )}

                {/* Bookmark / Next Step */}
                <div className="mb-8">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header mb-4 flex items-center gap-2">
                        <Bookmark className="h-3 w-3" />
                        Leave a bookmark
                    </h3>
                    <textarea
                        value={nextStep}
                        onChange={e => setNextStep(e.target.value)}
                        placeholder="What's the very next thing you'll do when you pick this back up?"
                        className="w-full bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-xl p-4 text-sm text-[var(--brand-text-secondary)] focus:outline-none focus:border-white/30 transition-colors min-h-[100px] resize-none"
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleExit}
                        className="w-full py-4 font-bold transition-colors flex items-center justify-center gap-2"
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          border: '1px solid rgba(255,255,255,0.25)',
                          borderRadius: '4px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
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
