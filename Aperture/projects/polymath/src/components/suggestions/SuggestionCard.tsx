/**
 * SuggestionCard Component - Stunning Visual Design
 */

import React, { useState, memo } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Sparkles, ThumbsDown, Hammer, MoreHorizontal, Lightbulb, Loader2, X } from 'lucide-react'
import type { SuggestionCardProps } from '../../types'

type FeedbackReason = 'too_hard' | 'not_interesting' | 'not_relevant' | 'too_time_consuming' | 'missing_skills' | 'other'

export const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onRate,
  onBuild,
  onViewDetail,
  compact = false
}: SuggestionCardProps) {
  const [loadingAction, setLoadingAction] = useState<'spark' | 'meh' | 'build' | null>(null)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)

  const handleSpark = async () => {
    setLoadingAction('spark')
    try {
      await onRate(suggestion.id, 1)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleMehClick = () => {
    setShowFeedbackDialog(true)
  }

  const handleMehWithFeedback = async (reason: FeedbackReason) => {
    setLoadingAction('meh')
    try {
      // Send feedback along with the rating
      await fetch(`/api/suggestions/${suggestion.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })
      await onRate(suggestion.id, -1)
      setShowFeedbackDialog(false)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleBuild = async () => {
    setLoadingAction('build')
    try {
      await onBuild(suggestion.id)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleMore = () => onViewDetail(suggestion.id)

  const isCreative = suggestion.capability_ids.length === 0

  return (
    <Card
      className={`group h-full flex flex-col premium-card transition-smooth hover-lift cursor-pointer`}
      onClick={handleMore}
    >
      {/* Subtle accent bar */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-40" />

      {/* Wildcard indicator */}
      {suggestion.is_wildcard && (
        <div className="absolute top-4 right-4">
          <Sparkles className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
        </div>
      )}

      <CardHeader className="relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="px-4 py-1.5 rounded-md text-sm font-semibold flex items-center gap-1"
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                color: 'var(--premium-blue)',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              <Lightbulb className="h-4 w-4" />
              {suggestion.total_points}pts
            </div>
            {suggestion.is_wildcard && (
              <div
                className="px-3 py-1 rounded-md text-xs font-medium"
                style={{
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: 'var(--premium-blue)',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                Wildcard
              </div>
            )}
            {isCreative && !suggestion.is_wildcard && (
              <div
                className="px-3 py-1 rounded-md text-xs font-medium"
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  color: 'var(--premium-indigo)',
                  border: '1px solid rgba(139, 92, 246, 0.3)'
                }}
              >
                Creative
              </div>
            )}
          </div>
        </div>

        <CardTitle
          className="text-xl font-semibold leading-tight premium-text-platinum mb-2"
          style={{ fontSize: 'var(--premium-text-h3)' }}
        >
          {suggestion.title}
        </CardTitle>
        {!compact && (
          <CardDescription
            className="text-base leading-relaxed"
            style={{ color: 'var(--premium-text-secondary)' }}
          >
            {suggestion.description}
          </CardDescription>
        )}
      </CardHeader>

      {!compact && (
        <CardContent className="flex-1 space-y-4">
          {suggestion.capabilities && suggestion.capabilities.length > 0 && (
            <div className="space-y-2">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--premium-text-tertiary)' }}
              >
                Uses:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestion.capabilities.slice(0, 3).map((cap) => (
                  <span
                    key={cap.id}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm hover:shadow-md transition-shadow"
                    style={{
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
                      color: 'var(--premium-blue)',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    {cap.name}
                  </span>
                ))}
                {suggestion.capabilities.length > 3 && (
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(236, 72, 153, 0.2))',
                      color: 'var(--premium-indigo)',
                      border: '1px solid rgba(139, 92, 246, 0.3)'
                    }}
                  >
                    +{suggestion.capabilities.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <ScorePill label="Fresh" score={suggestion.novelty_score} />
            <ScorePill label="Doable" score={suggestion.feasibility_score} />
            <ScorePill label="Exciting" score={suggestion.interest_score} />
          </div>
        </CardContent>
      )}

      <CardFooter
        className="flex gap-2 border-t pt-4"
        style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          onClick={handleSpark}
          variant="outline"
          size="sm"
          className="flex-1 h-11"
          style={{
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15))',
            border: '1.5px solid rgba(251, 191, 36, 0.4)',
            color: '#fbbf24'
          }}
          title="This sparks my interest!"
          disabled={loadingAction !== null}
        >
          {loadingAction === 'spark' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-1" />
          )}
          Spark
        </Button>
        <Button
          onClick={handleMehClick}
          variant="outline"
          size="sm"
          className="flex-1 h-11"
          style={{
            background: 'rgba(107, 114, 128, 0.15)',
            border: '1.5px solid rgba(156, 163, 175, 0.3)',
            color: '#9ca3af'
          }}
          title="Not interested"
          disabled={loadingAction !== null}
        >
          {loadingAction === 'meh' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <ThumbsDown className="h-4 w-4 mr-1" />
          )}
          Meh
        </Button>
        <Button
          onClick={handleBuild}
          size="sm"
          className="flex-1 btn-primary h-11"
          title="Build this project!"
          disabled={loadingAction !== null}
        >
          {loadingAction === 'build' ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Hammer className="h-4 w-4 mr-1" />
          )}
          Build
        </Button>
      </CardFooter>

      {/* Feedback Dialog */}
      {showFeedbackDialog && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowFeedbackDialog(false)}
        >
          <div
            className="premium-card p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="premium-text-platinum font-bold text-lg">
                Why not interested?
              </h3>
              <button
                onClick={() => setShowFeedbackDialog(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
              </button>
            </div>

            <p className="text-sm mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
              Your feedback helps improve future suggestions
            </p>

            <div className="space-y-3">
              {[
                { reason: 'too_hard' as FeedbackReason, label: 'Too difficult or complex' },
                { reason: 'not_interesting' as FeedbackReason, label: 'Not interesting to me' },
                { reason: 'not_relevant' as FeedbackReason, label: 'Not relevant to my goals' },
                { reason: 'too_time_consuming' as FeedbackReason, label: 'Takes too much time' },
                { reason: 'missing_skills' as FeedbackReason, label: 'Missing required skills' },
                { reason: 'other' as FeedbackReason, label: 'Other reason' }
              ].map(({ reason, label }) => (
                <button
                  key={reason}
                  onClick={() => handleMehWithFeedback(reason)}
                  disabled={loadingAction !== null}
                  className="w-full p-4 rounded-lg text-left transition-all premium-glass-subtle hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="premium-text-platinum font-medium">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowFeedbackDialog(false)}
              className="w-full mt-6 p-3 rounded-lg text-sm font-medium transition-all"
              style={{
                color: 'var(--premium-text-secondary)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  )
})

function ScorePill({ label, score }: { label: string; score: number }) {
  const percentage = Math.round(score * 100)
  const gradient = score > 0.7
    ? 'linear-gradient(135deg, #10b981, #059669)'
    : score > 0.4
      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
      : 'linear-gradient(135deg, #ef4444, #dc2626)'

  return (
    <div
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl shadow-inner hover:shadow-lg transition-shadow"
      style={{
        background: 'rgba(26, 35, 50, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.06)'
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--premium-text-tertiary)' }}
      >
        {label}
      </span>
      <div
        className="px-3 py-1 rounded-full text-white text-sm font-bold shadow-md"
        style={{ background: gradient }}
      >
        {percentage}%
      </div>
    </div>
  )
}

function formatCapabilityName(capId: string): string {
  return capId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
