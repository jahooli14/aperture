/**
 * SuggestionCard Component
 * Copy to: projects/memory-os/src/components/suggestions/SuggestionCard.tsx
 */

import React from 'react'
import type { SuggestionCardProps } from '../../types'
import { CapabilityBadge } from '../capabilities/CapabilityBadge'
import { RatingActions } from './RatingActions'
import { WildcardBadge } from './WildcardBadge'

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

  return (
    <div className={`suggestion-card ${compact ? 'compact' : ''} ${suggestion.is_wildcard ? 'wildcard' : ''}`}>
      {suggestion.is_wildcard && <WildcardBadge />}

      <div className="card-header">
        <h3 className="card-title">{suggestion.title}</h3>
        <span className="points-badge">{suggestion.total_points}pts</span>
      </div>

      <p className="card-description">{suggestion.description}</p>

      {!compact && (
        <>
          <div className="capabilities-section">
            <span className="section-label">Combines:</span>
            <div className="capabilities-list">
              {suggestion.capability_ids.map((capId) => (
                <CapabilityBadge key={capId} capability={{ id: capId, name: capId }} />
              ))}
            </div>
          </div>

          <div className="scores-section">
            <ScorePill label="Novelty" score={suggestion.novelty_score} />
            <ScorePill label="Feasibility" score={suggestion.feasibility_score} />
            <ScorePill label="Interest" score={suggestion.interest_score} />
          </div>
        </>
      )}

      <RatingActions
        onSpark={handleSpark}
        onMeh={handleMeh}
        onBuild={handleBuild}
        onMore={handleMore}
      />
    </div>
  )
}

function ScorePill({ label, score }: { label: string; score: number }) {
  const percentage = Math.round(score * 100)
  const color = score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low'

  return (
    <div className={`score-pill score-${color}`}>
      <span className="score-label">{label}</span>
      <span className="score-value">{percentage}%</span>
    </div>
  )
}

// ============================================================================
// STYLES (CSS Module or styled-components)
// ============================================================================

/*
.suggestion-card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  transition: box-shadow 0.2s;
}

.suggestion-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-card.wildcard {
  border-color: #f59e0b;
  background: linear-gradient(to right, #fffbeb 0%, var(--color-bg) 10%);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-sm);
}

.card-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.points-badge {
  background: var(--color-primary);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.card-description {
  margin: var(--spacing-sm) 0;
  color: var(--color-text);
  line-height: 1.6;
}

.capabilities-section {
  margin: var(--spacing-md) 0;
}

.section-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-right: var(--spacing-sm);
}

.capabilities-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
}

.scores-section {
  display: flex;
  gap: var(--spacing-sm);
  margin: var(--spacing-md) 0;
}

.score-pill {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
}

.score-pill.score-high {
  background: #dcfce7;
  color: #166534;
}

.score-pill.score-medium {
  background: #fef9c3;
  color: #854d0e;
}

.score-pill.score-low {
  background: #fee2e2;
  color: #991b1b;
}

.suggestion-card.compact {
  padding: var(--spacing-md);
}

.suggestion-card.compact .card-title {
  font-size: 1rem;
}

.suggestion-card.compact .card-description {
  font-size: 0.875rem;
  margin: var(--spacing-xs) 0;
}
*/
