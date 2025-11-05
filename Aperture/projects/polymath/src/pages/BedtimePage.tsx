/**
 * Bedtime Ideas Page
 * Trippy prompts for creative subconscious thinking
 * Generated at 9:30pm daily
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sparkles, Eye, EyeOff, RefreshCw, Loader2, Star } from 'lucide-react'
import { useToast } from '../components/ui/toast'

interface BedtimePrompt {
  id: string
  prompt: string
  type: 'connection' | 'divergent' | 'revisit' | 'transform'
  metaphor?: string
  viewed: boolean
  created_at: string
}

export function BedtimePage() {
  const [prompts, setPrompts] = useState<BedtimePrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const { addToast } = useToast()

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/projects?resource=bedtime')
      const data = await response.json()

      setPrompts(data.prompts || [])
      setMessage(data.message || '')
    } catch (error) {
      addToast({
        title: 'Failed to load prompts',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const generateNew = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/projects?resource=bedtime', { method: 'POST' })
      const data = await response.json()

      setPrompts(data.prompts || [])
      addToast({
        title: '✨ New prompts generated',
        description: `${data.prompts?.length || 0} ideas for tonight`,
        variant: 'success'
      })
    } catch (error) {
      addToast({
        title: 'Failed to generate',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      })
    } finally {
      setGenerating(false)
    }
  }

  const markViewed = async (id: string) => {
    setViewedIds(prev => new Set(prev).add(id))

    try {
      await fetch('/api/projects?resource=bedtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      })
    } catch (error) {
      console.error('Failed to mark viewed:', error)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'connection': return '🔗'
      case 'divergent': return '🌊'
      case 'revisit': return '🔮'
      case 'transform': return '✨'
      default: return '💭'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'connection': return 'var(--premium-blue)'
      case 'divergent': return 'var(--premium-emerald)'
      case 'revisit': return 'var(--premium-purple)'
      case 'transform': return 'var(--premium-gold)'
      default: return 'var(--premium-platinum)'
    }
  }

  return (
    <div className="min-h-screen premium-bg p-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto mb-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="p-4 rounded-2xl premium-glass-subtle">
            <Moon className="h-8 w-8" style={{ color: 'var(--premium-gold)' }} />
          </div>
          <div>
            <h1 className="premium-text-platinum text-2xl font-bold">
              Bedtime Ideas
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
              💭 Seeds for your creative subconscious
            </p>
          </div>
        </div>

        {/* Time indicator */}
        <div className="premium-glass-subtle rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5" style={{ color: 'var(--premium-gold)' }} />
            <div>
              <p className="text-sm font-medium premium-text-platinum">
                {prompts.length > 0 ? "Tonight's Prompts Ready" : "Waiting for 9:30pm"}
              </p>
              {message && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--premium-text-tertiary)' }}>
                  {message}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={generateNew}
            disabled={generating}
            className="px-4 py-2 rounded-lg transition-all premium-glass-subtle hover:bg-white/10"
            style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--premium-platinum)' }} />
            ) : (
              <RefreshCw className="h-4 w-4" style={{ color: 'var(--premium-platinum)' }} />
            )}
          </button>
        </div>
      </motion.div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--premium-platinum)' }} />
        </div>
      )}

      {/* Prompts */}
      {!loading && prompts.length > 0 && (
        <div className="max-w-2xl mx-auto space-y-6">
          <AnimatePresence>
            {prompts.map((prompt, index) => {
              const isViewed = viewedIds.has(prompt.id) || prompt.viewed

              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className="premium-card p-6 relative overflow-hidden group"
                  style={{
                    border: `2px solid ${getTypeColor(prompt.type)}40`,
                    opacity: isViewed ? 0.6 : 1
                  }}
                >
                  {/* Background glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${getTypeColor(prompt.type)}10, transparent 70%)`
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Type badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getTypeIcon(prompt.type)}</span>
                        <span
                          className="text-xs font-semibold uppercase tracking-wider"
                          style={{ color: getTypeColor(prompt.type) }}
                        >
                          {prompt.type}
                        </span>
                      </div>

                      <button
                        onClick={() => markViewed(prompt.id)}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        title={isViewed ? 'Viewed' : 'Mark as viewed'}
                      >
                        {isViewed ? (
                          <EyeOff className="h-4 w-4" style={{ color: 'var(--premium-text-tertiary)' }} />
                        ) : (
                          <Eye className="h-4 w-4" style={{ color: 'var(--premium-platinum)' }} />
                        )}
                      </button>
                    </div>

                    {/* Prompt text */}
                    <p className="text-lg leading-relaxed premium-text-platinum mb-4">
                      {prompt.prompt}
                    </p>

                    {/* Metaphor hint */}
                    {prompt.metaphor && (
                      <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                        <div className="flex items-start gap-2">
                          <Star className="h-3 w-3 mt-1 flex-shrink-0" style={{ color: 'var(--premium-gold)' }} />
                          <p className="text-xs italic" style={{ color: 'var(--premium-text-secondary)' }}>
                            {prompt.metaphor}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty state */}
      {!loading && prompts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md mx-auto text-center py-16"
        >
          <div className="p-8 rounded-full premium-glass-subtle inline-flex mb-6">
            <Moon className="h-12 w-12" style={{ color: 'var(--premium-gold)' }} />
          </div>
          <h2 className="text-xl font-semibold premium-text-platinum mb-2">
            No prompts yet
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--premium-text-secondary)' }}>
            {message || 'Check back at 9:30pm for tonight\'s ideas'}
          </p>
          <button
            onClick={generateNew}
            disabled={generating}
            className="px-6 py-3 rounded-lg transition-all inline-flex items-center gap-2"
            style={{
              background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-purple))',
              color: 'white'
            }}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Now
              </>
            )}
          </button>
        </motion.div>
      )}

      {/* Footer tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="max-w-2xl mx-auto mt-12 p-6 rounded-xl premium-glass-subtle text-center"
      >
        <p className="text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
          💡 <strong>Tip:</strong> Read these as you're falling asleep. Let your subconscious work on them overnight. Capture any insights that emerge in the morning.
        </p>
      </motion.div>
    </div>
  )
}
