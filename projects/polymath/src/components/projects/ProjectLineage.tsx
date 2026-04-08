/**
 * ProjectLineage — Version history for a project
 *
 * Shows the original version + up to last 2 reshapes.
 * User can revert to any saved version.
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { History, ChevronDown, RotateCcw } from 'lucide-react'
import type { Project } from '../../types'
import { useProjectStore } from '../../stores/useProjectStore'
import { useToast } from '../ui/toast'

interface ProjectVersion {
  version_id: string
  created_at: string
  title: string
  description: string
  snapshot: Record<string, any>
}

interface ProjectLineageProps {
  project: Project
}

function formatVersionDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ProjectLineage({ project }: ProjectLineageProps) {
  const { updateProject } = useProjectStore()
  const { addToast } = useToast()
  const [open, setOpen] = useState(false)
  const [reverting, setReverting] = useState<string | null>(null)

  const versions: ProjectVersion[] = project.metadata?.versions || []
  if (versions.length <= 1) return null

  const handleRevert = async (version: ProjectVersion) => {
    setReverting(version.version_id)
    try {
      await updateProject(project.id, {
        title: version.title,
        description: version.description,
        metadata: {
          ...project.metadata,
          ...version.snapshot,
          // Keep lineage intact when reverting
          versions: project.metadata?.versions,
        }
      })
      addToast({ title: 'Reverted', description: `Reverted to version from ${formatVersionDate(version.created_at)}`, variant: 'success' })
      setOpen(false)
    } catch {
      addToast({ title: 'Error', description: 'Failed to revert', variant: 'destructive' })
    }
    setReverting(null)
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
      >
        <History className="h-3.5 w-3.5" />
        {versions.length} version{versions.length !== 1 ? 's' : ''} saved
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 space-y-2 pl-4 border-l" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {versions.map((version, i) => (
                <div key={version.version_id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--brand-text-primary)' }}>
                      {version.title}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                      {i === 0 ? 'Original' : `Reshape ${i}`} · {formatVersionDate(version.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevert(version)}
                    disabled={!!reverting}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:bg-[var(--glass-surface)] disabled:opacity-40"
                    style={{ color: 'var(--brand-primary)', border: '1px solid rgba(var(--brand-primary-rgb),0.2)' }}
                  >
                    {reverting === version.version_id ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <RotateCcw className="h-3 w-3" />
                      </motion.div>
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Revert
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
