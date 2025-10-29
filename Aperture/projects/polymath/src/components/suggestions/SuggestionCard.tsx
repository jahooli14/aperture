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
