/**
 * RatingActions Component
 * Quick rating buttons for suggestions
 * Copy to: projects/memory-os/src/components/suggestions/RatingActions.tsx
 */

import React from 'react'
import type { RatingActionsProps } from '../../types'

export function RatingActions({
  onSpark,
  onMeh,
  onBuild,
  onMore,
  disabled = false
}: RatingActionsProps) {
  return (
    <div className="rating-actions">
      <button
        onClick={onSpark}
        disabled={disabled}
        className="rating-button rating-spark"
        title="This sparks interest"
      >
        <span className="button-icon">👍</span>
        <span className="button-label">Spark</span>
      </button>

      <button
        onClick={onMeh}
        disabled={disabled}
        className="rating-button rating-meh"
        title="Not interested"
      >
        <span className="button-icon">👎</span>
        <span className="button-label">Meh</span>
      </button>

      <button
        onClick={onBuild}
        disabled={disabled}
        className="rating-button rating-build primary"
        title="Build this now"
      >
        <span className="button-icon">💡</span>
        <span className="button-label">Build</span>
      </button>

      <button
        onClick={onMore}
        disabled={disabled}
        className="rating-button rating-more"
        title="Learn more"
      >
        <span className="button-icon">⋯</span>
        <span className="button-label">More</span>
      </button>
    </div>
  )
}

// ============================================================================
// STYLES
// ============================================================================

/*
.rating-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
}

.rating-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
}

.rating-button:hover:not(:disabled) {
  background: var(--color-bg);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.rating-button:active:not(:disabled) {
  transform: translateY(0);
}

.rating-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rating-button.primary {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.rating-button.primary:hover:not(:disabled) {
  background: #0052a3;
  border-color: #0052a3;
}

.button-icon {
  font-size: 1rem;
  line-height: 1;
}

.button-label {
  @media (max-width: 640px) {
    display: none;
  }
}

.rating-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
*/
