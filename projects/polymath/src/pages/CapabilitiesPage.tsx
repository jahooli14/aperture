/**
 * Capabilities Sub-Page
 * Manage skills and interests extracted from projects
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Zap,
  RefreshCw,
  Trash2,
  Loader2
} from 'lucide-react'
import { SubtleBackground } from '../components/SubtleBackground'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/toast'

interface Capability {
  id: string
  name: string
  description: string
  strength: number
}

export function CapabilitiesPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [loadingCaps, setLoadingCaps] = useState(false)
  const [extractingCaps, setExtractingCaps] = useState(false)

  useEffect(() => {
    fetchCapabilities()
  }, [])

  const fetchCapabilities = async () => {
    setLoadingCaps(true)
    try {
      const { data, error } = await supabase
        .from('capabilities')
        .select('*')
        .order('strength', { ascending: false })

      if (error) throw error
      setCapabilities(data || [])
    } catch (error) {
      console.error('Failed to fetch capabilities:', error)
      addToast({
        title: 'Failed to load capabilities',
        variant: 'destructive'
      })
    } finally {
      setLoadingCaps(false)
    }
  }

  const handleExtractCapabilities = async () => {
    setExtractingCaps(true)
    try {
      const response = await fetch('/api/projects?resource=capabilities&action=extract', {
        method: 'POST'
      })
      if (!response.ok) throw new Error('Extraction failed')

      const result = await response.json()
      addToast({
        title: 'Capabilities Updated',
        description: result.extracted?.length ? `Discovered ${result.extracted.length} new capabilities!` : 'Your capabilities are up to date.',
        variant: 'success'
      })
      fetchCapabilities()
    } catch (error) {
      addToast({
        title: 'Extraction Failed',
        description: 'Could not analyze your data',
        variant: 'destructive'
      })
    } finally {
      setExtractingCaps(false)
    }
  }

  const handleDeleteCapability = async (id: string) => {
    try {
      const { error } = await supabase
        .from('capabilities')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCapabilities(prev => prev.filter(c => c.id !== id))
      addToast({
        title: 'Capability Removed',
        variant: 'success'
      })
    } catch (error) {
      addToast({
        title: 'Failed to delete',
        variant: 'destructive'
      })
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {/* Subtle Background Effect */}
      <SubtleBackground />

      {/* Fixed Header Bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(15, 24, 41, 0.7)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings')}
              className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
              style={{
                color: 'var(--premium-blue)'
              }}
              title="Back to settings"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Zap className="h-7 w-7" style={{ color: 'var(--premium-blue)', opacity: 0.7 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: 'var(--premium-tracking-tight)',
              color: 'var(--premium-text-secondary)',
              opacity: 0.7
            }}>
              Capabilities
            </h1>
          </div>
          <button
            onClick={handleExtractCapabilities}
            disabled={extractingCaps}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Re-analyze Data"
          >
            <RefreshCw className={`h-5 w-5 ${extractingCaps ? 'animate-spin' : ''}`} style={{ color: 'var(--premium-text-secondary)' }} />
          </button>
        </div>
      </div>

      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>
        {/* Header Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 className="text-2xl font-bold premium-text-platinum" style={{ opacity: 0.7 }}>
              Your <span style={{ color: 'var(--premium-blue)' }}>capabilities</span>
            </h2>
            <p className="mt-2 text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
              Skills and interests extracted from your projects
            </p>
          </div>
        </section>

        {/* Capabilities Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            {loadingCaps ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : capabilities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {capabilities.map((cap, index) => (
                  <motion.div
                    key={cap.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group p-4 rounded-xl border transition-all hover:border-blue-500/30 hover:bg-blue-500/5"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold premium-text-platinum mb-1">
                          {cap.name}
                        </h3>
                        {cap.description && (
                          <p className="text-sm text-gray-400">
                            {cap.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteCapability(cap.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/20"
                        title="Remove capability"
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </button>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">Strength</span>
                        <span className="text-xs font-medium premium-text-platinum">
                          {Math.round(cap.strength * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all"
                          style={{ width: `${cap.strength * 100}%` }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="mb-4">No capabilities found yet.</p>
                <button
                  onClick={handleExtractCapabilities}
                  disabled={extractingCaps}
                  className="px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 transition-colors text-blue-400 font-medium disabled:opacity-50"
                >
                  {extractingCaps ? 'Analyzing...' : 'Analyze Projects'}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </motion.div>
  )
}
