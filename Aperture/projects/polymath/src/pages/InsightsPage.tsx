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
import { Sparkles, TrendingUp, AlertCircle, Lightbulb, Search } from 'lucide-react'
import { SubtleBackground } from '../components/SubtleBackground'
import type { SynthesisInsight } from '../types'

export function InsightsPage() {
  const navigate = useNavigate()
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
            <TrendingUp className="h-7 w-7" style={{ color: 'var(--premium-blue)', opacity: 0.7 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: 'var(--premium-tracking-tight)',
              color: 'var(--premium-text-secondary)',
              opacity: 0.7
            }}>
              Insights
            </h1>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
            style={{
              color: 'var(--premium-blue)'
            }}
            title="Search everything"
          >
            <Search className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>
        {loading ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--premium-bg-2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div className="text-center py-12">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-r-transparent mb-4" style={{ borderColor: 'var(--premium-blue)' }}></div>
                <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Synthesizing insights...</p>
              </div>
            </div>
          </section>
        ) : insights.length === 0 ? (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--premium-bg-2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <div className="py-16 text-center">
                <Sparkles className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
                <h2 className="text-2xl font-bold mb-2 premium-text-platinum">
                  Building Your Insights
                </h2>
                <p style={{ color: 'var(--premium-text-secondary)' }} className="mb-6">
                  Capture at least 10 thoughts to see evolution patterns and synthesis insights
                </p>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Header Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
              <div className="p-6 rounded-xl backdrop-blur-xl" style={{
                background: 'var(--premium-bg-2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              }}>
                <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
                  Your synthesis <span style={{ color: 'rgba(100, 180, 255, 1)' }}>insights</span>
                </h2>
                <p className="mt-2 text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
                  How your thinking evolved and patterns emerged
                </p>
              </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {insights.map((insight, index) => (
              <div
                key={index}
                className="p-6 rounded-xl backdrop-blur-xl transition-all duration-300"
                style={{
                  background: 'var(--premium-bg-2)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                  ...getInsightStyle(insight.type)
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--premium-bg-3)'
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--premium-bg-2)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
                }}
              >
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
                </div>
            ))}

            {/* Summary */}
            <div className="p-6 rounded-xl backdrop-blur-xl" style={{
              background: 'var(--premium-bg-2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
            }}>
              <h3 className="text-lg font-bold mb-3 premium-text-platinum">
                Understanding Your Journey
              </h3>
              <p style={{ color: 'var(--premium-text-secondary)' }}>
                These insights show how your thinking evolves over time. Contradictions aren't failures—they're
                signs of growth. Patterns help you understand your creative process and break unproductive cycles.
              </p>
            </div>
          </div>
        </>
        )}
      </div>
    </motion.div>
  )
}
