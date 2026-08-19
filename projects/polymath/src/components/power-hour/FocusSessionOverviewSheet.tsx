/**
 * Floating "here's the plan" sheet — the pre-task confirmation step for a
 * focus session. Rendered as a BottomSheet, not a full-screen takeover, so
 * starting a session from Focus chat or KeepGoingCard doesn't feel like
 * leaving the app you were just in. From here you can dive straight into
 * the task-by-task walkthrough (still full-screen — that part benefits
 * from being distraction-free), or go look at the actual project instead.
 *
 * If you're already on that project's own detail page, FocusSession
 * renders nothing here at all — ProjectDetailPage shows this same pending
 * state inline (its own "Focus session" card), so there's no duplicate UI
 * competing for the same screen.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, Bookmark, AlertTriangle, ExternalLink } from 'lucide-react'
import { useFocusStore } from '../../stores/useFocusStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { getTheme } from '../../lib/projectTheme'
import { haptic } from '../../utils/haptics'
import {
    BottomSheet,
    BottomSheetContent,
    BottomSheetHeader,
    BottomSheetTitle,
} from '../ui/bottom-sheet'

// Short relative date for the carry-forward "last time" block.
function formatRelativeDate(iso: string): string {
    try {
        const ms = Date.now() - new Date(iso).getTime()
        const days = Math.floor(ms / (1000 * 60 * 60 * 24))
        if (days <= 0) return 'today'
        if (days === 1) return 'yesterday'
        if (days < 7) return `${days}d ago`
        if (days < 30) return `${Math.floor(days / 7)}w ago`
        return `${Math.floor(days / 30)}mo ago`
    } catch {
        return ''
    }
}

// Group tasks by their ID prefix for the overview.
function groupTasks(tasks: { id: string; text: string }[]) {
    const ignition = tasks.filter(t => t.id.startsWith('ign-'))
    const core = tasks.filter(t => t.id.startsWith('core-'))
    const shutdown = tasks.filter(t => t.id.startsWith('shut-'))
    if (ignition.length === 0 && core.length === 0 && shutdown.length === 0) {
        return [{ label: 'Tasks', tasks }]
    }
    const groups = []
    if (ignition.length > 0) groups.push({ label: 'Warm up', tasks: ignition })
    if (core.length > 0) groups.push({ label: 'Core work', tasks: core })
    if (shutdown.length > 0) groups.push({ label: 'Wind down', tasks: shutdown })
    return groups
}

export function FocusSessionOverviewSheet() {
    const navigate = useNavigate()
    const { tasks, plannedDurationMinutes, projectId, beginTasks, reset } = useFocusStore()
    const project = useProjectStore(s => s.allProjects.find(p => p.id === projectId))

    const taskGroups = groupTasks(tasks)
    const lastBookmark = (project?.metadata?.next_step as string | undefined)?.trim()
    const lastBlocker = (project?.metadata?.blocker as string | undefined)?.trim()
    const lastBlockerAt = project?.metadata?.blocker_at as string | undefined
    const showLastTime = Boolean(lastBookmark || lastBlocker)
    // Carries the project's own color into the sheet — the point is that
    // this reads as "the thing you were just talking about," not a generic
    // system screen. Falls back to the app's brand color if the project
    // hasn't loaded yet (shouldn't happen in practice, but tasks/duration
    // still render fine either way).
    const theme = project ? getTheme(project.type || 'other', project.title) : null

    return (
        <BottomSheet open onOpenChange={(open) => { if (!open) reset() }}>
            <BottomSheetContent>
                <BottomSheetHeader className="sr-only">
                    <BottomSheetTitle>Session plan{project ? ` for ${project.title}` : ''}</BottomSheetTitle>
                </BottomSheetHeader>

                {project && (
                    <h2 className="text-2xl font-serif text-[var(--brand-text-primary)] mb-1 text-center mt-1">
                        {project.title}
                    </h2>
                )}
                <p className="text-xs text-[var(--brand-text-muted)] text-center mb-6">
                    {plannedDurationMinutes ? `${plannedDurationMinutes} min · ` : ''}
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''} planned
                </p>

                {showLastTime && (
                    <div
                        className="rounded-2xl p-4 mb-6"
                        style={{ background: 'rgba(var(--brand-primary-rgb), 0.06)', border: '1px solid rgba(var(--brand-primary-rgb), 0.18)' }}
                    >
                        <p className="text-[10px] tracking-[0.2em] mb-3" style={{ color: 'rgba(var(--brand-primary-rgb), 0.7)' }}>
                            last time
                        </p>
                        {lastBookmark && (
                            <div className="flex items-start gap-2 mb-2">
                                <Bookmark className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: 'rgba(var(--brand-primary-rgb), 0.85)' }} />
                                <p className="text-sm leading-snug text-[var(--brand-text-primary)]">{lastBookmark}</p>
                            </div>
                        )}
                        {lastBlocker && (
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: 'rgba(245, 158, 11, 0.85)' }} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm leading-snug text-[var(--brand-text-secondary)]">{lastBlocker}</p>
                                    {lastBlockerAt && (
                                        <p className="text-[10px] mt-0.5 opacity-50">{formatRelativeDate(lastBlockerAt)}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-5 mb-6">
                    {taskGroups.map(group => (
                        <div key={group.label}>
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand-text-muted)] mb-2">
                                {group.label}
                            </h3>
                            <ul className="space-y-2">
                                {group.tasks.map(task => (
                                    <li key={task.id} className="text-sm text-[var(--brand-text-secondary)] leading-relaxed flex items-start gap-3">
                                        <span className="w-1 h-1 rounded-full bg-[var(--brand-text-muted)] mt-2 flex-shrink-0" />
                                        {task.text}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="space-y-2">
                    <button
                        onClick={() => { haptic.medium(); beginTasks() }}
                        className="w-full py-3 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110"
                        style={{
                            background: theme ? `rgba(${theme.rgb}, 0.18)` : 'rgba(255,255,255,0.1)',
                            border: `1px solid ${theme ? `rgba(${theme.rgb}, 0.4)` : 'rgba(255,255,255,0.25)'}`,
                            borderRadius: '12px',
                            color: theme ? `rgb(${theme.rgb})` : 'white',
                        }}
                    >
                        Begin
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>

                    {project && (
                        <button
                            onClick={() => navigate(`/projects/${project.id}`)}
                            className="w-full py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 rounded-xl transition-colors hover:bg-white/[0.04]"
                            style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
                        >
                            Open project <ExternalLink className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </BottomSheetContent>
        </BottomSheet>
    )
}
