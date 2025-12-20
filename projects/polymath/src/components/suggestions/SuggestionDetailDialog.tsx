/**
 * Suggestion Detail Dialog
 * Shows full details, synthesis reasoning, and related memories/capabilities
 */

import React, { useState } from 'react'
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
import { Zap, ThumbsDown, Hammer, Lightbulb, Brain, Code2, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['why']))

  if (!suggestion) return null

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

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
              <div
                className="px-3 py-1.5 rounded-md text-sm font-semibold border-2 flex items-center gap-1"
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  borderColor: 'rgba(59, 130, 246, 0.3)'
                }}
              >
                <Lightbulb className="h-4 w-4" />
                {suggestion.total_points}pts
              </div>
              {suggestion.is_wildcard && (
                <Badge
                  variant="secondary"
                  className="border-2"
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    color: '#a855f7',
                    borderColor: 'rgba(168, 85, 247, 0.3)'
                  }}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Wildcard
                </Badge>
              )}
              {isCreative && !suggestion.is_wildcard && (
                <Badge
                  variant="secondary"
                  className="border-2"
                  style={{
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    color: '#8b5cf6',
                    borderColor: 'rgba(139, 92, 246, 0.3)'
                  }}
                >
                  Creative
                </Badge>
              )}
            </div>
          </div>
          <DialogTitle className="text-2xl premium-text-platinum">{suggestion.title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed pt-2" style={{ color: 'var(--premium-text-secondary)' }}>
            {suggestion.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Why This Project Is Good */}
          <div
            className="rounded-xl border-2"
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'rgba(59, 130, 246, 0.2)'
            }}
          >
            <button
              onClick={() => toggleSection('why')}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors rounded-xl"
            >
              <h3 className="text-base font-bold premium-text-platinum flex items-center gap-2">
                <Lightbulb className="h-5 w-5" style={{ color: '#3b82f6' }} />
                Why This Project Is Good For You
              </h3>
              {expandedSections.has('why') ? (
                <ChevronUp className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
              ) : (
                <ChevronDown className="h-5 w-5" style={{ color: 'var(--premium-text-tertiary)' }} />
              )}
            </button>

            {expandedSections.has('why') && (
              <div className="px-4 pb-4 space-y-3 text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
                {suggestion.novelty_score > 0.7 && (
                  <div className="flex gap-2">
                    <TrendingUp className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                    <p><strong>Fresh idea:</strong> You haven't explored this combination before. It's a new direction that could unlock creative potential.</p>
                  </div>
                )}

                {suggestion.feasibility_score > 0.6 && (
                  <div className="flex gap-2">
                    <Hammer className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#3b82f6' }} />
                    <p><strong>Totally doable:</strong> You have {suggestion.capability_ids.length > 0 ? 'the skills' : 'what it takes'} to make this happen. Not too hard, not too easy—just right for growth.</p>
                  </div>
                )}

                {suggestion.interest_score > 0.5 && (
                  <div className="flex gap-2">
                    <Lightbulb className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#a855f7' }} />
                    <p><strong>Matches your vibe:</strong> Based on your memories and interests, this aligns with what you care about right now.</p>
                  </div>
                )}

                {suggestion.memory_ids && suggestion.memory_ids.length > 0 && (
                  <div className="flex gap-2">
                    <Brain className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                    <p><strong>Connects your dots:</strong> This idea pulls together {suggestion.memory_ids.length} different thoughts you've captured—creating something bigger than any one piece.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="grid grid-cols-3 gap-3">
            <ScoreCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Fresh"
              score={suggestion.novelty_score}
              description="Uniqueness"
            />
            <ScoreCard
              icon={<Hammer className="h-4 w-4" />}
              label="Doable"
              score={suggestion.feasibility_score}
              description="Within reach"
            />
            <ScoreCard
              icon={<Zap className="h-4 w-4" />}
              label="Exciting"
              score={suggestion.interest_score}
              description="Matches you"
            />
          </div>

          {/* AI Reasoning (if available) */}
          {suggestion.synthesis_reasoning && (
            <div
              className="rounded-lg border-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <button
                onClick={() => toggleSection('ai')}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors rounded-lg"
              >
                <h3 className="text-sm font-semibold premium-text-platinum flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Analysis
                </h3>
                {expandedSections.has('ai') ? (
                  <ChevronUp className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                ) : (
                  <ChevronDown className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                )}
              </button>
              {expandedSections.has('ai') && (
                <p className="text-sm leading-relaxed px-3 pb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                  {suggestion.synthesis_reasoning}
                </p>
              )}
            </div>
          )}

          {/* Capabilities */}
          {suggestion.capabilities && suggestion.capabilities.length > 0 && (
            <div
              className="rounded-lg border-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <button
                onClick={() => toggleSection('capabilities')}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors rounded-lg"
              >
                <h3 className="text-sm font-semibold premium-text-platinum flex items-center gap-2">
                  <Code2 className="h-4 w-4" />
                  Uses These Skills ({suggestion.capabilities.length})
                </h3>
                {expandedSections.has('capabilities') ? (
                  <ChevronUp className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                ) : (
                  <ChevronDown className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                )}
              </button>
              {expandedSections.has('capabilities') && (
                <div className="flex flex-wrap gap-2 px-3 pb-3">
                  {suggestion.capabilities.map((cap) => (
                    <span
                      key={cap.id}
                      className="px-3 py-1.5 rounded-full text-sm font-medium border-2"
                      style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        borderColor: 'rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {cap.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Related Memories */}
          {suggestion.memory_ids && suggestion.memory_ids.length > 0 && (
            <div
              className="rounded-lg border-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <button
                onClick={() => toggleSection('memories')}
                className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors rounded-lg"
              >
                <h3 className="text-sm font-semibold premium-text-platinum flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Inspired By Your Memories ({suggestion.memory_ids.length})
                </h3>
                {expandedSections.has('memories') ? (
                  <ChevronUp className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                ) : (
                  <ChevronDown className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                )}
              </button>
              {expandedSections.has('memories') && (
                <p className="text-xs px-3 pb-3" style={{ color: 'var(--premium-text-tertiary)' }}>
                  This idea connects to {suggestion.memory_ids.length} of your past thoughts and experiences
                </p>
              )}
            </div>
          )}

          {/* Suggested Date */}
          <div className="text-xs" style={{ color: 'var(--premium-text-tertiary)' }}>
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
            <Zap className="h-4 w-4 mr-2" />
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

  const colorConfig = score > 0.7
    ? { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' }
    : score > 0.4
      ? { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: 'rgba(251, 191, 36, 0.3)' }
      : { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' }

  return (
    <div
      className="p-3 rounded-lg border-2"
      style={{
        backgroundColor: colorConfig.bg,
        borderColor: colorConfig.border
      }}
    >
      <div className="flex items-center gap-1.5 mb-1" style={{ color: colorConfig.color }}>
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="text-xl font-bold mb-0.5" style={{ color: colorConfig.color }}>{percentage}%</div>
      <div className="text-xs" style={{ color: colorConfig.color, opacity: 0.75 }}>{description}</div>
    </div>
  )
}

function formatCapabilityName(capId: string): string {
  // Extract last part of UUID or return abbreviated version
  return capId.slice(0, 8) + '...'
}
