import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Play, ArrowRight, BookOpen, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { haptic } from '../../utils/haptics'
import { readingDb } from '../../lib/db'

interface PowerTask {
    project_id: string
    project_title: string
    task_title: string
    task_description: string
    impact_score: number
    fuel_id?: string
    fuel_title?: string
}

export function PowerHourHero() {
    const [tasks, setTasks] = useState<PowerTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [debugInfo, setDebugInfo] = useState<any>(null)
    const navigate = useNavigate()

    useEffect(() => {
        async function fetchPowerHour() {
            try {
                // 1. Load from client-side cache first (Instant)
                const cached = await readingDb.getDashboard('power-hour')
                if (cached && cached.tasks) {
                    console.log('[PowerHourHero] Loaded from client-side cache')
                    setTasks(cached.tasks)
                    setLoading(false)
                }

                console.log('[PowerHourHero] Fetching fresh tasks from API...')
                const res = await fetch('/api/power-hour')
                const contentType = res.headers.get('content-type')

                if (!res.ok) {
                    if (contentType && contentType.includes('application/json')) {
                        const errData = await res.json()
                        throw new Error(errData.error || `HTTP ${res.status}`)
                    } else {
                        throw new Error(`Deployment mismatch: Route not found or returning HTML. Ensure you have deployed or are running 'vercel dev'.`)
                    }
                }

                if (contentType && !contentType.includes('application/json')) {
                    throw new Error(`Cloud Proxy Error: Received HTML instead of JSON. Ensure your local backend is running or deploy your changes.`)
                }

                const data = await res.json()
                console.log('[PowerHourHero] API Response:', data)
                setDebugInfo(data)

                if (data.tasks) {
                    // 2. Save to client-side cache for next time
                    await readingDb.cacheDashboard('power-hour', { tasks: data.tasks })

                    // 3. Update UI if data changed or we didn't have cache
                    setTasks(data.tasks)
                }
            } catch (e: any) {
                console.error('[PowerHourHero] Fetch Error:', e)
                // Only show error if we have no tasks at all
                if (tasks.length === 0) {
                    setError(e.message)
                }
            } finally {
                setLoading(false)
            }
        }
        fetchPowerHour()
    }, [])

    if (loading) return (
        <div className="w-full h-48 bg-zebra-gray-dark animate-pulse rounded-2xl border border-white/10 mb-8" />
    )

    if (error) return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-12 text-center border-2 border-dashed border-red-500/20 bg-red-500/5">
                <Zap className="h-12 w-12 text-red-500/20 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase italic mb-2 tracking-tighter text-red-500">Engine Offline</h2>
                <p className="text-gray-400 text-sm max-w-sm mx-auto mb-6">
                    {error}
                </p>
                <div className="flex gap-4 justify-center">
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 bg-red-500 text-white font-black uppercase text-xs tracking-widest hover:bg-black transition-colors"
                    >
                        Retry Feed
                    </button>
                </div>
            </div>
        </div>
    )

    if (tasks.length === 0) return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-12 text-center border-2 border-dashed border-white/20">
                <Zap className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <h2 className="text-xl font-black uppercase italic mb-2 tracking-tighter">Engine Dormant</h2>
                <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
                    Aperture needs at least one active project to fuel the Power Hour. Start a new hunt to begin.
                </p>
                <button
                    onClick={() => navigate('/projects')}
                    className="px-6 py-3 bg-white text-black font-black uppercase text-xs tracking-widest hover:bg-zebra-accent transition-colors"
                >
                    Initialize First Project
                </button>
            </div>
        </div>
    )

    const mainTask = tasks[0]

    return (
        <div className="relative overflow-hidden mb-12">
            <div className="zebra-card p-0 rounded-2xl overflow-hidden border-2 border-white">
                <div className="bg-white text-black px-4 py-1 inline-block font-black text-xs uppercase tracking-widest absolute top-4 left-4 z-10">
                    Power Hour
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2">
                    {/* Main Action Area */}
                    <div className="p-8 pb-12 md:pb-8 flex flex-col justify-center">
                        <div className="text-zebra-accent mb-2 flex items-center gap-2 font-bold text-sm">
                            <Zap className="h-4 w-4 fill-current" />
                            <span>{mainTask.project_title}</span>
                        </div>

                        <h1 className="text-3xl md:text-4xl font-black mb-4 uppercase leading-tight italic">
                            {mainTask.task_title}
                        </h1>

                        <p className="text-gray-400 mb-8 max-w-md">
                            {mainTask.task_description}
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => {
                                    haptic.heavy()
                                    // Find all tasks for this project in the power hour plan
                                    const projectTasks = tasks.filter(t => t.project_id === mainTask.project_id)
                                    navigate(`/projects/${mainTask.project_id}`, { state: { powerHourTasks: projectTasks } })
                                }}
                                className="zebra-btn flex items-center gap-2 group"
                            >
                                <Play className="h-4 w-4 fill-current" />
                                <span>Quick Start</span>
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </button>

                            {mainTask.fuel_id && (
                                <button
                                    onClick={() => navigate(`/reading/${mainTask.fuel_id}`)}
                                    className="flex items-center gap-2 px-4 py-2 border border-white/20 hover:border-white transition-colors uppercase text-xs font-bold"
                                >
                                    <BookOpen className="h-4 w-4" />
                                    <span>Fuel: {mainTask.fuel_title?.slice(0, 20)}...</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Visual / Momentum Area */}
                    <div className="bg-zebra flex items-center justify-center p-8 border-t md:border-t-0 md:border-l border-white/20 relative">
                        <div className="absolute top-4 right-4 text-white/20 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase">60 Min Sprint</span>
                        </div>

                        <div className="text-center">
                            <div className="text-6xl font-black mb-2 lining-nums italic">
                                {Math.round(mainTask.impact_score * 100)}%
                            </div>
                            <div className="text-xs font-bold uppercase tracking-widest opacity-60">
                                Project Completion Impact
                            </div>
                        </div>

                        {/* Stripe Decor */}
                        <div className="absolute bottom-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
                            <div className="w-full h-full bg-zebra" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
