/**
 * SuggestionCard Component - Stunning Visual Design
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Sparkles, ThumbsDown, Hammer, MoreHorizontal, Lightbulb } from 'lucide-react'
import type { SuggestionCardProps } from '../../types'

export function SuggestionCard({
  suggestion,
  onRate,
  onBuild,
  onViewDetail,
  compact = false
}: SuggestionCardProps) {
  const handleSpark = () => onRate(suggestion.id, 1)
  const handleMeh = () => onRate(suggestion.id, -1)
  const handleBuild = () => onBuild(suggestion.id)
  const handleMore = () => onViewDetail(suggestion.id)

  const isCreative = suggestion.capability_ids.length === 0

  return (
    <Card className={`group h-full flex flex-col relative overflow-hidden backdrop-blur-xl border-white/20 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 glow-hover ${
      suggestion.is_wildcard
        ? 'bg-gradient-to-br from-yellow-50/90 via-orange-50/80 to-pink-50/90 border-yellow-300/50'
        : 'bg-white/80'
    }`}>
      {/* Animated gradient border on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br ${
        isCreative
          ? 'from-purple-500 via-pink-500 to-rose-500'
          : 'from-blue-500 via-cyan-500 to-teal-500'
      } opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />

      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${
        suggestion.is_wildcard
          ? 'from-yellow-400 via-orange-500 to-pink-500'
          : isCreative
            ? 'from-purple-500 via-pink-500 to-rose-500'
            : 'from-blue-500 via-cyan-500 to-teal-500'
      } shadow-lg`} />

      {/* Wildcard sparkle effect */}
      {suggestion.is_wildcard && (
        <div className="absolute top-4 right-4 float-animation">
          <Sparkles className="h-6 w-6 text-yellow-500 drop-shadow-lg" />
        </div>
      )}

      <CardHeader className="relative">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-lg flex items-center gap-1">
              <Lightbulb className="h-4 w-4" />
              {suggestion.total_points}pts
            </div>
            {suggestion.is_wildcard && (
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500 via-orange-500 to-pink-500 text-white text-xs font-bold shadow-lg animate-pulse">
                🎲 Wildcard
              </div>
            )}
            {isCreative && !suggestion.is_wildcard && (
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold shadow-lg">
                🎨 Creative
              </div>
            )}
          </div>
        </div>

        <CardTitle className="text-xl font-bold leading-tight group-hover:gradient-text transition-all duration-300">
          {suggestion.title}
        </CardTitle>
        <CardDescription className={`${compact ? 'line-clamp-2' : 'line-clamp-3'} text-base leading-relaxed`}>
          {suggestion.description}
        </CardDescription>
      </CardHeader>

      {!compact && (
        <CardContent className="flex-1 space-y-4">
          {suggestion.capability_ids.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Combines:</p>
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
            <ScorePill label="Novelty" score={suggestion.novelty_score} />
            <ScorePill label="Feasible" score={suggestion.feasibility_score} />
            <ScorePill label="Interest" score={suggestion.interest_score} />
          </div>
        </CardContent>
      )}

      <CardFooter className="flex gap-2 border-t border-white/20 pt-4 bg-gradient-to-b from-transparent to-gray-50/50">
        <Button
          onClick={handleSpark}
          variant="outline"
          size="sm"
          className="flex-1 hover:scale-105 transition-all duration-200 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 hover:border-purple-300"
          title="This sparks my interest!"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Spark
        </Button>
        <Button
          onClick={handleMeh}
          variant="ghost"
          size="sm"
          className="hover:scale-105 transition-transform duration-200"
          title="Not interested"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleBuild}
          size="sm"
          className="flex-1 hover:scale-105 transition-all duration-200 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl"
          title="Build this project!"
        >
          <Hammer className="h-4 w-4 mr-1" />
          Build
        </Button>
        <Button
          onClick={handleMore}
          variant="ghost"
          size="sm"
          className="hover:scale-105 transition-transform duration-200"
          title="View details"
        >
          <MoreHorizontal className="h-4 w-4" />
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
