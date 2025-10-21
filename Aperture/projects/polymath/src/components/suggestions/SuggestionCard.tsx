/**
 * SuggestionCard Component - Stunning Visual Design
 */

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Sparkles, ThumbsDown, Hammer, MoreHorizontal, Lightbulb, Loader2 } from 'lucide-react'
import type { SuggestionCardProps } from '../../types'

export function SuggestionCard({
  suggestion,
  onRate,
  onBuild,
  onViewDetail,
  compact = false
}: SuggestionCardProps) {
  const [loadingAction, setLoadingAction] = useState<'spark' | 'meh' | 'build' | null>(null)

  const handleSpark = async () => {
    setLoadingAction('spark')
    try {
      await onRate(suggestion.id, 1)
    } finally {
      setLoadingAction(null)
    }
  }

  const handleMeh = async () => {
    setLoadingAction('meh')
    try {
      await onRate(suggestion.id, -1)
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
      className={`group h-full flex flex-col pro-card transition-smooth hover-lift cursor-pointer ${
        suggestion.is_wildcard
          ? 'bg-orange-50/40'
          : ''
      }`}
      onClick={handleMore}
    >
      {/* Subtle accent bar */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-40" />

      {/* Wildcard indicator */}
      {suggestion.is_wildcard && (
        <div className="absolute top-4 right-4">
          <Sparkles className="h-5 w-5 text-orange-600" />
        </div>
      )}

      <CardHeader className="relative" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-4 py-1.5 rounded-md bg-orange-100 text-orange-700 text-sm font-semibold border border-orange-200 flex items-center gap-1">
              <Lightbulb className="h-4 w-4" />
              {suggestion.total_points}pts
            </div>
            {suggestion.is_wildcard && (
              <div className="px-3 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-medium border border-orange-200">
                Wildcard
              </div>
            )}
            {isCreative && !suggestion.is_wildcard && (
              <div className="px-3 py-1 rounded-md bg-orange-100 text-orange-700 text-xs font-medium border border-orange-200">
                Creative
              </div>
            )}
          </div>
        </div>

        <CardTitle className="text-xl font-semibold leading-tight text-neutral-900 mb-2">
          {suggestion.title}
        </CardTitle>
        {!compact && (
          <CardDescription className="text-base leading-relaxed text-neutral-700">
            {suggestion.description}
          </CardDescription>
        )}
      </CardHeader>

      {!compact && (
        <CardContent className="flex-1 space-y-4">
          {suggestion.capability_ids.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Uses:</p>
              <div className="flex flex-wrap gap-2">
                {suggestion.capability_ids.slice(0, 3).map((capId) => (
                  <span
                    key={capId}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full text-xs font-semibold border border-blue-200/50 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {formatCapabilityName(capId)}
                  </span>
                ))}
                {suggestion.capability_ids.length > 3 && (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full text-xs font-semibold border border-purple-200/50 shadow-sm">
                    +{suggestion.capability_ids.length - 3} more
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

      <CardFooter className="flex gap-2 border-t border-neutral-200 pt-4" onClick={(e) => e.stopPropagation()}>
        <Button
          onClick={handleSpark}
          variant="outline"
          size="sm"
          className="flex-1 btn-secondary h-11"
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
          onClick={handleMeh}
          variant="outline"
          size="sm"
          className="flex-1 btn-secondary h-11"
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
    </Card>
  )
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const percentage = Math.round(score * 100)
  const gradient = score > 0.7
    ? 'from-green-500 to-emerald-600'
    : score > 0.4
      ? 'from-yellow-500 to-amber-600'
      : 'from-red-500 to-rose-600'

  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gradient-to-br from-white/80 to-gray-50/80 border border-white/40 shadow-inner hover:shadow-lg transition-shadow">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${gradient} text-white text-sm font-bold shadow-md`}>
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
