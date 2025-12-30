import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Play, BookOpen, Clock, ChevronDown, RefreshCw, Layers, Flame, Coffee, Moon, Archive, Target, Pencil, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../../utils/haptics'
import { readingDb } from '../../lib/db'
import { useProjectStore } from '../../stores/useProjectStore'
import { PowerHourReview } from './PowerHourReview'

import { PROJECT_COLORS } from '../projects/ProjectCard'

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
    { value: 25, label: 'Spark', icon: Zap },
    { value: 60, label: 'Ritual', icon: Flame },
    { value: 150, label: 'Deep Dive', icon: Layers },
]

export function PowerHourHero() {
    const [tasks, setTasks] = useState<PowerTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showProjectPicker, setShowProjectPicker] = useState(false)
    const [duration, setDuration] = useState(60)
    const [showReview, setShowReview] = useState(false)

    const navigate = useNavigate()

    // Get all projects for the manual picker
    const { allProjects, updateProject } = useProjectStore()
    const activeProjects = allProjects.filter(p => ['active', 'upcoming', 'maintaining'].includes(p.status))

    const getTheme = (type: string, title: string) => {
        const t = type?.toLowerCase().trim() || ''
        let rgb = PROJECT_COLORS[t]
        if (!rgb) {
            const keys = Object.keys(PROJECT_COLORS).filter(k => k !== 'default')
            let hash = 0
            for (let i = 0; i < title.length; i++) {
                hash = title.charCodeAt(i) + ((hash << 5) - hash)
            }
            rgb = PROJECT_COLORS[keys[Math.abs(hash) % keys.length]]
        }
        return {
            text: `rgb(${rgb})`,
            rgb: rgb
        }
    }

    const mainTask = tasks[selectedIndex] || tasks[0]
    const currentProject = allProjects.find(p => p.id === mainTask?.project_id)
    const theme = getTheme(currentProject?.type || 'other', mainTask?.project_title || '')

    async function fetchPowerHour(refreshProjectId?: string, newDuration?: number) {
        const targetDuration = newDuration || duration
        if (refreshProjectId) setIsRefreshing(true)
        else setLoading(true)

        try {
            // 1. Load from client-side cache first (Instant) if not forcing a specific project
            // We check if cached task matches duration
            if (!refreshProjectId) {
                const cached = await readingDb.getDashboard('power-hour')
                if (cached && cached.tasks && cached.tasks.length > 0) {
                    const cachedDuration = cached.tasks[0].duration_minutes || 60
                    if (cachedDuration === targetDuration) {
                        setTasks(cached.tasks)
                        setLoading(false)
                    }
                }
            }

            const url = refreshProjectId
                ? `/api/power-hour?projectId=${refreshProjectId}&duration=${targetDuration}`
                : `/api/power-hour?duration=${targetDuration}`

            const res = await fetch(url)
            if (!res.ok) throw new Error(`Engine offline: ${res.status}`)

            const data = await res.json()
            if (data.tasks) {
                await readingDb.cacheDashboard('power-hour', { tasks: data.tasks })
                setTasks(data.tasks)
                setSelectedIndex(0) // Reset to first task when new ones arrive
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
        // Effect will trigger fetch
    }

    if (loading) return (
        <div className="w-full h-64 bg-zebra-gray-dark animate-pulse rounded-2xl border border-white/10 mb-8" />
    )

    if (error) return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-12 text-center border-2 border-dashed border-red-500/20 bg-red-500/5">
                <Zap className="h-12 w-12 text-red-500/20 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase italic mb-2 tracking-tighter text-red-500">Engine Offline</h2>
                <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">{error}</p>
                <button onClick={() => fetchPowerHour()} className="px-6 py-3 bg-red-500 text-white font-black uppercase text-xs tracking-widest hover:bg-black transition-colors">
                    Retry Feed
                </button>
            </div>
        </div>
    )

    if (tasks.length === 0) return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-12 text-center border-2 border-dashed border-white/20">
                <Zap className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase italic mb-2 tracking-tighter">Engine Dormant</h2>
                <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">Create or activate a project to initialize the hour.</p>
                <button onClick={() => navigate('/projects')} className="px-6 py-3 bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-zebra-accent transition-colors">
                    Initialize Project
                </button>
            </div>
        </div>
    )

    const handleStartPowerHour = async () => {
        haptic.heavy()
        const project = allProjects.find(p => p.id === mainTask.project_id)
        if (!project) return

        let updatedTasks = [...(project.metadata?.tasks || [])] as any[]

        // 1. Identify new tasks to add (Ignition + Core + Shutdown)
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

            // Force immediate update to store and backend
            await updateProject(project.id, {
                metadata: {
                    ...project.metadata,
                    tasks: updatedTasks
                }
            })
        }

        // 2. Navigate with full context
        // We highlight tasks from all 3 phases
        const allHighlights = [
            ...(mainTask.ignition_tasks || []),
            ...(mainTask.checklist_items || []),
            ...(mainTask.shutdown_tasks || [])
        ].map(i => ({ task_title: i.text }))

        navigate(`/projects/${mainTask.project_id}`, {
            state: {
                powerHourTask: mainTask,
                highlightedTasks: allHighlights
            }
        })
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

        // 1. Identify new tasks to add
        const newTasksFromAI = adjustedItems.filter(item => item.is_new)

        // 2. Track rejected suggestions
        const existingRejected = project.metadata?.rejected_suggestions || []
        const newRejected = [...new Set([...existingRejected, ...removedAISuggestions])]
            .slice(-20)

        // 3. Store session context for next time (invisible UX improvement)
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

        const allHighlights = adjustedItems.map(i => ({ task_title: i.text }))

        navigate(`/projects/${mainTask.project_id}`, {
            state: {
                powerHourTask: {
                    ...mainTask,
                    checklist_items: adjustedItems,
                    total_estimated_minutes: totalMinutes
                },
                highlightedTasks: allHighlights,
                sessionDuration: totalMinutes
            }
        })
    }

    return (
        <div className="relative mb-2 group/hero">
            <div className="aperture-hero-card p-0 rounded-2xl overflow-hidden relative">
                {/* Header Overlays */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <div
                        className="text-black px-4 py-1.5 font-black text-[10px] uppercase tracking-widest aperture-header flex items-center gap-2"
                        style={{ backgroundColor: theme.text }}
                    >
                        {duration === 25 ? <Zap className="h-3 w-3" /> : duration === 150 ? <Layers className="h-3 w-3" /> : <Flame className="h-3 w-3" />}
                        {duration === 25 ? 'Spark Session' : duration === 150 ? 'Deep Dive' : 'Power Hour'}
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                        onClick={() => setShowProjectPicker(!showProjectPicker)}
                        className="bg-white/5 backdrop-blur-md border border-white/10 text-white p-2 rounded-lg hover:bg-white/10 transition-all group/picker"
                        title="Change Project Focus"
                    >
                        {isRefreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                    </button>
                </div>

                {/* Project Picker (unchanged logic, just ensuring it renders over z-indices) */}
                <AnimatePresence>
                    {showProjectPicker && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-16 right-4 z-30 w-72 aperture-card shadow-2xl max-h-80 overflow-y-auto"
                        >
                            <div className="p-3 bg-white/5 border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-[var(--brand-text-muted)] aperture-header">
                                Select Project Target
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
                                        className="w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 group"
                                    >
                                        <div className="font-bold text-sm group-hover:text-white mt-1 flex items-center gap-2 aperture-header uppercase">
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
                    {/* Main Action Area */}
                    <div className="p-6 md:p-8 flex-1 relative z-10 flex flex-col h-full justify-between">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={mainTask.project_id + mainTask.task_title + duration}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center justify-between mb-2 mt-8 md:mt-0">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest aperture-header" style={{ color: theme.text }}>
                                        <Zap className="h-3 w-3 fill-current" />
                                        <span>{mainTask.project_title}</span>
                                        {mainTask.overhead_type && <span className="opacity-50">• {mainTask.overhead_type} Flow</span>}
                                    </div>
                                </div>

                                <h1 className="text-2xl md:text-3xl font-bold mb-3 uppercase leading-none tracking-tight text-white aperture-header line-clamp-2">
                                    {mainTask.task_title}
                                </h1>

                                <p className="text-[var(--brand-text-secondary)] mb-6 text-sm leading-relaxed aperture-body line-clamp-2">
                                    {mainTask.task_description}
                                </p>

                                {/* The Session Arc Visualization */}
                                <div className="flex gap-2 mb-6 text-[10px] font-mono uppercase tracking-wide opacity-70">
                                    {(mainTask.ignition_tasks?.length || 0) > 0 && (
                                        <div className="flex items-center gap-1 text-green-400">
                                            <Coffee className="h-3 w-3" />
                                            <span>Ignition</span>
                                        </div>
                                    )}
                                    <div className="w-px h-3 bg-white/20" />
                                    <div className="flex items-center gap-1 text-white">
                                        <Play className="h-3 w-3" />
                                        <span>Flow</span>
                                    </div>
                                    {(mainTask.shutdown_tasks?.length || 0) > 0 && (
                                        <>
                                            <div className="w-px h-3 bg-white/20" />
                                            <div className="flex items-center gap-1 text-blue-400">
                                                <Moon className="h-3 w-3" />
                                                <span>Parking</span>
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
                                        className="flex items-center gap-2 px-4 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-sm text-white/70 aperture-header"
                                    >
                                        <Clock className="h-3.5 w-3.5" />
                                        <span>Adjust</span>
                                    </button>

                                    {mainTask.fuel_id && (
                                        <button
                                            onClick={() => navigate(`/reading/${mainTask.fuel_id}`)}
                                            className="flex items-center gap-2 px-4 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-sm text-white aperture-header"
                                        >
                                            <BookOpen className="h-3.5 w-3.5" />
                                            <span>Read Fuel</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Stats Area - Side Panel (Desktop Only) */}
                    <div className="hidden md:flex flex-col p-0 border-l border-white/5 relative w-48 bg-white/[0.02]">
                        {/* Duration Selectors */}
                        <div className="flex flex-col h-full">
                            {DURATION_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleDurationChange(opt.value)}
                                    className={`flex-1 flex flex-col justify-center items-center gap-2 transition-all border-b border-white/5 last:border-0 ${duration === opt.value
                                        ? 'bg-white/10 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]'
                                        : 'hover:bg-white/5 text-white/30'
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

                {/* Mobile Stats/Duration Toggle (Replaces impact score on mobile essentially or adds to it) */}
                <div className="md:hidden border-t border-white/10 flex divide-x divide-white/10">
                    {DURATION_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleDurationChange(opt.value)}
                            className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors ${duration === opt.value ? 'bg-white/10 text-white' : 'text-white/40'
                                }`}
                        >
                            <span className="text-[9px] font-bold uppercase tracking-widest aperture-header">{opt.value}m</span>
                        </button>
                    ))}
                </div>

                {/* Alternative Toggle Bar for Tasks (if multiple suggestions per duration) */}
                {tasks.length > 1 && (
                    <div className="border-t border-white/10 bg-black/20 backdrop-blur-xl p-2 flex gap-2">
                        {tasks.map((task, idx) => {
                            const tTheme = getTheme(allProjects.find(p => p.id === task.project_id)?.type || 'other', task.project_title)
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        haptic.light()
                                        setSelectedIndex(idx)
                                    }}
                                    className={`flex-1 flex items-center gap-3 p-3 rounded-xl transition-all ${selectedIndex === idx
                                        ? 'bg-white/10 text-white shadow-lg'
                                        : 'hover:bg-white/5 text-[var(--brand-text-muted)]'
                                        }`}
                                >
                                    <span className={`font-bold text-xs aperture-header ${selectedIndex === idx ? '' : 'opacity-40'}`} style={{ color: selectedIndex === idx ? tTheme.text : 'inherit' }}>0{idx + 1}</span>
                                    <div className={`text-[10px] font-bold uppercase tracking-tight truncate max-w-[120px] aperture-header ${selectedIndex === idx ? 'text-white' : ''}`}>
                                        {task.project_title}
                                    </div>
                                    {selectedIndex === idx && <div className="ml-auto w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: tTheme.text }} />}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Review Modal */}
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
