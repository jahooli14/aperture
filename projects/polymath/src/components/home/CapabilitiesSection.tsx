import React, { useEffect, useState } from 'react'
import { Sparkles, Zap, RefreshCw, Trash2, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/toast'

interface Capability {
    id: string
    name: string
    description: string
    strength: number
    last_used?: string
}

export function CapabilitiesSection() {
    const [capabilities, setCapabilities] = useState<Capability[]>([])
    const [loading, setLoading] = useState(false)
    const [extracting, setExtracting] = useState(false)
    const { addToast } = useToast()

    useEffect(() => {
        fetchCapabilities()
    }, [])

    const fetchCapabilities = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('capabilities')
                .select('*')
                .order('strength', { ascending: false })

            if (error) throw error
            setCapabilities(data || [])
        } catch (error) {
            console.error('Failed to fetch capabilities:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleExtractCapabilities = async () => {
        setExtracting(true)
        try {
            const response = await fetch('/api/projects?resource=capabilities&action=extract', {
                method: 'POST'
            })
            if (!response.ok) throw new Error('Extraction failed')

            const result = await response.json()
            addToast({
                title: 'Capabilities Updated',
                description: result.extracted?.length ? `Discovered ${result.extracted.length} new capabilities!` : 'Your capabilities are up to date.',
                variant: 'success'
            })
            fetchCapabilities()
        } catch (error) {
            addToast({
                title: 'Extraction Failed',
                description: 'Could not analyze your data',
                variant: 'destructive'
            })
        } finally {
            setExtracting(false)
        }
    }

    const handleDeleteCapability = async (id: string) => {
        try {
            const { error } = await supabase
                .from('capabilities')
                .delete()
                .eq('id', id)

            if (error) throw error

            setCapabilities(prev => prev.filter(c => c.id !== id))
            addToast({
                title: 'Capability Removed',
                variant: 'success'
            })
        } catch (error) {
            addToast({
                title: 'Failed to delete',
                variant: 'destructive'
            })
        }
    }

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
                background: 'var(--premium-bg-2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                            Your Capabilities
                        </h2>
                        <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                            Skills and interests extracted from your work
                        </p>
                    </div>
                    <button
                        onClick={handleExtractCapabilities}
                        disabled={extracting}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title="Re-analyze Data"
                    >
                        <RefreshCw className={`h-5 w-5 ${extracting ? 'animate-spin' : ''}`} style={{ color: 'var(--premium-text-secondary)' }} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                    </div>
                ) : capabilities.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {capabilities.map(cap => {
                            const level = Math.floor(cap.strength)
                            const progress = (cap.strength - level) * 100
                            const daysSinceUse = cap.last_used
                                ? Math.floor((Date.now() - new Date(cap.last_used).getTime()) / (1000 * 60 * 60 * 24))
                                : 0
                            const isDecaying = daysSinceUse > 30

                            return (
                                <div
                                    key={cap.id}
                                    className="group relative overflow-hidden rounded-xl p-4 transition-all border hover:scale-[1.02]"
                                    style={{
                                        background: isDecaying
                                            ? 'linear-gradient(135deg, rgba(120, 50, 50, 0.1), rgba(80, 40, 40, 0.2))'
                                            : 'linear-gradient(135deg, rgba(255, 215, 0, 0.05), rgba(255, 255, 255, 0.02))',
                                        borderColor: isDecaying
                                            ? 'rgba(150, 50, 50, 0.3)'
                                            : level >= 5 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                                        boxShadow: level >= 5 ? '0 0 15px rgba(255, 215, 0, 0.1)' : 'none'
                                    }}
                                >
                                    <div className="absolute top-3 right-3 flex items-center gap-2">
                                        <span className="text-xs font-mono opacity-50 uppercase tracking-wider">LVL {level}</span>
                                        {level >= 5 && <Sparkles className="h-3 w-3 text-yellow-400" />}
                                    </div>

                                    <h3 className="font-bold text-base mb-1" style={{
                                        color: isDecaying ? 'rgba(255, 200, 200, 0.8)' : 'var(--premium-text-primary)'
                                    }}>
                                        {cap.name}
                                    </h3>

                                    <p className="text-xs line-clamp-2 mb-3 h-8" style={{ color: 'var(--premium-text-secondary)' }}>
                                        {cap.description}
                                    </p>

                                    <div className="relative h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                                        <div
                                            className="h-full transition-all duration-500"
                                            style={{
                                                width: `${progress}%`,
                                                background: isDecaying ? '#ef4444' : level >= 5 ? '#fbbf24' : '#3b82f6'
                                            }}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[10px]" style={{ color: isDecaying ? '#fca5a5' : 'var(--premium-text-tertiary)' }}>
                                            {isDecaying ? `${daysSinceUse}d dormant` : 'Active'}
                                        </span>
                                        <button
                                            onClick={() => handleDeleteCapability(cap.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20"
                                            title="Remove Capability"
                                        >
                                            <Trash2 className="h-3 w-3 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-500">
                        No capabilities found. Try refreshing to analyze your data.
                    </div>
                )}
            </div>
        </section>
    )
}
