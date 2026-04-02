/**
 * Insights Page
 * Displays synthesis insights: evolution, patterns, collisions
 * Shows how thinking evolved and project patterns
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Zap, TrendingUp, AlertCircle, Lightbulb, Search, Brain, WifiOff, RefreshCw } from 'lucide-react'
import { SubtleBackground } from '../components/SubtleBackground'
import type { SynthesisInsight } from '../types'
import { readingDb } from '../lib/db'

export function InsightsPage() {
  const navigate = useNavigate()
  const [insights, setInsights] = useState<SynthesisInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showResolutionDialog, setShowResolutionDialog] = useState(false)
  const [resolutionPrompt, setResolutionPrompt] = useState('')
  const [resolutionInsight, setResolutionInsight] = useState<SynthesisInsight | null>(null)
  const [resolutionText, setResolutionText] = useState('')

  const handleResolveContradiction = (insight: SynthesisInsight) => {
    const stances = insight.data?.timeline || []
    if (stances.length < 2) return

    const prompt = `You said: "${stances[0]?.quote || stances[0]?.stance}"\nThen you said: "${stances[stances.length - 1]?.quote || stances[stances.length - 1]?.stance}"\n\nWhat's the deeper truth that contains both?`

    setResolutionPrompt(prompt)
    setResolutionInsight(insight)
    setShowResolutionDialog(true)
  }

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 1. Load from IndexedDB first (instant)
      const cached = await readingDb.getDashboard('evolution')
      if (cached) {
        setInsights(cached.insights || [])
        setGeneratedAt(cached.generated_at || null)
        setLoading(false)
      }

      // 2. If offline, stop here
      if (!navigator.onLine) {
        setIsOffline(true)
        if (!cached) setLoading(false)
        return
      }

      // 3. Fetch cached insights from server (fast — just a DB read)
      setIsOffline(false)
      const response = await fetch('/api/analytics?resource=evolution')
      if (response.ok) {
        const data = await response.json()
        if (data.insights?.length > 0) {
          setInsights(data.insights)
          setGeneratedAt(data.generated_at || null)
          await readingDb.cacheDashboard('evolution', data)
        } else if (!cached) {
          // Nothing cached anywhere — trigger a fresh generation
          triggerRefresh()
        }
      }
    } catch (error) {
      console.error('Error fetching insights:', error)
      if (insights.length === 0) {
        setError(error instanceof Error ? error.message : 'Failed to load insights')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const triggerRefresh = useCallback(async () => {
    if (refreshing || !navigator.onLine) return
    setRefreshing(true)
    setError(null)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      const response = await fetch('/api/analytics?resource=evolution', {
        method: 'POST',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Refresh failed')
      }
      const data = await response.json()
      setInsights(data.insights || [])
      setGeneratedAt(data.generated_at || null)
      await readingDb.cacheDashboard('evolution', data)
    } catch (error) {
      console.error('Error refreshing insights:', error)
      if (error instanceof Error && error.name !== 'AbortError') {
        setError(error.message)
      }
    } finally {
      setRefreshing(false)
    }
  }, [refreshing])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'evolution': return <TrendingUp className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
      case 'pattern': return <Zap className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
      case 'collision': return <AlertCircle className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
      case 'opportunity': return <Lightbulb className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
      default: return <Brain className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
    }
  }

  const getInsightStyle = (type: string): React.CSSProperties => {
    switch (type) {
      case 'evolution': return { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
      case 'pattern': return { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
      case 'collision': return { backgroundColor: 'rgba(245, 158, 11, 0.1)' }
      case 'opportunity': return { backgroundColor: 'rgba(16, 185, 129, 0.1)' }
      default: return { backgroundColor: 'var(--glass-surface)' }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {/* Subtle Background Effect */}
      <SubtleBackground />

      {/* Fixed Header Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.7)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-7 w-7" style={{ color: 'var(--brand-primary)', opacity: 0.7 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: '-0.04em',
              color: 'var(--brand-text-secondary)',
              opacity: 0.7
            }}>
              Insights
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {insights.length > 0 && (
              <button
                onClick={triggerRefresh}
                disabled={refreshing}
                className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--glass-surface)] disabled:opacity-40"
                style={{ color: "var(--brand-primary)" }}
                title="Regenerate insights from all your data"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => navigate('/search')}
              className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--glass-surface)]"
              style={{ color: "var(--brand-primary)" }}
              title="Search everything"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>
        {loading ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--brand-glass-bg)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div className="text-center py-12">
                <div className="relative inline-block mb-4">
                  <Brain className="h-12 w-12 animate-pulse" style={{ color: "var(--brand-primary)" }} />
                </div>
                <p className="text-lg font-medium mb-1" style={{ color: "var(--brand-primary)" }}>Analyzing your thoughts...</p>
                <p className="text-sm" style={{ color: "var(--brand-primary)" }}>Finding patterns and connections</p>
              </div>
            </div>
          </section>
        ) : error ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--brand-glass-bg)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div className="py-12 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: "var(--brand-primary)" }} />
                <h2 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
                  Something went wrong
                </h2>
                <p className="mb-4" style={{ color: "var(--brand-primary)" }}>
                  {error}
                </p>
                <Button onClick={fetchInsights} className="btn-primary">
                  Try Again
                </Button>
              </div>
            </div>
          </section>
        ) : insights.length === 0 ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--brand-glass-bg)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div className="py-16 text-center">
                {isOffline ? (
                  <>
                    <WifiOff className="h-16 w-16 mx-auto mb-4" style={{ color: "var(--brand-primary)" }} />
                    <h2 className="text-2xl font-bold mb-2 premium-text-platinum">
                      Offline
                    </h2>
                    <p style={{ color: "var(--brand-primary)" }} className="mb-6">
                      Insights will be available when you're back online
                    </p>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-16 w-16 mx-auto mb-4" style={{ color: "var(--brand-primary)" }} />
                    <h2 className="text-2xl font-bold mb-2 premium-text-platinum">
                      No insights yet
                    </h2>
                    <p style={{ color: "var(--brand-primary)" }} className="mb-6">
                      Add a few thoughts and articles, then generate your first insights.
                    </p>
                    <Button onClick={triggerRefresh} disabled={refreshing} className="btn-primary">
                      {refreshing ? 'Analysing your data...' : 'Generate insights'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Header Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
              <div className="p-6 rounded-xl backdrop-blur-xl" style={{
                background: 'var(--brand-glass-bg)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              }}>
                <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                  Your synthesis <span style={{ color: "var(--brand-primary)" }}>insights</span>
                </h2>
                <p className="mt-2 text-lg" style={{ color: "var(--brand-primary)" }}>
                  What your data actually means — patterns, tensions, and intersections
                </p>
                {generatedAt && (
                  <p className="mt-1 text-xs opacity-50" style={{ color: "var(--brand-primary)" }}>
                    Generated {new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {refreshing && ' · Refreshing...'}
                  </p>
                )}
              </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {insights.map((insight, index) => (
              <div
                key={index}
                className="p-6 rounded-xl backdrop-blur-xl transition-all duration-300"
                style={{
                  background: 'var(--brand-glass-bg)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  ...getInsightStyle(insight.type)
                }}
              >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2" style={{ color: "var(--brand-primary)" }}>
                    {insight.title}
                  </h3>
                  <p className="mb-4" style={{ color: "var(--brand-primary)" }}>
                    {insight.description}
                  </p>

                  {/* Evolution Timeline */}
                  {insight.type === 'evolution' && insight.data?.timeline && (
                    <div className="mb-4 space-y-3">
                      {insight.data.timeline.map((event: any, i: number) => (
                        <div key={i} className="pl-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm" style={{ color: "var(--brand-primary)" }}>
                              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-1" style={{ color: "var(--brand-primary)" }}>
                                {event.stance}
                              </p>
                              <p className="text-sm italic" style={{ color: "var(--brand-primary)" }}>
                                "{event.quote}"
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Evidence chips */}
                  {insight.data?.evidence && Array.isArray(insight.data.evidence) && insight.data.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {insight.data.evidence.map((e: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-lg text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--brand-primary)', opacity: 0.8 }}>
                          {e}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Recommendation */}
                  {insight.data?.recommendation && (
                    <div className="p-4 rounded-lg premium-glass-subtle">
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--brand-primary)" }}>
                        What to do with this:
                      </p>
                      <p className="text-sm" style={{ color: "var(--brand-primary)" }}>
                        {insight.data.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Collision Details */}
                  {insight.type === 'collision' && insight.data?.timeline && (
                    <div className="space-y-2">
                      {insight.data.timeline.map((event: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg premium-glass-subtle">
                          <div className="flex items-start gap-2 mb-1">
                            <span
                              className="px-2 py-0.5 rounded-xl text-xs font-medium"
                              style={
                                i === 0
                                  ? { backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--brand-primary)' }
                                  : { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: "var(--brand-text-secondary)" }
                              }
                            >
                              {event.stance}
                            </span>
                            <span className="text-xs" style={{ color: "var(--brand-primary)" }}>
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm italic" style={{ color: "var(--brand-primary)" }}>
                            "{event.quote}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Resolve Contradiction Button */}
                  {insight.type === 'collision' && (
                    <button
                      onClick={() => handleResolveContradiction(insight)}
                      className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-primary/10 border border-purple-500/20 text-brand-primary text-sm hover:bg-brand-primary/20 transition-all"
                    >
                      <Zap className="w-4 h-4" />
                      Resolve this tension
                    </button>
                  )}

                  {/* Action Button */}
                      {insight.actionable && insight.action && (
                        <div className="mt-4 pt-4">
                          <Button className="btn-primary w-full sm:w-auto">
                            {insight.action}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            ))}

            {/* Summary */}
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--brand-glass-bg)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 className="text-lg font-bold mb-3 premium-text-platinum">
                Understanding Your Journey
              </h3>
              <p style={{ color: "var(--brand-primary)" }}>
                These insights show how your thinking evolves over time. Contradictions aren't failuresthey're
                signs of growth. Patterns help you understand your creative process and break unproductive cycles.
              </p>
            </div>
          </div>
        </>
        )}
      </div>

      {/* Contradiction Resolution Dialog */}
      {showResolutionDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60" onClick={() => setShowResolutionDialog(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-[#1a1f35] border border-[var(--glass-surface-hover)] p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--brand-text-primary)] mb-3">Resolve the tension</h3>
            <div className="p-3 rounded-xl bg-brand-primary/5 border border-purple-500/10 mb-4">
              <p className="text-sm text-[var(--brand-text-secondary)] whitespace-pre-line">{resolutionPrompt}</p>
            </div>
            <textarea
              value={resolutionText}
              onChange={e => setResolutionText(e.target.value)}
              placeholder="The deeper truth is..."
              className="w-full bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] rounded-xl px-4 py-3 text-sm text-[var(--brand-text-primary)] placeholder-gray-500 focus:outline-none focus:border-purple-500/30 min-h-[100px] resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowResolutionDialog(false)}
                className="px-4 py-2 text-sm text-[var(--brand-text-secondary)] hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!resolutionText.trim()) return
                  try {
                    await fetch('/api/memories?capture=true', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: `Resolution: ${resolutionInsight?.title || 'Contradiction'}`,
                        body: `${resolutionPrompt}\n\nMy resolution:\n${resolutionText}`,
                        tags: ['resolution', 'contradiction', 'insight'],
                        memory_type: 'insight'
                      })
                    })
                    setShowResolutionDialog(false)
                    setResolutionText('')
                  } catch (e) {
                    console.error('Failed to save resolution:', e)
                  }
                }}
                disabled={!resolutionText.trim()}
                className="px-4 py-2 text-sm bg-brand-primary/20 text-brand-primary rounded-xl hover:bg-brand-primary/30 disabled:opacity-30 transition-all"
              >
                Save as insight
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
