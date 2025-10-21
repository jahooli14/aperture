/**
 * Suggestion Detail Dialog
 * Shows full details, synthesis reasoning, and related memories/capabilities
 */

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Sparkles, ThumbsDown, Hammer, Lightbulb, Brain, Code2, TrendingUp } from 'lucide-react'
import type { ProjectSuggestion } from '../../types'

interface SuggestionDetailDialogProps {
  suggestion: ProjectSuggestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRate: (id: string, rating: number) => void
  onBuild: (id: string) => void
}

export function SuggestionDetailDialog({
  suggestion,
  open,
  onOpenChange,
  onRate,
  onBuild
}: SuggestionDetailDialogProps) {
  if (!suggestion) return null

  const handleSpark = () => {
    onRate(suggestion.id, 1)
    onOpenChange(false)
  }

  const handleMeh = () => {
    onRate(suggestion.id, -1)
    onOpenChange(false)
  }

  const handleBuild = () => {
    onBuild(suggestion.id)
    onOpenChange(false)
  }

  const isCreative = suggestion.capability_ids.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="px-4 py-1.5 rounded-md bg-orange-100 text-orange-700 text-sm font-semibold border border-orange-200 flex items-center gap-1">
                <Lightbulb className="h-4 w-4" />
                {suggestion.total_points}pts
              </div>
              {suggestion.is_wildcard && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Wildcard
                </Badge>
              )}
              {isCreative && !suggestion.is_wildcard && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
                  Creative
                </Badge>
              )}
            </div>
          </div>
          <DialogTitle className="text-2xl">{suggestion.title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed pt-2">
            {suggestion.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Scores */}
          <div className="grid grid-cols-3 gap-4">
            <ScoreCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Fresh"
              score={suggestion.novelty_score}
              description="How unique this idea is"
            />
            <ScoreCard
              icon={<Hammer className="h-5 w-5" />}
              label="Doable"
              score={suggestion.feasibility_score}
              description="How achievable it is"
            />
            <ScoreCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Exciting"
              score={suggestion.interest_score}
              description="How well it matches your interests"
            />
          </div>

          {/* Why This Suggestion */}
          {suggestion.synthesis_reasoning && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Why This Suggestion
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                {suggestion.synthesis_reasoning}
              </p>
            </div>
          )}

          {/* Capabilities */}
          {suggestion.capability_ids.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Uses These Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {suggestion.capability_ids.map((capId) => (
                  <span
                    key={capId}
                    className="px-3 py-1.5 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full text-sm font-medium border border-blue-200/50"
                  >
                    {formatCapabilityName(capId)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Memories */}
          {suggestion.memory_ids && suggestion.memory_ids.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Inspired By Your Memories
              </h3>
              <p className="text-xs text-neutral-500">
                This idea connects to {suggestion.memory_ids.length} of your past thoughts and experiences
              </p>
            </div>
          )}

          {/* Suggested Date */}
          <div className="text-xs text-neutral-400">
            Suggested {new Date(suggestion.suggested_at).toLocaleDateString()}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-3">
          <Button
            onClick={handleMeh}
            variant="ghost"
            className="flex-1"
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            Not Interested
          </Button>
          <Button
            onClick={handleSpark}
            variant="outline"
            className="flex-1 btn-secondary"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Spark
          </Button>
          <Button
            onClick={handleBuild}
            className="flex-1 btn-primary"
          >
            <Hammer className="h-4 w-4 mr-2" />
            Build This
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScoreCard({
  icon,
  label,
  score,
  description
}: {
  icon: React.ReactNode
  label: string
  score: number
  description: string
}) {
  const percentage = Math.round(score * 100)
  const colorClass = score > 0.7
    ? 'text-green-700 bg-green-50 border-green-200'
    : score > 0.4
      ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
      : 'text-red-700 bg-red-50 border-red-200'

  return (
    <div className={`p-4 rounded-lg border ${colorClass}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="text-2xl font-bold mb-1">{percentage}%</div>
      <div className="text-xs opacity-75">{description}</div>
    </div>
  )
}

function formatCapabilityName(capId: string): string {
  // Extract last part of UUID or return abbreviated version
  return capId.slice(0, 8) + '...'
}
