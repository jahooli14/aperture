/**
 * SpotlightCard - Featured project card for left sidebar
 * Shows full details: title, description, next task, progress
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Pin, ChevronRight } from 'lucide-react'
import type { Project } from '../../types'

interface SpotlightCardProps {
  project: Project
  type: 'pinned' | 'recent' | 'resurfaced'
  accentColor?: string
}

const typeConfig = {
  pinned: {
    label: 'Pinned',
    icon: Pin,
    color: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    textColor: 'var(--premium-blue)'
  },
  recent: {
    label: 'Recent',
    icon: null,
    color: 'rgba(168, 85, 247, 0.1)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    textColor: 'rgba(168, 85, 247, 0.8)'
  },
  resurfaced: {
    label: 'Resurface',
    icon: null,
    color: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    textColor: 'var(--premium-emerald)'
  }
}

export function SpotlightCard({
  project,
  type,
  accentColor
}: SpotlightCardProps) {
  const config = typeConfig[type]
  const tasks = (project.metadata?.tasks || []) as any[]
  const nextTask = tasks
    .sort((a, b) => a.order - b.order)
    .find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length

  return (
    <Link to={`/projects/${project.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl transition-all"
        style={{
          background: accentColor || config.color,
          border: `1px solid ${config.borderColor}`,
          backdropFilter: 'blur(8px)'
        }}
        whileHover={{
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          y: -2
        }}
      >
        {/* Header with label and icon */}
        <div className="flex items-center gap-2 mb-2">
          {config.icon && (
            <config.icon size={16} style={{ color: config.textColor }} />
          )}
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: config.textColor }}
          >
            {config.label}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-base font-bold mb-2" style={{ color: 'rgba(255, 255, 255, 0.95)' }}>
          {project.title}
        </h4>

        {/* Description if exists */}
        {project.description && (
          <p
            className="text-xs mb-3 line-clamp-2"
            style={{ color: 'rgba(255, 255, 255, 0.7)' }}
          >
            {project.description}
          </p>
        )}

        {/* Next task */}
        {nextTask && (
          <div
            className="rounded-lg p-2 mb-3 flex items-center gap-2"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
          >
            <p
              className="text-xs flex-1 line-clamp-1"
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
            >
              {nextTask.text}
            </p>
            {totalTasks > 0 && (
              <span
                className="text-xs font-medium flex-shrink-0"
                style={{ color: 'rgba(255, 255, 255, 0.5)' }}
              >
                {completedTasks}/{totalTasks}
              </span>
            )}
          </div>
        )}

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div
            className="h-1.5 rounded-full overflow-hidden mb-2"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}
          >
            <motion.div
              className="h-full"
              style={{
                background: 'linear-gradient(90deg, var(--premium-blue), var(--premium-emerald))'
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(completedTasks / totalTasks) * 100}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        )}

        {/* View link */}
        <div
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: config.textColor }}
        >
          View <ChevronRight size={14} />
        </div>
      </motion.div>
    </Link>
  )
}
