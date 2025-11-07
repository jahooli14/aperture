/**
 * SuggestionCard Component - Polished Design matching Daily Queue
 */

import React, { useState, memo } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Sparkles, ThumbsDown, Hammer, MoreHorizontal, Lightbulb, Loader2, X, Star } from 'lucide-react'
import type { SuggestionCardProps } from '../../types'

type InterestRating = 1 | 2 | 3
type FeedbackReason = 'not_aligned' | 'too_complex' | 'no_time' | 'missing_resources' | 'will_revisit' | 'other'
type InterestFeedback = 'perfect_fit' | 'good_timing' | 'fills_gap' | 'exciting_challenge' | 'growth_opportunity' | 'other'

export const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onRate,
  onBuild,
  onViewDetail
}: SuggestionCardProps) {
  const [loadingAction, setLoadingAction] = useState<'rate' | 'build' | null>(null)
  const [showRatingDialog, setShowRatingDialog] = useState(false)
  const [selectedRating, setSelectedRating] = useState<InterestRating | null>(null)
  const [exitX, setExitX] = useState(0)

  const handleRateClick = (rating: InterestRating) => {
    setSelectedRating(rating)
    setShowRatingDialog(true)
  }

  const handleRateWithFeedback = async (reason: FeedbackReason | InterestFeedback) => {
    if (!selectedRating) return

    setLoadingAction('rate')
    try {
      // Map 1-3 scale to backend (-1, 1, 2)
      // 1 (not interested) → -1 (meh)
      // 2 (somewhat) → 1 (spark)
      // 3 (very interested) → 2 (would build)
      const backendRating = selectedRating === 1 ? -1 : selectedRating === 2 ? 1 : 2

      await fetch(`/api/projects?resource=suggestions&action=rate&id=${suggestion.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: backendRating, feedback: reason, interest_level: selectedRating })
      })

      await onRate(suggestion.id, backendRating as -1 | 1 | 2)
      setShowRatingDialog(false)
      setSelectedRating(null)
    } catch (error) {
      console.error('Failed to submit rating:', error)
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

  // Get rating label and color
  const getRatingConfig = (rating: InterestRating) => {
    const configs = {
      1: { label: 'Not Interested', color: 'from-gray-500 to-gray-600', emoji: '👎' },
      2: { label: 'Somewhat Interesting', color: 'from-amber-500 to-orange-500', emoji: '🤔' },
      3: { label: 'Very Interesting', color: 'from-emerald-500 to-blue-500', emoji: '⭐' }
    }
    return configs[rating]
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={exitX !== 0 ? { x: exitX, opacity: 0 } : { opacity: 1, scale: 1 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 28,
        mass: 0.6,
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 }
      }}
      className="relative"
    >
      <Card
        className={`group h-full flex flex-col premium-card transition-smooth hover-lift cursor-pointer relative overflow-hidden`}
        onClick={handleMore}
        style={{
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.25)'
        }}
      >
      {/* Ambient glow effect - enhanced */}
      <div
        className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500"
        style={{
          background: 'radial-gradient(circle at 30% 30%, rgba(59, 130, 246, 0.4), transparent 60%)',
          pointerEvents: 'none'
        }}
      />

      {/* Subtle accent bar */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-40" />

      <CardHeader className="relative z-10" onClick={(e) => e.stopPropagation()}>
        {/* Type badges */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), #2563eb)',
                color: '#ffffff'
              }}>
              <Lightbulb className="h-4 w-4" />
              {suggestion.total_points}pts
            </span>
          </div>
        </div>

        <CardTitle
          className="text-2xl font-bold leading-tight premium-text-platinum mb-3"
        >
          {suggestion.title}
        </CardTitle>

        <CardDescription
          className="text-base leading-relaxed mb-4"
          style={{ color: 'var(--premium-text-secondary)' }}
        >
          {suggestion.description}
        </CardDescription>

        {/* Why this suggestion box - matches daily queue style */}
        {suggestion.synthesis_reasoning && (
          <div className="mb-4 p-4 premium-glass-subtle rounded-lg border" style={{ borderColor: 'var(--premium-blue)' }}>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--premium-text-primary)' }}>
              Why this suggestion:
            </p>
            <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
              {suggestion.synthesis_reasoning}
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4 relative z-10">
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
                  className="px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: 'var(--premium-blue)',
                    border: '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  {cap.name}
                </span>
              ))}
              {suggestion.capabilities.length > 3 && (
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: 'var(--premium-blue)',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
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

      <CardFooter
        className="flex gap-2 border-t pt-4 relative z-10"
        style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rate 1-3 buttons - simplified colors */}
        <Button
          onClick={() => handleRateClick(1)}
          variant="outline"
          size="sm"
          className="flex-1 h-11"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1.5px solid rgba(255, 255, 255, 0.1)',
            color: 'var(--premium-text-secondary)'
          }}
          title="Not interested"
          disabled={loadingAction !== null}
        >
          1
        </Button>
        <Button
          onClick={() => handleRateClick(2)}
          variant="outline"
          size="sm"
          className="flex-1 h-11"
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1.5px solid rgba(59, 130, 246, 0.3)',
            color: 'var(--premium-blue)'
          }}
          title="Somewhat interesting"
          disabled={loadingAction !== null}
        >
          2
        </Button>
        <Button
          onClick={() => handleRateClick(3)}
          variant="outline"
          size="sm"
          className="flex-1 h-11"
          style={{
            background: 'rgba(59, 130, 246, 0.2)',
            border: '1.5px solid rgba(59, 130, 246, 0.4)',
            color: 'var(--premium-blue)'
          }}
          title="Very interesting"
          disabled={loadingAction !== null}
        >
          3
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

      {/* Rating Feedback Dialog */}
      {showRatingDialog && selectedRating && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowRatingDialog(false)}
        >
          <div
            className="premium-card p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="premium-text-platinum font-bold text-lg flex items-center gap-2">
                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${getRatingConfig(selectedRating).color}`}>
                  {getRatingConfig(selectedRating).emoji} {getRatingConfig(selectedRating).label}
                </span>
              </h3>
              <button
                onClick={() => setShowRatingDialog(false)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
              </button>
            </div>

            <p className="text-sm mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
              {selectedRating === 3 && "Great! What excites you about this?"}
              {selectedRating === 2 && "Interesting but not quite right? Tell us why"}
              {selectedRating === 1 && "Why isn't this a good fit?"}
            </p>

            <div className="space-y-3">
              {selectedRating === 3 && [
                { reason: 'perfect_fit' as InterestFeedback, label: 'Perfect fit for my goals' },
                { reason: 'good_timing' as InterestFeedback, label: 'Great timing for this' },
                { reason: 'fills_gap' as InterestFeedback, label: 'Fills a gap I have' },
                { reason: 'exciting_challenge' as InterestFeedback, label: 'Exciting challenge' },
                { reason: 'growth_opportunity' as InterestFeedback, label: 'Good growth opportunity' },
                { reason: 'other' as InterestFeedback, label: 'Other reason' }
              ].map(({ reason, label }) => (
                <button
                  key={reason}
                  onClick={() => handleRateWithFeedback(reason)}
                  disabled={loadingAction !== null}
                  className="w-full p-4 rounded-lg text-left transition-all premium-glass-subtle hover:bg-white/10 disabled:opacity-50"
                >
                  <span className="premium-text-platinum font-medium">
                    {label}
                  </span>
                </button>
              ))}

              {(selectedRating === 2 || selectedRating === 1) && [
                { reason: 'not_aligned' as FeedbackReason, label: 'Not aligned with my goals' },
                { reason: 'too_complex' as FeedbackReason, label: 'Too complex or difficult' },
                { reason: 'no_time' as FeedbackReason, label: 'Don\'t have time right now' },
                { reason: 'missing_resources' as FeedbackReason, label: 'Missing skills or resources' },
                { reason: 'will_revisit' as FeedbackReason, label: 'Maybe later, will revisit' },
                { reason: 'other' as FeedbackReason, label: 'Other reason' }
              ].map(({ reason, label }) => (
                <button
                  key={reason}
                  onClick={() => handleRateWithFeedback(reason)}
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
              onClick={() => setShowRatingDialog(false)}
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
    </motion.div>
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
