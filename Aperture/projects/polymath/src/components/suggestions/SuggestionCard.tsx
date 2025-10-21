/**
 * SuggestionCard Component
 */

import React from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Sparkles, ThumbsDown, Hammer, MoreHorizontal } from 'lucide-react'
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

  // Determine if this is a creative (Interest × Interest) or technical suggestion
  const isCreative = suggestion.capability_ids.length === 0

  return (
    <Card className={`h-full flex flex-col hover:shadow-lg transition-all ${suggestion.is_wildcard ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white' : ''}`}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="text-xs font-bold">
              {suggestion.total_points}pts
            </Badge>
            {suggestion.is_wildcard && (
              <Badge variant="wildcard" className="text-xs">
                🎲 Wildcard
              </Badge>
            )}
            {isCreative && (
              <Badge variant="creative" className="text-xs">
                🎨 Creative
              </Badge>
            )}
          </div>
        </div>
        <CardTitle className="text-lg leading-tight">{suggestion.title}</CardTitle>
        <CardDescription className={compact ? 'line-clamp-2' : 'line-clamp-3'}>
          {suggestion.description}
        </CardDescription>
      </CardHeader>

      {!compact && (
        <CardContent className="flex-1 space-y-3">
          {suggestion.capability_ids.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Combines:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestion.capability_ids.slice(0, 3).map((capId) => (
                  <Badge key={capId} variant="outline" className="text-xs">
                    {formatCapabilityName(capId)}
                  </Badge>
                ))}
                {suggestion.capability_ids.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{suggestion.capability_ids.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <ScorePill label="Novelty" score={suggestion.novelty_score} />
            <ScorePill label="Feasibility" score={suggestion.feasibility_score} />
            <ScorePill label="Interest" score={suggestion.interest_score} />
          </div>
        </CardContent>
      )}

      <CardFooter className="flex gap-2 border-t pt-4">
        <Button
          onClick={handleSpark}
          variant="outline"
          size="sm"
          className="flex-1"
          title="This sparks my interest!"
        >
          <Sparkles className="h-4 w-4 mr-1" />
          Spark
        </Button>
        <Button
          onClick={handleMeh}
          variant="ghost"
          size="sm"
          title="Not interested"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleBuild}
          variant="default"
          size="sm"
          className="flex-1"
          title="Build this project!"
        >
          <Hammer className="h-4 w-4 mr-1" />
          Build
        </Button>
        <Button
          onClick={handleMore}
          variant="ghost"
          size="sm"
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
  const variant = score > 0.7 ? 'default' : score > 0.4 ? 'secondary' : 'outline'

  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant={variant} className="text-xs font-bold">
        {percentage}%
      </Badge>
    </div>
  )
}

function formatCapabilityName(capId: string): string {
  // Convert capability ID to readable name
  // e.g., "voice_processing" -> "Voice Processing"
  return capId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
