import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Skull, RefreshCw, Loader2, Zap, Sprout, X } from 'lucide-react'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/apiClient'
import { useProjectStore } from '../../stores/useProjectStore'

interface ReaperModalProps {
  isOpen: boolean
  onClose: () => void
}

interface RottingProject {
  id: string
  title: string
  description: string
  last_active: string
  created_at: string
  eulogy?: string
  status: string
}

export function ReaperModal({ isOpen, onClose }: ReaperModalProps) {
  const { addToast } = useToast()
  const { fetchProjects } = useProjectStore()
  const [rottingProject, setRottingProject] = useState<RottingProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchRottingProject()
    } else {
      setRottingProject(null)
      setLoading(true)
    }
  }, [isOpen])

  const fetchRottingProject = async () => {
    setLoading(true)
    try {
      // Fetch ONE rotting project
      const response = await api.get('projects?resource=reaper&action=rotting')
      const projects = Array.isArray(response) ? response : response?.projects || []

      if (projects.length > 0) {
        const project = projects[0]
        // Fetch eulogy for this project
        const eulogyResponse = await api.get(`projects?resource=reaper&action=eulogy&id=${project.id}`)
        setRottingProject({ ...project, eulogy: eulogyResponse.eulogy })
      } else {
        setRottingProject(null)
      }
    } catch (error) {
      console.error('[ReaperModal] Failed to fetch rotting project:', error)
      addToast({
        title: 'Error',
        description: 'Failed to load project details for The Reaper.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBury = async () => {
    if (!rottingProject) return
    setSubmitting(true)
    try {
      await api.post(`projects?resource=reaper&action=bury&id=${rottingProject.id}`, {})
      addToast({
        title: `Buried "${rottingProject.title}"`,
        description: 'It now rests in the Graveyard.',
        variant: 'success',
      })
      fetchProjects() // Refresh projects list
      onClose()
    } catch (error) {
      console.error('[ReaperModal] Failed to bury project:', error)
      addToast({
        title: 'Error',
        description: 'Failed to bury project.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleResurrect = async () => {
    if (!rottingProject) return
    setSubmitting(true)
    try {
      await api.post(`projects?resource=reaper&action=resurrect&id=${rottingProject.id}`, {})
      addToast({
        title: `Resurrected "${rottingProject.title}"`,
        description: 'Welcome back to the living!',
        variant: 'success',
      })
      fetchProjects() // Refresh projects list
      onClose()
    } catch (error) {
      console.error('[ReaperModal] Failed to resurrect project:', error)
      addToast({
        title: 'Error',
        description: 'Failed to resurrect project.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || (!loading && !rottingProject)) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg rounded-2xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(139, 92, 246, 0.05))',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              style={{ color: "var(--brand-primary)" }}
            >
              <X className="h-5 w-5" />
            </button>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-brand-text-secondary mb-4" />
                <p className="text-brand-primary">Searching for lost souls...</p>
              </div>
            ) : rottingProject ? (
              <div className="text-center">
                <Skull className="h-12 w-12 mx-auto text-brand-text-secondary mb-4" />
                <h2 className="text-2xl font-bold text-brand-text-secondary mb-1">
                  The Reaper Approaches
                </h2>
                <p className="text-sm text-brand-primary/70 mb-5">
                  A project has fallen silent.
                </p>

                <div className="bg-black/20 rounded-lg mb-6 text-left overflow-hidden" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <div className="px-4 py-3 border-b border-red-500/20">
                    <h3 className="text-base font-semibold text-[var(--brand-text-primary)]">
                      {rottingProject.title}
                    </h3>
                    {rottingProject.description && (
                      <p className="text-xs text-brand-primary/60 mt-0.5">
                        {rottingProject.description}
                      </p>
                    )}
                  </div>
                  {rottingProject.eulogy && (
                    <div className="px-4 py-3 max-h-48 overflow-y-auto">
                      {rottingProject.eulogy.split(/(?<=[.!?])\s+/).map((sentence, i) => (
                        <p key={i} className="text-sm text-brand-primary/80 font-serif leading-relaxed mb-2 last:mb-0">
                          {sentence}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleResurrect}
                    disabled={submitting}
                    className="px-6 py-3 rounded-lg bg-brand-primary/20 text-brand-primary border border-green-500/40 hover:bg-brand-primary/30 transition-all flex items-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Sprout className="h-5 w-5" />
                    )}
                    Resurrect
                  </button>
                  <button
                    onClick={handleBury}
                    disabled={submitting}
                    className="px-6 py-3 rounded-lg bg-brand-primary/20 text-brand-primary border border-red-500/40 hover:bg-brand-primary/30 transition-all flex items-center gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Skull className="h-5 w-5" />
                    )}
                    Bury Forever
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <Zap className="h-12 w-12 text-[var(--brand-text-muted)] mb-4" />
                <p className="text-[var(--brand-text-secondary)]">All projects are alive and well.</p>
                <button
                  onClick={onClose}
                  className="mt-6 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.1)] text-gray-200 hover:bg-white/20 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}