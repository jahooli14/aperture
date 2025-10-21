/**
 * WildcardBadge Component
 * Visual indicator for diversity-injected suggestions
 * Copy to: projects/memory-os/src/components/suggestions/WildcardBadge.tsx
 */

import React from 'react'

export function WildcardBadge() {
  return (
    <div className="wildcard-badge" title="This idea is outside your usual range - try it!">
      <span className="wildcard-icon">🎲</span>
      <span className="wildcard-label">Wild Card</span>
    </div>
  )
}

// ============================================================================
// STYLES
// ============================================================================

/*
.wildcard-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 4px 12px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.2);
}

.wildcard-icon {
  font-size: 1rem;
  line-height: 1;
}

.wildcard-label {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
*/
