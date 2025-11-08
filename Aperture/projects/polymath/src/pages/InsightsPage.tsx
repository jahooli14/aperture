/**
 * Insights Page
 * Displays synthesis insights: evolution, patterns, collisions
 * Shows how thinking evolved and project patterns
 */

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Sparkles, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react'
import type { SynthesisInsight } from '../types'

export function InsightsPage() {
  const [insights, setInsights] = useState<SynthesisInsight[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics?resource=evolution')
      if (!response.ok) throw new Error('Failed to fetch insights')
      const data = await response.json()
      setInsights(data.insights || [])
    } catch (error) {
      console.error('Error fetching insights:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  const getInsightIcon = (type: string) => {
    const iconStyle = { color: 'var(--premium-blue)' }
    switch (type) {
      case 'evolution': return <TrendingUp className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
      case 'pattern': return <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-indigo)' }} />
      case 'collision': return <AlertCircle className="h-6 w-6" style={{ color: 'var(--premium-amber)' }} />
      case 'opportunity': return <Lightbulb className="h-6 w-6" style={{ color: 'var(--premium-emerald)' }} />
      default: return <Sparkles className="h-6 w-6" style={{ color: 'var(--premium-text-tertiary)' }} />
    }
  }

  const getInsightStyle = (type: string): React.CSSProperties => {
    switch (type) {
      case 'evolution': return { backgroundColor: 'rgba(59, 130, 246, 0.1)' }
      case 'pattern': return { backgroundColor: 'rgba(139, 92, 246, 0.1)' }
      case 'collision': return { backgroundColor: 'rgba(245, 158, 11, 0.1)' }
      case 'opportunity': return { backgroundColor: 'rgba(16, 185, 129, 0.1)' }
      default: return { backgroundColor: 'rgba(255, 255, 255, 0.05)' }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-r-transparent mb-4" style={{ borderColor: 'var(--premium-blue)' }}></div>
            <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Synthesizing insights...</p>
          </div>
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="min-h-screen py-12" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <Card className="premium-card">
            <CardContent className="py-16 text-center">
              <Sparkles className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                Building Your Insights
              </h2>
              <p style={{ color: 'var(--premium-text-secondary)' }} className="mb-6">
                Capture at least 10 thoughts to see evolution patterns and synthesis insights
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <motion.div
        className="py-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="max-w-5xl mx-auto px-4 mb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
            Your Synthesis Insights
          </h1>
          <p className="text-xl" style={{ color: 'var(--premium-text-secondary)' }}>
            How your thinking evolved and patterns emerged
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-6">
        {insights.map((insight, index) => (
          <Card key={index} className="premium-card" style={getInsightStyle(insight.type)}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                    {insight.title}
                  </h3>
                  <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                    {insight.description}
                  </p>

                  {/* Evolution Timeline */}
                  {insight.type === 'evolution' && insight.data?.timeline && (
                    <div className="mb-4 space-y-3">
                      {insight.data.timeline.map((event: any, i: number) => (
                        <div key={i} className="pl-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
                              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                                {event.stance}
                              </p>
                              <p className="text-sm italic" style={{ color: 'var(--premium-text-secondary)' }}>
                                "{event.quote}"
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pattern Details */}
                  {insight.type === 'pattern' && insight.data?.recommendation && (
                    <div className="p-4 rounded-lg premium-glass-subtle">
                      <p className="text-sm font-medium mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                        💡 Recommendation:
                      </p>
                      <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
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
                              className="px-2 py-0.5 rounded text-xs font-medium"
                              style={
                                i === 0
                                  ? { backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--premium-emerald)' }
                                  : { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }
                              }
                            >
                              {event.stance}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm italic" style={{ color: 'var(--premium-text-secondary)' }}>
                            "{event.quote}"
                          </p>
                        </div>
                      ))}
                    </div>
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
            </CardContent>
          </Card>
        ))}

        {/* Summary */}
        <Card className="premium-card">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              Understanding Your Journey
            </h3>
            <p style={{ color: 'var(--premium-text-secondary)' }}>
              These insights show how your thinking evolves over time. Contradictions aren't failures—they're
              signs of growth. Patterns help you understand your creative process and break unproductive cycles.
            </p>
          </CardContent>
        </Card>
      </div>
      </motion.div>
    </div>
  )
}
