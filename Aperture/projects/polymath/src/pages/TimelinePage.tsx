/**
 * Cognitive Timeline Page
 * Visualizes WHEN and HOW users think best
 * Shows thinking patterns, velocity, side-hustle hours
 */

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Clock, TrendingUp, Calendar, Zap } from 'lucide-react'
import type { CognitivePattern, TimelinePattern } from '../types'

export function TimelinePage() {
  const [patterns, setPatterns] = useState<CognitivePattern[]>([])
  const [timeline, setTimeline] = useState<TimelinePattern | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPatterns = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics?resource=patterns')
      if (!response.ok) throw new Error('Failed to fetch patterns')
      const data = await response.json()
      setPatterns(data.patterns || [])
      setTimeline(data.timeline || null)
    } catch (error) {
      console.error('Error fetching patterns:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPatterns()
  }, [fetchPatterns])

  if (loading) {
    return (
      <div className="min-h-screen py-12" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-r-transparent mb-4" style={{ borderColor: 'var(--premium-blue)' }}></div>
            <p className="text-lg" style={{ color: 'var(--premium-text-secondary)' }}>Analyzing your patterns...</p>
          </div>
        </div>
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="min-h-screen py-12" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <Card className="premium-card">
            <CardContent className="py-16 text-center">
              <Clock className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--premium-blue)' }} />
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                Not Enough Data Yet
              </h2>
              <p style={{ color: 'var(--premium-text-secondary)' }}>
                Capture at least 5 memories to see your cognitive patterns
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12" style={{ backgroundColor: 'var(--premium-surface-base)' }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
            Your Cognitive Timeline
          </h1>
          <p className="text-xl" style={{ color: 'var(--premium-text-secondary)' }}>
            Understanding when and how you think best
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Pattern Cards */}
        {patterns.map((pattern, index) => (
          <Card key={index} className="premium-card border-2" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {pattern.type === 'thinking_time' && <Clock className="h-8 w-8" style={{ color: 'var(--premium-blue)' }} />}
                  {pattern.type === 'velocity' && <TrendingUp className="h-8 w-8" style={{ color: 'var(--premium-blue)' }} />}
                  {pattern.type === 'side_hustle_hours' && <Zap className="h-8 w-8" style={{ color: 'var(--premium-indigo)' }} />}
                  {pattern.type === 'emotional_continuity' && <Calendar className="h-8 w-8" style={{ color: 'var(--premium-emerald)' }} />}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                    {pattern.title}
                  </h3>
                  <p className="mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                    {pattern.description}
                  </p>
                  <div className="p-4 rounded-lg border premium-glass-subtle" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                    <p className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                      💡 {pattern.insight}
                    </p>
                  </div>

                  {/* Data Visualization */}
                  {pattern.type === 'thinking_time' && pattern.data && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                        Your top thinking times:
                      </p>
                      <div className="space-y-2">
                        {pattern.data.slice(0, 5).map((time: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="flex-1 rounded-full h-8 relative overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                              <div
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{
                                  width: `${(time.count / pattern.data[0].count) * 100}%`,
                                  background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-amber))'
                                }}
                              />
                              <div className="relative px-3 py-1 flex items-center justify-between">
                                <span className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
                                  {time.day} {time.hour === 0 ? '12am' : time.hour < 12 ? time.hour + 'am' : (time.hour === 12 ? '12pm' : (time.hour - 12) + 'pm')}
                                </span>
                                <span className="text-sm font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                                  {time.count}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pattern.type === 'velocity' && pattern.data && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                        Captures per week:
                      </p>
                      <div className="flex items-end gap-2 h-32">
                        {pattern.data.slice(-8).map((week: any, i: number) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="flex-1 w-full relative">
                              <div
                                className="absolute bottom-0 left-0 right-0 rounded-t"
                                style={{
                                  height: `${(week.count / Math.max(...pattern.data.map((w: any) => w.count))) * 100}%`,
                                  background: 'linear-gradient(to top, var(--premium-blue), rgba(59, 130, 246, 0.5))'
                                }}
                              />
                            </div>
                            <span className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
                              {new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pattern.type === 'side_hustle_hours' && pattern.data && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                        Side-project hours per month:
                      </p>
                      <div className="space-y-2">
                        {pattern.data.map((month: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm font-medium w-24" style={{ color: 'var(--premium-text-secondary)' }}>
                              {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                            <div className="flex-1 rounded-full h-8 relative overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                              <div
                                className="absolute inset-y-0 left-0 rounded-full"
                                style={{
                                  width: `${Math.min((month.hours / 40) * 100, 100)}%`,
                                  background: 'linear-gradient(90deg, var(--premium-indigo), var(--premium-pink))'
                                }}
                              />
                              <div className="relative px-3 py-1 flex items-center justify-end">
                                <span className="text-sm font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                                  {month.hours}h
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Summary Card */}
        <Card className="premium-card border-2" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              What This Means
            </h3>
            <p style={{ color: 'var(--premium-text-secondary)' }}>
              Your cognitive patterns reveal when you're most creative and productive.
              Use this data to schedule important work during your peak times and
              protect your side-hustle hours.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
