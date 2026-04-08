import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { X, Lightbulb, BookOpen, Layers, Brain, Link as LinkIcon, Loader2, TrendingUp, RefreshCw, HelpCircle, Shuffle, Database, GitBranch, Zap } from 'lucide-react'
import { useContextEngineStore, ContextItem } from '../../stores/useContextEngineStore'
import { useToast } from '../ui/toast'

interface AIAnalysis {
    summary: string
    patterns: string[]
    insight: string
    suggestion: string
}

interface AnalysisData {
    analysis: AIAnalysis
    connectionCount: number
    lakeItemCount?: number
    semanticCount?: number
    itemType: string
    itemTitle: string
}

export function ContextSidebar() {
    const {
        sidebarOpen,
        toggleSidebar,
        activeContext,
        relatedItems,
        loading,
        fetchRelatedContext
    } = useContextEngineStore()

    const navigate = useNavigate()
    const { addToast } = useToast()

    const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
    const [analysisLoading, setAnalysisLoading] = useState(false)
    const [actionResult, setActionResult] = useState<{ type: string; result: string; totalContextItems?: number; semanticCount?: number } | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const executeAction = async (actionType: string) => {
        if (!activeContext.id || activeContext.type === 'page' || activeContext.type === 'home') {
            return
        }

        setActionLoading(actionType)
        setActionResult(null)
        try {
            const response = await fetch(
                `/api/connections?action=ai-action&id=${activeContext.id}&type=${activeContext.type}&actionType=${actionType}`
            )
            if (response.ok) {
                const data = await response.json()
                setActionResult({
                    type: actionType,
                    result: data.result,
                    totalContextItems: data.totalContextItems,
                    semanticCount: data.semanticCount
                })
            }
        } catch (error) {
            console.error('Failed to execute action:', error)
            addToast({
                title: 'Action failed',
                variant: 'destructive'
            })
        } finally {
            setActionLoading(null)
        }
    }

    const fetchAnalysis = async () => {
        if (!activeContext.id || activeContext.type === 'page' || activeContext.type === 'home') {
            setAnalysisData(null)
            return
        }

        setAnalysisLoading(true)
        try {
            const response = await fetch(
                `/api/connections?action=analyze&id=${activeContext.id}&type=${activeContext.type}`
            )
            if (response.ok) {
                const data = await response.json()
                setAnalysisData(data)
            } else {
                console.error('Failed to fetch analysis: Response not OK', response.status)
                addToast({
                    title: 'Analysis failed',
                    description: `API responded with status: ${response.status}`,
                    variant: 'destructive'
                })
                setAnalysisData(null) // Clear analysis data on non-OK response
            }
        } catch (error) {
            console.error('Failed to fetch analysis:', error)
            addToast({
                title: 'Analysis failed',
                description: 'Could not connect to analysis service.',
                variant: 'destructive'
            })
            setAnalysisData(null) // Clear analysis data on fetch error
        } finally {
            setAnalysisLoading(false)
        }
    }

    // Auto-refresh when sidebar is open and context changes
    useEffect(() => {
        if (sidebarOpen) {
            fetchRelatedContext()
            fetchAnalysis()
        }
    }, [activeContext.id, sidebarOpen])

    const handleItemClick = (item: ContextItem) => {
        // Navigate to the item
        switch (item.type) {
            case 'article':
                navigate(`/reading/${item.id}`)
                break
            case 'project':
                navigate(`/projects/${item.id}`)
                break
            case 'memory':
                // Memories usually open in a dialog, but we can navigate to memories page with query
                navigate(`/memories?id=${item.id}`)
                break
        }
        // Optional: close sidebar on mobile, keep open on desktop?
        // For now, keep open to allow exploring
    }

    const handleLinkItem = async (e: React.MouseEvent, item: ContextItem) => {
        e.stopPropagation()
        // Create a connection between active context and this item
        try {
            const response = await fetch('/api/connections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_type: activeContext.type,
                    source_id: activeContext.id,
                    target_type: item.type,
                    target_id: item.id,
                    connection_type: 'manual_context_link',
                    reasoning: 'Linked via Context Engine'
                })
            })

            if (response.ok) {
                addToast({
                    title: 'Connected!',
                    description: `Linked "${item.title}" to current context`,
                    variant: 'success'
                })
            }
        } catch (error) {
            addToast({
                title: 'Failed to link',
                variant: 'destructive'
            })
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'article': return BookOpen
            case 'project': return Layers
            case 'memory': return Brain
            default: return Lightbulb
        }
    }

    return (
        <AnimatePresence>
            {sidebarOpen && (
                <>
                    {/* Backdrop for mobile */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => toggleSidebar(false)}
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
                    />

                    {/* Sidebar */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 z-50 w-80 shadow-2xl border-l border-[var(--glass-surface-hover)] flex flex-col"
                        style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            backdropFilter: 'blur(20px)'
                        }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--glass-surface-hover)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Lightbulb className="h-5 w-5 text-brand-primary" />
                                <h2 className="font-bold text-[var(--brand-text-primary)]">Context Engine</h2>
                            </div>
                            <button
                                onClick={() => toggleSidebar(false)}
                                className="p-2 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors text-[var(--brand-text-secondary)] hover:text-[var(--brand-text-primary)]"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Active Context Indicator */}
                        <div className="px-4 py-3 bg-[var(--glass-surface)] border-b border-[var(--glass-surface)]">
                            <p className="text-xs font-medium text-brand-primary mb-1 uppercase tracking-wider">
                                Current Focus
                            </p>
                            <p className="text-sm text-[var(--brand-text-primary)] font-medium truncate">
                                {activeContext.title || 'Exploring...'}
                            </p>
                            <p className="text-xs text-[var(--brand-text-secondary)] capitalize">
                                {activeContext.type}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {/* AI Analysis Section */}
                            {activeContext.type !== 'page' && activeContext.type !== 'home' && (
                                <div className="rounded-xl p-4 bg-gradient-to-br from-brand-primary/10 to-brand-primary/10 border border-brand-primary/20">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Lightbulb className="h-4 w-4 text-brand-primary" />
                                            <span className="text-xs font-semibold text-brand-primary uppercase tracking-wider">
                                                AI Analysis
                                            </span>
                                            {analysisData?.lakeItemCount != null && analysisData.lakeItemCount > 0 && (
                                                <div className="flex items-center gap-1" title={`Looked at ${analysisData.lakeItemCount} of your notes and articles`}>
                                                    <Database className="h-3 w-3 text-brand-primary" />
                                                    <span className="text-[10px] text-brand-primary font-medium">{analysisData.lakeItemCount}</span>
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={fetchAnalysis}
                                            disabled={analysisLoading}
                                            className="p-1 hover:bg-[rgba(255,255,255,0.1)] rounded-xl transition-colors"
                                            title="Refresh analysis"
                                        >
                                            <RefreshCw className={`h-3 w-3 text-[var(--brand-text-secondary)] ${analysisLoading ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>

                                    {analysisLoading ? (
                                        <div className="flex items-center gap-2 text-[var(--brand-text-secondary)] text-sm">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Analyzing...</span>
                                        </div>
                                    ) : analysisData ? (
                                        <div className="space-y-3">
                                            {/* Summary */}
                                            <p className="text-sm text-[var(--brand-text-secondary)] leading-relaxed">
                                                {analysisData.analysis.summary}
                                            </p>

                                            {/* Patterns */}
                                            {analysisData.analysis.patterns.length > 0 && (
                                                <div className="space-y-1">
                                                    {analysisData.analysis.patterns.map((pattern, i) => (
                                                        <div key={i} className="flex items-start gap-2">
                                                            <TrendingUp className="h-3 w-3 text-brand-primary mt-1 flex-shrink-0" />
                                                            <span className="text-xs text-[var(--brand-text-secondary)]">{pattern}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Insight */}
                                            {analysisData.analysis.insight && (
                                                <div className="flex items-start gap-2 pt-2 border-t border-[var(--glass-surface)]">
                                                    <Lightbulb className="h-3 w-3 text-brand-text-secondary mt-1 flex-shrink-0" />
                                                    <span className="text-xs text-brand-primary/80">{analysisData.analysis.insight}</span>
                                                </div>
                                            )}

                                            {/* Suggestion */}
                                            {analysisData.analysis.suggestion && (
                                                <div className="pt-2">
                                                    <p className="text-xs text-brand-primary">
                                                         {analysisData.analysis.suggestion}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Connection count */}
                                            <p className="text-xs text-[var(--brand-text-muted)] pt-1">
                                                {analysisData.connectionCount} connection{analysisData.connectionCount !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-[var(--brand-text-muted)]">
                                            No analysis available yet
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Quick Actions */}
                            {activeContext.type !== 'page' && activeContext.type !== 'home' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-[var(--brand-text-secondary)] uppercase tracking-wider">
                                            Knowledge Actions
                                        </p>
                                        <div className="flex items-center gap-1 ml-auto opacity-50">
                                            <Database className="h-3 w-3 text-brand-primary" />
                                            <span className="text-[10px] text-brand-primary font-medium">lake-aware</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {([
                                            { id: 'chase-thread', label: 'Chase Thread', icon: GitBranch, color: 'text-brand-primary', hint: 'follow the idea' },
                                            { id: 'find-gaps', label: 'Find Gaps', icon: HelpCircle, color: 'text-brand-primary', hint: 'blind spots' },
                                            { id: 'provoke', label: 'Provoke', icon: Zap, color: 'text-brand-primary', hint: 'challenge me' },
                                            { id: 'connect-dots', label: 'Reveal Pattern', icon: Shuffle, color: 'text-brand-primary', hint: 'full corpus' },
                                        ] as const).map(({ id, label, icon: Icon, color, hint }) => (
                                            <button
                                                key={id}
                                                onClick={() => executeAction(id)}
                                                disabled={!!actionLoading}
                                                className={`flex flex-col gap-1 p-3 rounded-xl transition-all text-left border ${
                                                    actionLoading === id
                                                        ? 'bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)]'
                                                        : 'bg-[var(--glass-surface)] hover:bg-[rgba(255,255,255,0.08)] border-transparent hover:border-[rgba(255,255,255,0.1)]'
                                                }`}
                                            >
                                                {actionLoading === id ? (
                                                    <Loader2 className={`h-4 w-4 animate-spin ${color}`} />
                                                ) : (
                                                    <Icon className={`h-4 w-4 ${color}`} />
                                                )}
                                                <span className="text-xs font-semibold text-[var(--brand-text-secondary)]">{label}</span>
                                                <span className="text-[10px] text-[var(--brand-text-muted)]">{hint}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Action Result */}
                                    {actionResult && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="rounded-xl p-3 bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)]"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-semibold text-[var(--brand-text-secondary)] capitalize">
                                                        {actionResult.type === 'chase-thread' ? 'Thread Traced'
                                                            : actionResult.type === 'find-gaps' ? 'Gaps Found'
                                                            : actionResult.type === 'provoke' ? 'Challenge'
                                                            : 'Pattern Revealed'}
                                                    </span>
                                                    {actionResult.totalContextItems != null && actionResult.totalContextItems > 0 && (
                                                        <span className="text-[10px] text-brand-primary font-medium opacity-70">
                                                            {actionResult.totalContextItems} items
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => setActionResult(null)}
                                                    className="p-1 hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
                                                >
                                                    <X className="h-3 w-3 text-[var(--brand-text-muted)]" />
                                                </button>
                                            </div>
                                            <div className="text-sm text-[var(--brand-text-secondary)] leading-relaxed space-y-2">
                                                {actionResult.result.split('\n').map((line, i) => {
                                                    const trimmed = line.trim()
                                                    if (!trimmed) return null

                                                    if (trimmed.startsWith('- ') || trimmed.match(/^\d+\./)) {
                                                        const text = trimmed.replace(/^[-]\s*/, '').replace(/^\d+\.\s*/, '')
                                                        return (
                                                            <div key={i} className="flex items-start gap-2">
                                                                <span className="text-brand-primary mt-0.5 flex-shrink-0">›</span>
                                                                <span>{text}</span>
                                                            </div>
                                                        )
                                                    }

                                                    if (trimmed.includes('**')) {
                                                        const parts = trimmed.split(/\*\*(.*?)\*\*/g)
                                                        return (
                                                            <p key={i}>
                                                                {parts.map((part, j) =>
                                                                    j % 2 === 1
                                                                        ? <strong key={j} className="text-[var(--brand-text-primary)] font-medium">{part}</strong>
                                                                        : part
                                                                )}
                                                            </p>
                                                        )
                                                    }

                                                    return <p key={i}>{trimmed}</p>
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            {/* Related Items Section */}
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-[var(--brand-text-secondary)]">
                                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-brand-primary" />
                                    <p className="text-sm">Analyzing context...</p>
                                </div>
                            ) : relatedItems.length === 0 ? (
                                <div className="text-center py-12 text-[var(--brand-text-muted)]">
                                    <p>No direct connections found.</p>
                                    <p className="text-xs mt-2">Try exploring other areas to build connections.</p>
                                </div>
                            ) : (
                                relatedItems.map((item) => {
                                    const Icon = getIcon(item.type)
                                    return (
                                        <motion.div
                                            key={`${item.type}-${item.id}`}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group relative bg-[var(--glass-surface)] hover:bg-[rgba(255,255,255,0.1)] rounded-xl p-3 cursor-pointer transition-all border border-transparent hover:border-brand-primary/30"
                                            onClick={() => handleItemClick(item)}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-lg bg-black/20 ${item.type === 'project' ? 'text-brand-primary' :
                                                    item.type === 'memory' ? 'text-brand-text-secondary' :
                                                        'text-brand-text-secondary'
                                                    }`}>
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-sm font-medium text-gray-200 leading-tight mb-1 group-hover:text-[var(--brand-text-primary)] transition-colors">
                                                        {item.title}
                                                    </h3>
                                                    {item.matchReason && (
                                                        <p className="text-xs text-[var(--brand-text-muted)] line-clamp-2">
                                                            {item.matchReason}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Hover Actions */}
                                            <div className="absolute right-2 top-2 opacity-60 flex gap-1">
                                                <button
                                                    onClick={(e) => handleLinkItem(e, item)}
                                                    className="p-1.5 bg-brand-primary/20 hover:bg-brand-primary text-brand-primary hover:text-[var(--brand-text-primary)] rounded-lg transition-colors"
                                                    title="Link to current context"
                                                >
                                                    <LinkIcon className="h-3 w-3" />
                                                </button>
                                            </div>
                                        </motion.div>
                                    )
                                })
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
