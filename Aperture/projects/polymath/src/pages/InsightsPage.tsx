/**
 * Insights Page
 * Displays synthesis insights: evolution, patterns, collisions
 * Shows how thinking evolved and project patterns
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { PullToRefresh } from '../components/PullToRefresh'
import { Sparkles, TrendingUp, AlertCircle, Lightbulb } from 'lucide-react'
import type { SynthesisInsight } from '../types'

export function InsightsPage() {
  const [insights, setInsights] = useState<SynthesisInsight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInsights()
  }, [])

  const fetchInsights = async () => {
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
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'evolution': return <TrendingUp className="h-6 w-6 text-blue-600" />
      case 'pattern': return <Sparkles className="h-6 w-6 text-purple-600" />
      case 'collision': return <AlertCircle className="h-6 w-6 text-amber-600" />
      case 'opportunity': return <Lightbulb className="h-6 w-6 text-green-600" />
      default: return <Sparkles className="h-6 w-6 text-neutral-600" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'evolution': return 'from-blue-50 to-indigo-50 border-blue-200'
      case 'pattern': return 'from-purple-50 to-pink-50 border-purple-200'
      case 'collision': return 'from-amber-50 to-yellow-50 border-amber-200'
      case 'opportunity': return 'from-green-50 to-emerald-50 border-green-200'
      default: return 'from-neutral-50 to-gray-50 border-neutral-200'
    }
  }

  const handleRefresh = async () => {
    await fetchInsights()
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-900 border-r-transparent mb-4"></div>
            <p className="text-lg text-neutral-600">Synthesizing insights...</p>
          </div>
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-5xl mx-auto px-4">
          <Card className="pro-card">
            <CardContent className="py-16 text-center">
              <Sparkles className="h-16 w-16 text-blue-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                Building Your Insights
              </h2>
              <p className="text-neutral-600 mb-6">
                Capture at least 10 thoughts to see evolution patterns and synthesis insights
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} className="min-h-screen">
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
          <h1 className="text-4xl font-bold text-neutral-900 mb-3">
            Your Synthesis Insights
          </h1>
          <p className="text-xl text-neutral-600">
            How your thinking evolved and patterns emerged
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 space-y-6">
        {insights.map((insight, index) => (
          <Card key={index} className={`pro-card border-2 bg-gradient-to-r ${getInsightColor(insight.type)}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {getInsightIcon(insight.type)}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">
                    {insight.title}
                  </h3>
                  <p className="text-neutral-700 mb-4">
                    {insight.description}
                  </p>

                  {/* Evolution Timeline */}
                  {insight.type === 'evolution' && insight.data?.timeline && (
                    <div className="mb-4 space-y-3">
                      {insight.data.timeline.map((event: any, i: number) => (
                        <div key={i} className="pl-4 border-l-2 border-blue-300">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-24 text-sm text-neutral-600">
                              {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-neutral-900 mb-1">
                                {event.stance}
                              </p>
                              <p className="text-sm text-neutral-600 italic">
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
                    <div className="p-4 bg-white/80 rounded-lg">
                      <p className="text-sm font-medium text-neutral-900 mb-2">
                        💡 Recommendation:
                      </p>
                      <p className="text-sm text-neutral-700">
                        {insight.data.recommendation}
                      </p>
                    </div>
                  )}

                  {/* Collision Details */}
                  {insight.type === 'collision' && insight.data?.timeline && (
                    <div className="space-y-2">
                      {insight.data.timeline.map((event: any, i: number) => (
                        <div key={i} className="p-3 bg-white/80 rounded-lg">
                          <div className="flex items-start gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              i === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {event.stance}
                            </span>
                            <span className="text-xs text-neutral-600">
                              {new Date(event.date).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-700 italic">
                            "{event.quote}"
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Button */}
                  {insight.actionable && insight.action && (
                    <div className="mt-4 pt-4 border-t border-neutral-200">
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
        <Card className="border-2 border-neutral-200 bg-neutral-50">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">
              Understanding Your Journey
            </h3>
            <p className="text-neutral-700">
              These insights show how your thinking evolves over time. Contradictions aren't failures—they're
              signs of growth. Patterns help you understand your creative process and break unproductive cycles.
            </p>
          </CardContent>
        </Card>
      </div>
      </motion.div>
    </PullToRefresh>
  )
}
