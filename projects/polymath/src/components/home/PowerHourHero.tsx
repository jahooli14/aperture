import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Play, ArrowRight, BookOpen, Clock, ChevronDown, RefreshCw, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../../utils/haptics'
import { readingDb } from '../../lib/db'
import { useProjectStore } from '../../stores/useProjectStore'

interface PowerTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string
    session_summary?: string
    checklist_items?: { text: string; is_new: boolean }[]
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
    const navigate = useNavigate()

    // Get all projects for the manual picker
    const { allProjects, updateProject } = useProjectStore()
    const activeProjects = allProjects.filter(p => ['active', 'upcoming', 'maintaining'].includes(p.status))

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

    const mainTask = tasks[selectedIndex] || tasks[0]

    const handleStartPowerHour = async () => {
        haptic.heavy()
        const project = allProjects.find(p => p.id === mainTask.project_id)
        if (!project) return

        let updatedTasks = [...(project.metadata?.tasks || [])] as any[]

        // 1. Identify new tasks to add
        const newTasksFromAI = mainTask.checklist_items?.filter(item => item.is_new) || []

        if (newTasksFromAI.length > 0) {
            const freshTasks = newTasksFromAI.map((t, idx) => ({
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
        navigate(`/projects/${mainTask.project_id}`, {
            state: {
                powerHourTask: mainTask,
                // Pass the specific tasks we want highlighted, based on text matching
                highlightedTasks: mainTask.checklist_items?.map(i => ({ task_title: i.text })) || []
            }
        })
    }

    return (
        <div className="relative mb-12 group/hero">
            <div className="zebra-card p-0 rounded-2xl overflow-hidden border-2 border-white relative">
                {/* Header Overlays */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <div className="bg-white text-black px-4 py-1 font-black text-[10px] uppercase tracking-widest">
                        Power Hour
                    </div>
                </div>

                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                        onClick={() => setShowProjectPicker(!showProjectPicker)}
                        className="bg-black/80 backdrop-blur-md border border-white/20 text-white p-2 hover:bg-white hover:text-black transition-all group/picker"
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
                            className="absolute top-16 right-4 z-30 w-64 bg-black border-2 border-white shadow-2xl max-h-80 overflow-y-auto"
                        >
                            <div className="p-3 bg-zebra-gray border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Select Project Target
                            </div>
                            {activeProjects.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        haptic.light()
                                        fetchPowerHour(p.id)
                                    }}
                                    className="w-full p-4 text-left hover:bg-white hover:text-black transition-colors border-b border-white/5 last:border-0 group"
                                >
                                    <div className="font-black uppercase italic text-sm group-hover:underline">{p.title}</div>
                                    <div className="text-[10px] opacity-60 line-clamp-1">{p.description}</div>
                                </button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Main Action Area */}
                    <div className="p-8 pb-10 md:p-12 relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={mainTask.project_id + mainTask.task_title}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="text-zebra-accent mb-3 flex items-center gap-2 font-black text-xs uppercase tracking-widest">
                                    <Zap className="h-3 w-3 fill-current" />
                                    <span>{mainTask.project_title}</span>
                                </div>

                                <h1 className="text-3xl md:text-5xl font-black mb-6 uppercase leading-[0.9] italic tracking-tighter text-white">
                                    {mainTask.task_title}
                                </h1>

                                <p className="text-gray-400 mb-10 max-w-sm text-sm leading-relaxed">
                                    {mainTask.task_description}
                                </p>

                                <div className="flex flex-wrap gap-4">
                                    <button
                                        onClick={handleStartPowerHour}
                                        className="zebra-btn flex items-center gap-3 group px-8 py-4"
                                    >
                                        <Play className="h-4 w-4 fill-current" />
                                        <span className="text-sm">Start Power Hour</span>
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                    </button>

                                    {mainTask.fuel_id && (
                                        <button
                                            onClick={() => navigate(`/reading/${mainTask.fuel_id}`)}
                                            className="flex items-center gap-2 px-5 py-3 border border-white/20 hover:border-white transition-colors uppercase text-[10px] font-black tracking-widest bg-black/50 backdrop-blur-sm text-white"
                                        >
                                            <BookOpen className="h-4 w-4" />
                                            <span>Read Fuel</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Stats Area */}
                    <div className="bg-zebra flex items-center justify-center p-8 md:p-12 border-t md:border-t-0 md:border-l border-white/20 relative overflow-hidden">
                        <div className="absolute top-4 right-4 text-white/40 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest italic">60m Cap</span>
                        </div>

                        <div className="text-center relative z-10 transition-transform group-hover/hero:scale-110 duration-700">
                            <div className="text-7xl md:text-8xl font-black mb-2 lining-nums italic tracking-tighter text-white">
                                {Math.round(mainTask.impact_score * 100)}%
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 text-white/60">
                                Momentum Delta
                            </div>
                        </div>

                        {/* Aesthetic Stripes */}
                        <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col gap-4 p-4 transform rotate-12">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="w-[200%] h-4 bg-white" />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Alternative Toggle Bar */}
                {tasks.length > 1 && (
                    <div className="border-t border-white/10 bg-black/40 backdrop-blur-xl p-2 flex gap-2">
                        {tasks.map((task, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    haptic.light()
                                    setSelectedIndex(idx)
                                }}
                                className={`flex-1 flex items-center gap-3 p-3 transition-all ${selectedIndex === idx
                                    ? 'bg-white text-black'
                                    : 'hover:bg-white/5 text-gray-500'
                                    }`}
                            >
                                <span className={`font-black italic text-xs lining-nums ${selectedIndex === idx ? 'text-black' : 'text-gray-500'}`}>0{idx + 1}</span>
                                <div className={`text-[10px] font-black uppercase tracking-tighter truncate max-w-[120px] ${selectedIndex === idx ? 'text-black' : 'text-gray-500'}`}>
                                    {task.project_title}
                                </div>
                                {selectedIndex === idx && <div className="ml-auto w-1 h-1 bg-black rounded-full" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
