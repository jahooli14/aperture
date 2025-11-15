/**
 * Bedtime Ideas Page
 * Trippy prompts for creative subconscious thinking
 * Generated at 9:30pm daily
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sparkles, Eye, EyeOff, RefreshCw, Loader2, Star, Maximize2, Link2, Search, Zap, StarIcon } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { SubtleBackground } from '../components/SubtleBackground'
import { ZenMode } from '../components/bedtime/ZenMode'

interface BedtimePrompt {
  id: string
  prompt: string
  type: 'connection' | 'divergent' | 'revisit' | 'transform'
  format?: 'question' | 'statement' | 'visualization' | 'scenario' | 'incubation'
  metaphor?: string
  viewed: boolean
  rating?: number
  resulted_in_breakthrough?: boolean
  created_at: string
}

export function BedtimePage() {
  const [prompts, setPrompts] = useState<BedtimePrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const [zenModeOpen, setZenModeOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    fetchPrompts()
    // Show welcome animation after a brief delay
    const timer = setTimeout(() => setShowWelcome(true), 300)
    return () => clearTimeout(timer)
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

  const ratePrompt = async (id: string, rating: number) => {
    // Update local state optimistically
    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, rating } : p
    ))

    try {
      await fetch('/api/projects?resource=bedtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          rating
        })
      })

      addToast({
        title: 'Rating saved',
        description: `${rating} star${rating !== 1 ? 's' : ''}`,
        variant: 'success'
      })
    } catch (error) {
      console.error('Failed to rate prompt:', error)
      // Revert on error
      setPrompts(prev => prev.map(p =>
        p.id === id ? { ...p, rating: undefined } : p
      ))
    }
  }

  const toggleBreakthrough = async (id: string) => {
    const prompt = prompts.find(p => p.id === id)
    const newValue = !prompt?.resulted_in_breakthrough

    // Update local state optimistically
    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, resulted_in_breakthrough: newValue } : p
    ))

    try {
      await fetch('/api/projects?resource=bedtime', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          resulted_in_breakthrough: newValue
        })
      })

      if (newValue) {
        addToast({
          title: '⚡ Breakthrough!',
          description: 'This prompt will help improve future suggestions',
          variant: 'success'
        })
      }
    } catch (error) {
      console.error('Failed to toggle breakthrough:', error)
      // Revert on error
      setPrompts(prev => prev.map(p =>
        p.id === id ? { ...p, resulted_in_breakthrough: !newValue } : p
      ))
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'connection': return <Link2 className="h-5 w-5" />
      case 'divergent': return <Sparkles className="h-5 w-5" />
      case 'revisit': return <Eye className="h-5 w-5" />
      case 'transform': return <Star className="h-5 w-5" />
      default: return <Moon className="h-5 w-5" />
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
    <motion.div
      className="min-h-screen relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <SubtleBackground />

      {/* Fixed Header */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(15, 24, 41, 0.7)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Moon className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
              <h1 className="text-xl font-bold premium-text-platinum">
                Bedtime Ideas
              </h1>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Search className="h-5 w-5 premium-text-platinum" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-24 pb-24 px-4 relative">
        {/* Ambient starfield background */}
        <div className="fixed inset-0 pointer-events-none opacity-30">
          <div className="absolute top-10 left-10 w-1 h-1 rounded-full bg-white animate-pulse" />
          <div className="absolute top-20 right-20 w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-40 left-1/4 w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-40 right-1/3 w-1 h-1 rounded-full bg-white animate-pulse" style={{ animationDelay: '1.5s' }} />
        </div>

        {/* Header Info */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: showWelcome ? 1 : 0, y: showWelcome ? 0 : -20 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-2xl mx-auto mb-8 relative z-10"
        >
        <div className="flex items-center gap-4 mb-4">
          <motion.div
            className="p-4 rounded-2xl premium-glass-subtle relative"
            animate={{
              boxShadow: [
                '0 0 20px rgba(251, 191, 36, 0.2)',
                '0 0 30px rgba(251, 191, 36, 0.4)',
                '0 0 20px rgba(251, 191, 36, 0.2)'
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-8 w-8" style={{ color: 'var(--premium-gold)' }} />
          </motion.div>
          <div>
            <h2 className="premium-text-platinum text-2xl font-bold">
              Thoughts Before Bed
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--premium-text-secondary)' }}>
              Let your mind wander into tomorrow's inspiration
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

          <div className="flex items-center gap-2">
            {prompts.length > 0 && (
              <button
                onClick={() => setZenModeOpen(true)}
                className="px-4 py-2 rounded-lg transition-all premium-glass-subtle hover:bg-white/10 flex items-center gap-2"
                style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                title="Zen Mode"
              >
                <Maximize2 className="h-4 w-4" style={{ color: 'var(--premium-gold)' }} />
                <span className="text-xs font-medium" style={{ color: 'var(--premium-gold)' }}>Zen</span>
              </button>
            )}
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
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          <AnimatePresence>
            {prompts.map((prompt, index) => {
              const isViewed = viewedIds.has(prompt.id) || prompt.viewed

              return (
                <motion.div
                  key={prompt.id}
                  initial={{ opacity: 0, y: 30, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  transition={{
                    delay: index * 0.15,
                    duration: 0.6,
                    ease: "easeOut",
                    scale: { duration: 0.2 }
                  }}
                  className="premium-card p-6 relative overflow-hidden group cursor-pointer"
                  style={{
                    border: `2px solid ${getTypeColor(prompt.type)}40`,
                    opacity: isViewed ? 0.6 : 1,
                    boxShadow: `0 10px 40px ${getTypeColor(prompt.type)}15`
                  }}
                >
                  {/* Background glow - stronger on hover */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${getTypeColor(prompt.type)}20, transparent 70%)`
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Type badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span style={{ color: getTypeColor(prompt.type) }}>{getTypeIcon(prompt.type)}</span>
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

                    {/* Feedback Section */}
                    <div className="mt-6 pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.06)' }}>
                      <div className="flex items-center justify-between">
                        {/* Star Rating */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs mr-2" style={{ color: 'var(--premium-text-tertiary)' }}>
                            Rate:
                          </span>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={(e) => {
                                e.stopPropagation()
                                ratePrompt(prompt.id, star)
                              }}
                              className="p-1 rounded hover:scale-110 transition-transform"
                              title={`${star} star${star !== 1 ? 's' : ''}`}
                            >
                              <Star
                                className="h-4 w-4"
                                style={{
                                  color: (prompt.rating && star <= prompt.rating)
                                    ? 'var(--premium-gold)'
                                    : 'rgba(255, 255, 255, 0.2)',
                                  fill: (prompt.rating && star <= prompt.rating)
                                    ? 'var(--premium-gold)'
                                    : 'transparent'
                                }}
                              />
                            </button>
                          ))}
                        </div>

                        {/* Breakthrough Toggle */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleBreakthrough(prompt.id)
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                            prompt.resulted_in_breakthrough
                              ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/40'
                              : 'border border-white/10 hover:border-yellow-500/30'
                          }`}
                          title={prompt.resulted_in_breakthrough ? 'Led to a breakthrough!' : 'Mark as breakthrough'}
                        >
                          <Zap
                            className="h-3.5 w-3.5"
                            style={{
                              color: prompt.resulted_in_breakthrough
                                ? 'var(--premium-gold)'
                                : 'var(--premium-text-tertiary)'
                            }}
                          />
                          <span
                            style={{
                              color: prompt.resulted_in_breakthrough
                                ? 'var(--premium-gold)'
                                : 'var(--premium-text-tertiary)'
                            }}
                          >
                            {prompt.resulted_in_breakthrough ? 'Breakthrough' : 'Breakthrough?'}
                          </span>
                        </button>
                      </div>
                    </div>
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

      {/* Footer tip - Enhanced with warmth */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: showWelcome ? 1 : 0, y: showWelcome ? 0 : 20 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="max-w-2xl mx-auto mt-12 p-6 rounded-xl premium-glass-subtle text-center relative z-10 border-2"
        style={{
          borderColor: 'rgba(251, 191, 36, 0.2)',
          background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.05), rgba(139, 92, 246, 0.05))'
        }}
      >
        <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
          <strong className="premium-text-platinum">Reflection ritual:</strong> These prompts are designed to spark gentle curiosity before sleep. Let them simmer in your subconscious overnight—insights often arrive in the morning. Try Zen Mode for a peaceful, one-at-a-time experience.
        </p>
      </motion.div>

      {/* Zen Mode */}
      {zenModeOpen && prompts.length > 0 && (
        <ZenMode
          prompts={prompts}
          onClose={() => setZenModeOpen(false)}
          onMarkViewed={markViewed}
        />
      )}
      </div>
    </motion.div>
  )
}
