/**
 * Cognitive Timeline Page
 * Visualizes WHEN and HOW users think best
 * Shows thinking patterns, velocity, side-hustle hours
 */

import { useEffect, useState } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Clock, TrendingUp, Calendar, Zap } from 'lucide-react'
import type { CognitivePattern, TimelinePattern } from '../types'

export function TimelinePage() {
  const [patterns, setPatterns] = useState<CognitivePattern[]>([])
  const [timeline, setTimeline] = useState<TimelinePattern | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPatterns()
  }, [])

  const fetchPatterns = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/timeline/patterns')
      if (!response.ok) throw new Error('Failed to fetch patterns')
      const data = await response.json()
      setPatterns(data.patterns || [])
      setTimeline(data.timeline || null)
    } catch (error) {
      console.error('Error fetching patterns:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-orange-600 border-r-transparent mb-4"></div>
            <p className="text-lg text-neutral-600">Analyzing your patterns...</p>
          </div>
        </div>
      </div>
    )
  }

  if (patterns.length === 0) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-6xl mx-auto px-4">
          <Card className="pro-card">
            <CardContent className="py-16 text-center">
              <Clock className="h-16 w-16 text-orange-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-neutral-900 mb-2">
                Not Enough Data Yet
              </h2>
              <p className="text-neutral-600">
                Capture at least 5 memories to see your cognitive patterns
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-neutral-900 mb-3">
            Your Cognitive Timeline
          </h1>
          <p className="text-xl text-neutral-600">
            Understanding when and how you think best
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Pattern Cards */}
        {patterns.map((pattern, index) => (
          <Card key={index} className="pro-card border-2 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {pattern.type === 'thinking_time' && <Clock className="h-8 w-8 text-orange-600" />}
                  {pattern.type === 'velocity' && <TrendingUp className="h-8 w-8 text-blue-600" />}
                  {pattern.type === 'side_hustle_hours' && <Zap className="h-8 w-8 text-purple-600" />}
                  {pattern.type === 'emotional_continuity' && <Calendar className="h-8 w-8 text-green-600" />}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-neutral-900 mb-2">
                    {pattern.title}
                  </h3>
                  <p className="text-neutral-700 mb-4">
                    {pattern.description}
                  </p>
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-neutral-900">
                      💡 {pattern.insight}
                    </p>
                  </div>

                  {/* Data Visualization */}
                  {pattern.type === 'thinking_time' && pattern.data && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-neutral-700 mb-3">
                        Your top thinking times:
                      </p>
                      <div className="space-y-2">
                        {pattern.data.slice(0, 5).map((time: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="flex-1 bg-neutral-100 rounded-full h-8 relative overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                                style={{ width: `${(time.count / pattern.data[0].count) * 100}%` }}
                              />
                              <div className="relative px-3 py-1 flex items-center justify-between">
                                <span className="text-sm font-medium text-neutral-900">
                                  {time.day} {time.hour === 0 ? '12am' : time.hour < 12 ? time.hour + 'am' : (time.hour === 12 ? '12pm' : (time.hour - 12) + 'pm')}
                                </span>
                                <span className="text-sm font-bold text-neutral-900">
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
                      <p className="text-sm font-medium text-neutral-700 mb-3">
                        Captures per week:
                      </p>
                      <div className="flex items-end gap-2 h-32">
                        {pattern.data.slice(-8).map((week: any, i: number) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="flex-1 w-full relative">
                              <div
                                className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t"
                                style={{ height: `${(week.count / Math.max(...pattern.data.map((w: any) => w.count))) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-600">
                              {new Date(week.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pattern.type === 'side_hustle_hours' && pattern.data && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-neutral-700 mb-3">
                        Side-project hours per month:
                      </p>
                      <div className="space-y-2">
                        {pattern.data.map((month: any, i: number) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm font-medium text-neutral-700 w-24">
                              {new Date(month.month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                            <div className="flex-1 bg-neutral-100 rounded-full h-8 relative overflow-hidden">
                              <div
                                className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                                style={{ width: `${Math.min((month.hours / 40) * 100, 100)}%` }}
                              />
                              <div className="relative px-3 py-1 flex items-center justify-end">
                                <span className="text-sm font-bold text-neutral-900">
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
        <Card className="border-2 border-neutral-200 bg-neutral-50">
          <CardContent className="pt-6">
            <h3 className="text-lg font-bold text-neutral-900 mb-3">
              What This Means
            </h3>
            <p className="text-neutral-700">
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
