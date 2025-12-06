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
      await api.post(`projects?resource=reaper&action=bury&id=${rottingProject.id}`)
      addToast({
        title: `💀 Buried "${rottingProject.title}"`,
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
      await api.post(`projects?resource=reaper&action=resurrect&id=${rottingProject.id}`)
      addToast({
        title: `🌱 Resurrected "${rottingProject.title}"`,
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
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              style={{ color: 'var(--premium-text-tertiary)' }}
            >
              <X className="h-5 w-5" />
            </button>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-red-500 mb-4" />
                <p className="text-red-300">Searching for lost souls...</p>
              </div>
            ) : rottingProject ? (
              <div className="text-center">
                <Skull className="h-16 w-16 mx-auto text-red-500 mb-6" />
                <h2 className="text-3xl font-bold text-red-400 mb-3">
                  The Reaper Approaches
                </h2>
                <p className="text-lg text-red-200 mb-6">
                  A project has fallen silent. It whispers from the void...
                </p>

                <div className="bg-black/20 p-5 rounded-lg mb-8" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    "{rottingProject.title}"
                  </h3>
                  {rottingProject.description && (
                    <p className="text-sm italic text-red-200/80 mb-4">
                      {rottingProject.description}
                    </p>
                  )}
                  {rottingProject.eulogy && (
                    <p className="text-base text-red-100 font-serif">
                      "{rottingProject.eulogy}"
                    </p>
                  )}
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handleResurrect}
                    disabled={submitting}
                    className="px-6 py-3 rounded-lg bg-green-500/20 text-green-300 border border-green-500/40 hover:bg-green-500/30 transition-all flex items-center gap-2"
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
                    className="px-6 py-3 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition-all flex items-center gap-2"
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
                <Zap className="h-12 w-12 text-gray-500 mb-4" />
                <p className="text-gray-300">All projects are alive and well.</p>
                <button
                  onClick={onClose}
                  className="mt-6 px-4 py-2 rounded-lg bg-white/10 text-gray-200 hover:bg-white/20 transition-colors"
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