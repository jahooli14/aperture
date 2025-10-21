/**
 * Simple Tooltip Component
 * Lightweight tooltip using title attribute with custom styling
 */

import React from 'react'

interface TooltipProps {
  content: string
  children: React.ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  // For a quick win, we'll use the native title attribute
  // which provides instant tooltips without additional dependencies
  return React.cloneElement(children, {
    title: content,
    'data-tooltip': content,
  })
}

// Export a hook for consistent usage
export function useTooltip() {
  return { Tooltip }
}
