/**
 * CapabilityBadge Component
 * Visual badge for displaying capabilities
 */

import React from 'react'

interface CapabilityBadgeProps {
  capability: {
    id: string
    name: string
  }
  onClick?: () => void
}

export function CapabilityBadge({ capability, onClick }: CapabilityBadgeProps) {
  return (
    <span
      className={`capability-badge ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {capability.name}
    </span>
  )
}

// ============================================================================
// STYLES
// ============================================================================

/*
.capability-badge {
  display: inline-block;
  padding: 4px 12px;
  background: #f3f4f6;
  color: #4b5563;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid #e5e7eb;
  transition: all 0.2s;
}

.capability-badge.clickable {
  cursor: pointer;
}

.capability-badge.clickable:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.capability-badge.clickable:active {
  transform: translateY(0);
}
*/
