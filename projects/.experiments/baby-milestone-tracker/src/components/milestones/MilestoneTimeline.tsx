import React, { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface Milestone {
  id: string
  milestone_name: string
  domain: string
  detected_at: string
  evidence: string
  memory_title: string
  child_age_months: number | null
  confidence: number
}

interface Insights {
  total_milestones: number
  domains_active: string[]
  progression_velocity: 'slower' | 'typical' | 'faster'
  next_expected_milestones: string[]
}

interface RecentInsight {
  id: string
  insight_type: string
  title: string
  description: string
  confidence: number
  generated_at: string
}

const DOMAIN_COLORS: Record<string, string> = {
  motor_gross: 'bg-blue-100 text-blue-800',
  motor_fine: 'bg-purple-100 text-purple-800',
  language: 'bg-green-100 text-green-800',
  cognitive: 'bg-yellow-100 text-yellow-800',
  social_emotional: 'bg-pink-100 text-pink-800',
  self_care: 'bg-orange-100 text-orange-800'
}

const DOMAIN_ICONS: Record<string, string> = {
  motor_gross: '🏃',
  motor_fine: '✋',
  language: '💬',
  cognitive: '🧠',
  social_emotional: '❤️',
  self_care: '🍽️'
}

const DOMAIN_LABELS: Record<string, string> = {
  motor_gross: 'Gross Motor',
  motor_fine: 'Fine Motor',
  language: 'Language',
  cognitive: 'Cognitive',
  social_emotional: 'Social-Emotional',
  self_care: 'Self-Care'
}

export function MilestoneTimeline({ userId }: { userId: string }) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [recentInsights, setRecentInsights] = useState<RecentInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  useEffect(() => {
    fetchMilestones()
  }, [userId, selectedDomain])

  const fetchMilestones = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ user_id: userId })
      if (selectedDomain) {
        params.append('domain', selectedDomain)
      }

      const response = await fetch(`/api/milestones?${params}`)
      if (!response.ok) throw new Error('Failed to fetch milestones')

      const data = await response.json()
      setMilestones(data.milestones)
      setInsights(data.insights)
      setRecentInsights(data.recent_insights)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateInsights = async () => {
    try {
      const response = await fetch('/api/milestones/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })

      if (!response.ok) throw new Error('Failed to generate insights')

      await fetchMilestones() // Refresh to get new insights
    } catch (err) {
      console.error('Error generating insights:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading milestones...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">Error: {error}</p>
      </div>
    )
  }

  if (milestones.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600 mb-4">
          No milestones detected yet. Start capturing voice notes about your child's development!
        </p>
        <p className="text-sm text-gray-500">
          Examples: "She rolled over today!", "Said his first word!", "Walking without holding on!"
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Insights Summary */}
      {insights && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            ✨ Development Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-purple-600">
                {insights.total_milestones}
              </div>
              <div className="text-sm text-gray-600">Total Milestones</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-600">
                {insights.domains_active.length}
              </div>
              <div className="text-sm text-gray-600">Active Domains</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {insights.progression_velocity === 'faster' && '🚀 Fast'}
                {insights.progression_velocity === 'typical' && '✅ Typical'}
                {insights.progression_velocity === 'slower' && '🐢 Steady'}
              </div>
              <div className="text-sm text-gray-600">Progression</div>
            </div>
            <div>
              <button
                onClick={generateInsights}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                Generate Insights
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent AI Insights */}
      {recentInsights.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900">🎯 Recent Insights</h3>
          {recentInsights.map(insight => (
            <div
              key={insight.id}
              className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="capitalize">{insight.insight_type}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(insight.generated_at))} ago</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Domain Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedDomain(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !selectedDomain
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Domains
        </button>
        {Object.entries(DOMAIN_LABELS).map(([domain, label]) => (
          <button
            key={domain}
            onClick={() => setSelectedDomain(domain)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedDomain === domain
                ? DOMAIN_COLORS[domain]
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {DOMAIN_ICONS[domain]} {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          📅 Milestone Timeline ({milestones.length})
        </h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />

          {/* Milestone cards */}
          <div className="space-y-6">
            {milestones.map(milestone => (
              <div key={milestone.id} className="relative pl-14">
                {/* Timeline dot */}
                <div
                  className={`absolute left-4 top-3 w-4 h-4 rounded-full border-2 border-white ${
                    DOMAIN_COLORS[milestone.domain]?.replace('100', '500')
                  }`}
                />

                {/* Milestone card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{DOMAIN_ICONS[milestone.domain]}</span>
                      <h4 className="font-semibold text-gray-900">
                        {milestone.milestone_name}
                      </h4>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        DOMAIN_COLORS[milestone.domain]
                      }`}
                    >
                      {DOMAIN_LABELS[milestone.domain]}
                    </span>
                  </div>

                  <blockquote className="italic text-gray-600 border-l-4 border-gray-200 pl-3 mb-3">
                    "{milestone.evidence}"
                  </blockquote>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>📝 {milestone.memory_title}</span>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(milestone.detected_at))} ago</span>
                    {milestone.child_age_months && (
                      <>
                        <span>•</span>
                        <span>{milestone.child_age_months} months old</span>
                      </>
                    )}
                  </div>

                  {milestone.confidence < 0.7 && (
                    <div className="mt-2 text-xs text-amber-600">
                      ⚠️ Low confidence detection ({(milestone.confidence * 100).toFixed(0)}%)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
