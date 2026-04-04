import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Play, BookOpen, Clock, RefreshCw, Layers, Flame, Coffee, Moon, Target, Bookmark } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../../utils/haptics'
import { readingDb } from '../../lib/db'
import { useProjectStore } from '../../stores/useProjectStore'
import { useFocusStore } from '../../stores/useFocusStore'
import { PowerHourReview } from './PowerHourReview'

import { getTheme } from '../../lib/projectTheme'

interface PowerTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string
    session_summary?: string

    // The Arc
    ignition_tasks?: { text: string; is_new: boolean; estimated_minutes?: number }[]
    checklist_items?: { text: string; is_new: boolean; estimated_minutes?: number }[]
    shutdown_tasks?: { text: string; is_new: boolean; estimated_minutes?: number }[]

    impact_score: number
    fuel_id?: string
    fuel_title?: string
    overhead_type?: 'Mental' | 'Physical' | 'Tech' | 'Digital'
    duration_minutes?: number
    is_dormant?: boolean
    days_dormant?: number
}

const DURATION_OPTIONS = [
    { value: 25, label: 'Quick', icon: Zap },
    { value: 60, label: 'Standard', icon: Flame },
    { value: 150, label: 'Long', icon: Layers },
]

export function PowerHourHero() {
    const [tasks, setTasks] = useState<PowerTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showProjectPicker, setShowProjectPicker] = useState(false)
    const [duration, setDuration] = useState(() => {
        try {
            const stored = localStorage.getItem('polymath-power-hour-duration')
            return stored ? parseInt(stored, 10) || 60 : 60
        } catch { return 60 }
    })
    const [showReview, setShowReview] = useState(false)

    // Persist duration preference
    useEffect(() => {
        localStorage.setItem('polymath-power-hour-duration', String(duration))
    }, [duration])

    const navigate = useNavigate()

    // Get all projects for the manual picker
    const { allProjects, updateProject } = useProjectStore()
    const activeProjects = allProjects.filter(p => ['active', 'upcoming', 'maintaining'].includes(p.status))

    const mainTask = tasks[selectedIndex] || tasks[0]
    const currentProject = allProjects.find(p => p.id === mainTask?.project_id)
    const theme = getTheme(currentProject?.type || 'other', mainTask?.project_title || '')

    async function fetchPowerHour(targetProjectId?: string, newDuration?: number) {
        const targetDuration = newDuration || duration
        const currentProjectId = tasks[selectedIndex]?.project_id

        // 0. Instant Switch Logic: If we already have this project in our task list, just switch to it
        if (targetProjectId) {
            const existingIdx = tasks.findIndex(t => t.project_id === targetProjectId)
            if (existingIdx !== -1) {
                setSelectedIndex(existingIdx)
                setShowProjectPicker(false)
                haptic.medium()
                return
            } else {
                // OPTIMISTIC PLACEHOLDER: Switch immediately to a "Thinking" state
                const project = allProjects.find(p => p.id === targetProjectId)
                if (project) {
                    const placeholder: PowerTask = {
                        project_id: project.id,
                        project_title: project.title,
                        task_title: "Planning session...",
                        task_description: "Synthesizing the best next move for this project...",
                        impact_score: 0.5,
                        duration_minutes: targetDuration,
                        ignition_tasks: [],
                        checklist_items: [],
                        shutdown_tasks: []
                    }
                    const newTasks = [...tasks, placeholder]
                    setTasks(newTasks)
                    setSelectedIndex(newTasks.length - 1)
                    setShowProjectPicker(false)
                    haptic.light()
                }
            }
        }

        // Only show the full skeleton on true initial load (no tasks yet).
        // For duration changes, keep existing content visible and use isRefreshing instead.
        if (targetProjectId) {
            setIsRefreshing(true)
        } else if (tasks.length === 0) {
            setLoading(true)
        } else {
            setIsRefreshing(true)
        }

        try {
            // 1. Load from client-side cache first (Instant) if not forcing a specific project
            if (!targetProjectId) {
                const cached = await readingDb.getDashboard('power-hour')
                if (cached && cached.tasks && cached.tasks.length > 0) {
                    const cachedDuration = cached.tasks[0].duration_minutes || 60
                    if (cachedDuration === targetDuration) {
                        setTasks(cached.tasks)
                        setLoading(false)
                        // Restore selection to same project if possible
                        if (currentProjectId) {
                            const idx = (cached.tasks as PowerTask[]).findIndex(t => t.project_id === currentProjectId)
                            setSelectedIndex(idx !== -1 ? idx : 0)
                        }
                    }
                }
            }

            const url = targetProjectId
                ? `/api/power-hour?projectId=${targetProjectId}&duration=${targetDuration}`
                : `/api/power-hour?duration=${targetDuration}`

            const res = await fetch(url)
            if (!res.ok) throw new Error(`Engine offline: ${res.status}`)

            const data = await res.json()
            if (data.tasks) {
                if (targetProjectId) {
                    // Merge new task into list, replacing the placeholder
                    setTasks(prev => {
                        const filtered = prev.filter(t => t.project_id !== targetProjectId || t.task_title !== "Planning session...")
                        return [...filtered, ...data.tasks]
                    })
                    // Note: selectedIndex is already pointing to the end due to optimistic update
                } else {
                    setTasks(data.tasks)
                    // Maintain selection on same project; fall back to first
                    if (currentProjectId) {
                        const idx = (data.tasks as PowerTask[]).findIndex(t => t.project_id === currentProjectId)
                        setSelectedIndex(idx !== -1 ? idx : 0)
                    } else {
                        setSelectedIndex(0)
                    }
                }
                await readingDb.cacheDashboard('power-hour', { tasks: data.tasks })
            }
        } catch (e: any) {
            console.error('[PowerHourHero] Fetch Error:', e)
            if (tasks.length === 0) setError(e.message)
        } finally {
            setLoading(false)
            setIsRefreshing(false)
            setShowProjectPicker(false)
        }
    }

    useEffect(() => {
        fetchPowerHour(undefined, duration)
    }, [duration])

    const handleDurationChange = (d: number) => {
        haptic.medium()
        setDuration(d)
    }

    if (loading) return (
        <div className="w-full h-64 bg-zebra-gray-dark animate-pulse rounded-2xl border border-[var(--glass-surface-hover)] mb-8" />
    )

    if (error) return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-12 text-center border-2 border-dashed border-red-500/20 bg-brand-primary/5">
                <Zap className="h-12 w-12 text-brand-text-secondary/20 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase italic mb-2 tracking-tighter text-brand-text-secondary">Couldn't load suggestions</h2>
                <p className="text-[var(--brand-text-secondary)] text-sm max-w-sm mx-auto mb-6">{error}</p>
                <button onClick={() => fetchPowerHour()} className="px-6 py-3 bg-brand-primary text-[var(--brand-text-primary)] font-black uppercase text-xs tracking-widest hover:bg-black transition-colors">
                    Retry Feed
                </button>
            </div>
        </div>
    )

    if (tasks.length === 0) return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-12 text-center border-2 border-dashed border-white/20">
                <Zap className="h-12 w-12 text-[var(--brand-text-primary)]/20 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase italic mb-2 tracking-tighter">No active projects</h2>
                <p className="text-[var(--brand-text-muted)] text-sm max-w-sm mx-auto mb-6">Start a project to get session suggestions.</p>
                <button onClick={() => navigate('/projects')} className="px-6 py-3 bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-zebra-accent transition-colors">
                    Go to projects
                </button>
            </div>
        </div>
    )

    const handleStartPowerHour = async () => {
        haptic.heavy()
        const project = allProjects.find(p => p.id === mainTask.project_id)
        if (!project) return

        let updatedTasks = [...(project.metadata?.tasks || [])] as any[]

        const ignition = mainTask.ignition_tasks?.filter(i => i.is_new) || []
        const core = mainTask.checklist_items?.filter(item => item.is_new) || []
        const shutdown = mainTask.shutdown_tasks?.filter(i => i.is_new) || []

        const allNew = [...ignition, ...core, ...shutdown]

        if (allNew.length > 0) {
            const freshTasks = allNew.map((t, idx) => ({
                id: crypto.randomUUID(),
                text: t.text,
                done: false,
                created_at: new Date().toISOString(),
                order: updatedTasks.length + idx
            }))

            updatedTasks = [...updatedTasks, ...freshTasks]

            await updateProject(project.id, {
                metadata: {
                    ...project.metadata,
                    tasks: updatedTasks
                }
            })
        }

        const { startSession } = useFocusStore.getState()
        const tasksForSession: { id: string, text: string }[] = []

        const allPendingItems = [
            ...(mainTask.ignition_tasks || []),
            ...(mainTask.checklist_items || []),
            ...(mainTask.shutdown_tasks || [])
        ]

        allPendingItems.forEach(item => {
            const matchedTask = [...updatedTasks].reverse().find((t: any) => t.text === item.text && !t.done)
            if (matchedTask) {
                tasksForSession.push({ id: matchedTask.id, text: matchedTask.text })
            }
        })

        if (tasksForSession.length > 0) {
            startSession(project.id, tasksForSession)
        } else {
            navigate(`/projects/${mainTask.project_id}`)
        }
    }

    const handleConfirmSession = async (
        adjustedItems: { text: string; is_new: boolean; estimated_minutes: number }[],
        totalMinutes: number,
        removedAISuggestions: string[] = []
    ) => {
        setShowReview(false)
        haptic.heavy()

        const project = allProjects.find(p => p.id === mainTask.project_id)
        if (!project) return

        let updatedTasks = [...(project.metadata?.tasks || [])] as any[]

        const newTasksFromAI = adjustedItems.filter(item => item.is_new)
        const existingRejected = project.metadata?.rejected_suggestions || []
        const newRejected = [...new Set([...existingRejected, ...removedAISuggestions])].slice(-20)

        const sessionContext = {
            started_at: new Date().toISOString(),
            duration_minutes: totalMinutes,
            planned_tasks: adjustedItems.map(i => i.text),
            parking_tasks: mainTask.shutdown_tasks?.map(t => t.text) || [],
            session_outcome: mainTask.task_title
        }

        const metadataUpdate: any = {
            ...project.metadata,
            last_session: sessionContext,
            // Clear suggestions so we generate fresh ones next time
            suggested_power_hour_tasks: null,
            suggested_power_hour_timestamp: null
        }

        if (newTasksFromAI.length > 0) {
            const freshTasks = newTasksFromAI.map((t, idx) => ({
                id: crypto.randomUUID(),
                text: t.text,
                done: false,
                created_at: new Date().toISOString(),
                order: updatedTasks.length + idx,
                estimated_minutes: t.estimated_minutes
            }))
            updatedTasks = [...updatedTasks, ...freshTasks]
            metadataUpdate.tasks = updatedTasks
        }

        if (removedAISuggestions.length > 0) {
            metadataUpdate.rejected_suggestions = newRejected
        }

        await updateProject(project.id, { metadata: metadataUpdate })

        const { startSession } = useFocusStore.getState()
        const tasksForSession: { id: string, text: string }[] = []

        adjustedItems.forEach(item => {
            const matchedTask = [...updatedTasks].reverse().find((t: any) => t.text === item.text && !t.done)
            if (matchedTask) {
                tasksForSession.push({ id: matchedTask.id, text: matchedTask.text })
            }
        })

        if (tasksForSession.length > 0) {
            startSession(project.id, tasksForSession)
        }
    }

    return (
        <div className="relative mb-2 group/hero">
            <div className="attention-card p-0 rounded-2xl overflow-hidden relative">
                {/* Subtle duration-refresh overlay — keeps content visible */}
                {isRefreshing && !tasks.some(t => t.task_title === 'Planning session...') && (
                    <div className="absolute inset-0 z-50 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/10 animate-pulse" />
                )}
                {/* Header Overlays */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <div
                        className="text-black px-4 py-1.5 font-black text-[10px] uppercase tracking-widest aperture-header flex items-center gap-2"
                        style={{ backgroundColor: theme.text }}
                    >
                        {duration === 25 ? <Zap className="h-3 w-3" /> : duration === 150 ? <Layers className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                        {duration === 25 ? '25 min focus' : duration === 150 ? 'Deep focus' : 'Focus time'}
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                        onClick={() => setShowProjectPicker(!showProjectPicker)}
                        className="bg-[var(--glass-surface)] backdrop-blur-md border border-[var(--glass-surface-hover)] text-[var(--brand-text-primary)] p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-all group/picker"
                        title="Change Project Focus"
                    >
                        {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    </button>
                </div>

                {/* Project Selection Tabs (FAST SWITCHING) */}
                <div className="absolute top-14 left-4 z-20 flex gap-1 items-center max-w-[calc(100%-120px)] overflow-x-auto no-scrollbar py-2">
                    {tasks.map((task, idx) => {
                        const tTheme = getTheme(allProjects.find(p => p.id === task.project_id)?.type || 'other', task.project_title)
                        const isActive = selectedIndex === idx
                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    haptic.light()
                                    setSelectedIndex(idx)
                                }}
                                className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 border ${isActive
                                    ? 'bg-white text-black border-white'
                                    : 'bg-black/40 text-[var(--brand-text-primary)]/40 border-[var(--glass-surface-hover)] hover:border-white/20'
                                    }`}
                            >
                                <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: isActive ? 'black' : tTheme.text }}
                                />
                                {task.project_title}
                            </button>
                        )
                    })}
                </div>

                <AnimatePresence>
                    {showProjectPicker && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-16 right-4 z-30 w-72 glass-card glass-card-hover shadow-2xl max-h-80 overflow-y-auto"
                        >
                            <div className="p-3 bg-[var(--glass-surface)] border-b border-[var(--glass-surface-hover)] text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header">
                                Switch project
                            </div>
                            {activeProjects.map(p => {
                                const pTheme = getTheme(p.type || 'other', p.title)
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            haptic.light()
                                            fetchPowerHour(p.id)
                                        }}
                                        className="w-full p-4 text-left hover:bg-[var(--glass-surface)] transition-colors border-b border-[var(--glass-surface)] last:border-0 group"
                                    >
                                        <div className="font-bold text-sm group-hover:text-[var(--brand-text-primary)] mt-1 flex items-center gap-2 aperture-header uppercase">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pTheme.text }} />
                                            {p.title}
                                        </div>
                                        <div className="text-[10px] opacity-60 line-clamp-1 pl-3.5 aperture-body">{p.description}</div>
                                    </button>
                                )
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col md:flex-row relative">
                    <div className="p-6 md:p-8 flex-1 relative z-10 flex flex-col h-full justify-between pt-24 md:pt-32">
                        <AnimatePresence>
                            <motion.div
                                key={mainTask.project_id + mainTask.task_title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center justify-between mb-2 mt-8 md:mt-0">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest aperture-header" style={{ color: theme.text }}>
                                        <Target className="h-3 w-3 fill-current" />
                                        <span>What to work on</span>
                                        {mainTask.overhead_type && <span className="opacity-50"> {mainTask.overhead_type} Flow</span>}
                                    </div>
                                </div>

                                <h1 className={`text-2xl md:text-3xl font-bold mb-3 uppercase leading-none tracking-tight text-[var(--brand-text-primary)] aperture-header line-clamp-2 min-h-[1.5em] ${mainTask.task_title === "Planning session..." ? "animate-pulse opacity-50" : ""}`}>
                                    {mainTask.task_title}
                                </h1>

                                <p className="text-[var(--brand-text-secondary)] mb-6 text-sm leading-relaxed aperture-body line-clamp-2">
                                    {mainTask.task_description}
                                </p>

                                {currentProject?.metadata?.next_step && (
                                    <div className="mb-6 p-3 rounded-lg bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] flex items-start gap-3">
                                        <div className="p-1.5 rounded-md bg-[rgba(255,255,255,0.1)]">
                                            <Bookmark className="h-3 w-3 text-[var(--brand-text-primary)]/50" />
                                        </div>
                                        <div>
                                            <div className="text-[9px] uppercase tracking-widest font-black text-[var(--brand-text-primary)]/30 mb-1 aperture-header">Last Bookmark</div>
                                            <div className="text-xs text-[var(--brand-text-primary)]/80 leading-relaxed aperture-body line-clamp-2 italic">"{currentProject.metadata.next_step}"</div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 mb-6 text-[10px] font-mono uppercase tracking-wide opacity-70">
                                    {(mainTask.ignition_tasks?.length || 0) > 0 && (
                                        <div className="flex items-center gap-1 text-brand-text-secondary">
                                            <Coffee className="h-3 w-3" />
                                            <span>Warm up</span>
                                        </div>
                                    )}
                                    <div className="w-px h-3 bg-white/20" />
                                    <div className="flex items-center gap-1 text-[var(--brand-text-primary)]">
                                        <Play className="h-3 w-3" />
                                        <span>Main tasks</span>
                                    </div>
                                    {(mainTask.shutdown_tasks?.length || 0) > 0 && (
                                        <>
                                            <div className="w-px h-3 bg-white/20" />
                                            <div className="flex items-center gap-1 text-brand-primary">
                                                <Moon className="h-3 w-3" />
                                                <span>Wind down</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={handleStartPowerHour}
                                        className="flex items-center gap-2 group px-6 py-3 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        style={{
                                            background: theme.text,
                                            color: 'black',
                                            boxShadow: `0 8px 24px rgba(${theme.rgb}, 0.2)`
                                        }}
                                    >
                                        <Play className="h-3.5 w-3.5 fill-current" />
                                        <span className="text-xs uppercase tracking-widest aperture-header">Start</span>
                                    </button>

                                    <button
                                        onClick={() => setShowReview(true)}
                                        className="flex items-center gap-2 px-4 py-3 border border-[var(--glass-surface-hover)] rounded-xl hover:bg-[var(--glass-surface)] transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-sm text-[var(--brand-text-primary)]/70 aperture-header"
                                    >
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Adjust</span>
                                    </button>

                                    {mainTask.fuel_id && (
                                        <button
                                            onClick={() => navigate(`/reading/${mainTask.fuel_id}`)}
                                            className="flex items-center gap-2 px-4 py-3 border border-[var(--glass-surface-hover)] rounded-xl hover:bg-[var(--glass-surface)] transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-sm text-[var(--brand-text-primary)] aperture-header"
                                        >
                                            <BookOpen className="h-3.5 w-3.5" />
                                            <span>Read Fuel</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <div className="hidden md:flex flex-col p-0 border-l border-[var(--glass-surface)] relative w-48 bg-white/[0.02]">
                        <div className="flex flex-col h-full">
                            {DURATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleDurationChange(opt.value)}
                                    className={`flex-1 flex flex-col justify-center items-center gap-2 transition-all border-b border-[var(--glass-surface)] last:border-0 ${duration === opt.value
                                        ? 'bg-[rgba(255,255,255,0.1)] text-[var(--brand-text-primary)] shadow-[inset_0_0_20px_var(--glass-surface)]'
                                        : 'hover:bg-[var(--glass-surface)] text-[var(--brand-text-primary)]/30'
                                        }`}
                                >
                                    <opt.icon className={`h-4 w-4 ${duration === opt.value ? 'text-[var(--zebra-accent)]' : ''}`} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest aperture-header">{opt.label}</span>
                                    <span className="text-[9px] font-mono opacity-50">{opt.value}m</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="md:hidden border-t border-[var(--glass-surface-hover)] flex divide-x divide-white/10">
                    {DURATION_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleDurationChange(opt.value)}
                            className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors ${duration === opt.value ? 'bg-[rgba(255,255,255,0.1)] text-[var(--brand-text-primary)]' : 'text-[var(--brand-text-primary)]/40'
                                }`}
                        >
                            <span className="text-[9px] font-bold uppercase tracking-widest aperture-header">{opt.value}m</span>
                        </button>
                    ))}
                </div>
            </div>

            <AnimatePresence>
                {showReview && mainTask && (() => {
                    const projectTasks = currentProject?.metadata?.tasks || []
                    const completedTasks = projectTasks.filter((t: any) => t.done)
                    const totalTasks = projectTasks.length
                    const progress = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0

                    const lastCompletedTask = completedTasks
                        .filter((t: any) => t.completed_at)
                        .sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0]

                    const projectContext = {
                        motivation: currentProject?.metadata?.motivation,
                        endGoal: currentProject?.metadata?.end_goal,
                        progress,
                        isDormant: mainTask.is_dormant,
                        daysDormant: mainTask.days_dormant,
                        lastCompletedTask: lastCompletedTask?.text,
                        projectMode: currentProject?.metadata?.project_mode as any,
                        completedCount: completedTasks.length
                    }

                    return (
                        <PowerHourReview
                            task={{
                                ...mainTask,
                                checklist_items: (mainTask.checklist_items || []).map(item => ({
                                    ...item,
                                    estimated_minutes: item.estimated_minutes || 15
                                })),
                                total_estimated_minutes: duration,
                                impact_score: mainTask.impact_score || 0.5
                            }}
                            projectColor={theme.text}
                            projectTasks={projectTasks}
                            projectContext={projectContext}
                            targetMinutes={duration}
                            onClose={() => setShowReview(false)}
                            onStart={handleConfirmSession}
                        />
                    )
                })()}
            </AnimatePresence>
        </div>
    )
}
