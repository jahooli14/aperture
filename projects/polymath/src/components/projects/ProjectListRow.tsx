/**
 * ProjectListRow - Compact single-row project display for scrollable list
 * Shows: title, next task, progress bar, status
 * Minimal, scannable, designed for density
 */

import React, { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Plus, Check } from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { usePin } from '../../contexts/PinContext'
import type { Project } from '../../types'

interface ProjectListRowProps {
  project: Project
  isSpotlighted?: boolean
  spotlightColor?: string
}

export function ProjectListRow({
  project,
  isSpotlighted = false,
  spotlightColor = 'rgba(var(--brand-primary-rgb), 0.1)' // default blue
}: ProjectListRowProps) {
  const { setPriority, updateProject } = useProjectStore()
  const { pinnedItem } = usePin()
  const [newTaskText, setNewTaskText] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Check if this project is pinned
  const isPinned = pinnedItem?.type === 'project' && pinnedItem?.id === project.id

  const tasks = (project.metadata?.tasks || []) as any[]
  const nextTask = tasks
    .sort((a, b) => a.order - b.order)
    .find(task => !task.done)
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.done).length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!newTaskText.trim()) return

    const newTask = {
      id: crypto.randomUUID(),
      text: newTaskText.trim(),
      done: false,
      created_at: new Date().toISOString(),
      order: tasks.length
    }

    const updatedTasks = [...tasks, newTask]
    const newMetadata = {
      ...project.metadata,
      tasks: updatedTasks
    }

    try {
      await updateProject(project.id, { metadata: newMetadata })
      setNewTaskText('')
      setIsAddingTask(false)
    } catch (error) {
      console.error('Failed to add task:', error)
    }
  }

  const handleStartAddingTask = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsAddingTask(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const statusColors: Record<string, string> = {
    active: 'rgba(var(--brand-primary-rgb), 0.2)',
    dormant: 'rgba(107, 114, 128, 0.2)',
    upcoming: 'rgba(var(--brand-primary-rgb), 0.2)',
    completed: 'rgba(var(--brand-primary-rgb), 0.2)'
  }

  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block transition-all"
    >
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="p-3 rounded-lg transition-all"
        style={{
          backgroundColor: isSpotlighted ? spotlightColor : 'var(--glass-surface)',
          border: `1px solid ${isSpotlighted ? 'rgba(255, 255, 255, 0.2)' : 'var(--glass-surface)'}`,
          boxShadow: project.is_priority ? '0 0 24px rgba(var(--brand-primary-rgb), 0.5), 0 0 48px rgba(var(--brand-primary-rgb), 0.25), 0 0 72px rgba(var(--brand-primary-rgb), 0.1)' : 'none'
        }}
        whileHover={{
          backgroundColor: isSpotlighted ? spotlightColor : 'var(--glass-surface)',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          boxShadow: project.is_priority ? '0 0 32px rgba(var(--brand-primary-rgb), 0.6), 0 0 64px rgba(var(--brand-primary-rgb), 0.35), 0 0 96px rgba(var(--brand-primary-rgb), 0.15)' : 'none'
        }}
      >
        {/* Title row with status badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPriority(project.id)
              }}
              className="flex-shrink-0 p-1 rounded-xl hover:bg-white/20 transition-colors"
              title={project.is_priority ? "Remove from priority" : "Set as priority"}
            >
              <Star
                size={18}
                style={{
                  color: project.is_priority ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255, 255, 255, 0.6)',
                  fill: project.is_priority ? 'rgb(var(--brand-primary-rgb))' : 'none'
                }}
              />
            </button>
            <h4
              className="text-sm font-semibold flex-1 line-clamp-1"
              style={{ color: "var(--brand-primary)" }}
            >
              {project.title}
            </h4>
          </div>
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-xl whitespace-nowrap flex-shrink-0"
            style={{
              backgroundColor: statusColors[project.status] || statusColors.active,
              color: "var(--brand-text-secondary)"
            }}
          >
            {project.status}
          </span>
        </div>

        {/* Next task */}
        {nextTask ? (
          <p
            className="text-xs line-clamp-1 mb-2"
            style={{ color: "var(--brand-primary)" }}
          >
            {nextTask.text}
          </p>
        ) : (
          <p
            className="text-xs mb-2"
            style={{ color: "var(--brand-primary)" }}
          >
            No tasks
          </p>
        )}

        {/* Progress bar */}
        {totalTasks > 0 && (
          <div className="flex items-center gap-2">
            <div
              className="flex-1 h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <motion.div
                className="h-full"
                style={{
                  background: 'linear-gradient(90deg, var(--brand-primary), var(--brand-primary))'
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <span
              className="text-xs font-medium whitespace-nowrap"
              style={{ color: "var(--brand-primary)" }}
            >
              {completedTasks}/{totalTasks}
            </span>
          </div>
        )}

        {/* Quick Add Task - Only for pinned projects */}
        {isPinned && (
          <div
            className="mt-2 pt-2"
            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
            onClick={(e) => e.preventDefault()}
          >
            {isAddingTask ? (
              <form onSubmit={handleAddTask} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  onBlur={() => {
                    if (!newTaskText.trim()) {
                      setIsAddingTask(false)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setNewTaskText('')
                      setIsAddingTask(false)
                    }
                  }}
                  placeholder="Add task..."
                  className="flex-1 px-2 py-1 text-xs rounded-xl"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: "var(--brand-text-secondary)",
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  className="p-1 rounded-xl hover:bg-white/20 transition-colors"
                  style={{ color: "var(--brand-primary)" }}
                >
                  <Check size={14} />
                </button>
              </form>
            ) : (
              <button
                onClick={handleStartAddingTask}
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-xl hover:bg-[rgba(255,255,255,0.1)] transition-colors w-full"
                style={{ color: "var(--brand-primary)" }}
              >
                <Plus size={14} />
                <span>Add task</span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </Link>
  )
}
