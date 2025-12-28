import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Play, ArrowRight, BookOpen, Clock, ChevronDown, RefreshCw, Layers } from 'lucide-react'
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
    checklist_items?: { text: string; is_new: boolean; estimated_minutes?: number }[]
    total_estimated_minutes?: number
    impact_score: number
    fuel_id?: string
    fuel_title?: string
}

export function PowerHourHero() {
    const [tasks, setTasks] = useState<PowerTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [showProjectPicker, setShowProjectPicker] = useState(false)
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

    async function fetchPowerHour(refreshProjectId?: string) {
        if (refreshProjectId) setIsRefreshing(true)
        else setLoading(true)

        try {
            // 1. Load from client-side cache first (Instant) if not forcing a specific project
            if (!refreshProjectId) {
                const cached = await readingDb.getDashboard('power-hour')
                if (cached && cached.tasks) {
                    setTasks(cached.tasks)
                    setLoading(false)
                }
            }

            const url = refreshProjectId
                ? `/api/power-hour?projectId=${refreshProjectId}`
                : '/api/power-hour'

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
        fetchPowerHour()
    }, [])

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

    // Quick start - bypass review, use AI suggestions as-is
    const handleStartPowerHour = async () => {
        haptic.heavy()

        const project = allProjects.find(p => p.id === mainTask.project_id)
        if (!project) return

        const items = mainTask.checklist_items?.map(item => ({
            ...item,
            estimated_minutes: item.estimated_minutes || 15
        })) || []

        let updatedTasks = [...(project.metadata?.tasks || [])] as any[]

        // Add new AI-suggested tasks
        const newTasksFromAI = items.filter(item => item.is_new)

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

            await updateProject(project.id, {
                metadata: {
                    ...project.metadata,
                    tasks: updatedTasks
                }
            })
        }

        navigate(`/projects/${mainTask.project_id}`, {
            state: {
                powerHourTask: mainTask,
                highlightedTasks: items.map(i => ({ task_title: i.text })),
                sessionDuration: mainTask.total_estimated_minutes || 50
            }
        })
    }

    // From review modal - adjusted items
    const handleConfirmSession = async (
        adjustedItems: { text: string; is_new: boolean; estimated_minutes: number }[],
        totalMinutes: number
    ) => {
        setShowReview(false)
        haptic.heavy()

        const project = allProjects.find(p => p.id === mainTask.project_id)
        if (!project) return

        let updatedTasks = [...(project.metadata?.tasks || [])] as any[]

        // 1. Identify new tasks to add (only from adjusted/confirmed items)
        const newTasksFromAI = adjustedItems.filter(item => item.is_new)

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

            // Force immediate update to store and backend
            await updateProject(project.id, {
                metadata: {
                    ...project.metadata,
                    tasks: updatedTasks
                }
            })
        }

        // 2. Navigate with full context including session duration
        navigate(`/projects/${mainTask.project_id}`, {
            state: {
                powerHourTask: {
                    ...mainTask,
                    checklist_items: adjustedItems,
                    total_estimated_minutes: totalMinutes
                },
                // Pass the specific tasks we want highlighted
                highlightedTasks: adjustedItems.map(i => ({ task_title: i.text })),
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
                        className="text-black px-4 py-1 font-black text-[10px] uppercase tracking-widest aperture-header"
                        style={{ backgroundColor: theme.text }}
                    >
                        Power Hour
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

                {/* Project Picker Dropdown */}
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
                    <div className="p-6 md:p-8 flex-1 relative z-10">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={mainTask.project_id + mainTask.task_title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest aperture-header" style={{ color: theme.text }}>
                                        <Zap className="h-3 w-3 fill-current" />
                                        <span>{mainTask.project_title}</span>
                                    </div>
                                    <div className="md:hidden flex items-center gap-1 text-[var(--brand-text-muted)] opacity-60">
                                        <span className="text-[10px] font-bold uppercase tracking-widest aperture-header">Impact</span>
                                        <span className="text-xs font-bold aperture-header text-white">{Math.round(mainTask.impact_score * 100)}%</span>
                                    </div>
                                </div>

                                <h1 className="text-2xl md:text-3xl font-bold mb-3 uppercase leading-none tracking-tight text-white aperture-header line-clamp-2">
                                    {mainTask.task_title}
                                </h1>

                                <p className="text-[var(--brand-text-secondary)] mb-2 text-sm leading-relaxed aperture-body line-clamp-2">
                                    {mainTask.task_description}
                                </p>

                                {/* Session Summary - The "Why" */}
                                {mainTask.session_summary && (
                                    <p className="text-white/60 mb-4 text-xs leading-relaxed aperture-body italic border-l-2 pl-3 line-clamp-2" style={{ borderColor: theme.text }}>
                                        {mainTask.session_summary}
                                    </p>
                                )}

                                {/* Task Preview with Durations */}
                                {mainTask.checklist_items && mainTask.checklist_items.length > 0 && (
                                    <div className="mb-5 space-y-1.5">
                                        {mainTask.checklist_items.slice(0, 4).map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-2 text-xs"
                                            >
                                                <div
                                                    className="w-1 h-1 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: item.is_new ? theme.text : 'rgba(255,255,255,0.3)' }}
                                                />
                                                <span className={`truncate flex-1 ${item.is_new ? 'text-white/80' : 'text-white/50'}`}>
                                                    {item.text}
                                                </span>
                                                <span
                                                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/50 flex-shrink-0"
                                                >
                                                    {item.estimated_minutes || 15}m
                                                </span>
                                            </div>
                                        ))}
                                        {mainTask.checklist_items.length > 4 && (
                                            <div className="text-[10px] text-white/30 pl-3">
                                                +{mainTask.checklist_items.length - 4} more
                                            </div>
                                        )}
                                    </div>
                                )}

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
                                        <span className="text-xs uppercase tracking-widest aperture-header">
                                            Go ({mainTask.total_estimated_minutes || 50}m)
                                        </span>
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
                                            className="flex items-center gap-2 px-4 py-3 border border-white/10 rounded-xl hover:bg-white/5 transition-all uppercase text-[10px] font-bold tracking-widest backdrop-blur-sm text-white/70 aperture-header"
                                        >
                                            <BookOpen className="h-3.5 w-3.5" />
                                            <span>Fuel</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Stats Area - Side Panel (Desktop Only) */}
                    <div className="hidden md:flex flex-col justify-center items-center p-6 border-l border-white/5 relative w-48 bg-white/[0.02]">
                        {/* Aesthetic Grid Mask */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                            backgroundSize: '16px 16px',
                            maskImage: 'linear-gradient(to bottom, black, transparent)'
                        }} />

                        <div className="text-center relative z-10">
                            <div className="text-5xl font-bold mb-1 lining-nums text-white aperture-header">
                                {Math.round(mainTask.impact_score * 100)}<span className="text-xl opacity-50">%</span>
                            </div>
                            <div className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40 text-white aperture-header">
                                Momentum
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/5 w-full flex justify-center text-white/30">
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <span className="text-[9px] font-bold uppercase tracking-widest aperture-header">
                                    {mainTask.total_estimated_minutes || 50}m
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alternative Toggle Bar */}
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
                {showReview && mainTask && mainTask.checklist_items && (
                    <PowerHourReview
                        task={{
                            ...mainTask,
                            checklist_items: mainTask.checklist_items.map(item => ({
                                ...item,
                                estimated_minutes: item.estimated_minutes || 15
                            })),
                            total_estimated_minutes: mainTask.total_estimated_minutes || 50
                        }}
                        projectColor={theme.text}
                        onClose={() => setShowReview(false)}
                        onStart={handleConfirmSession}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
