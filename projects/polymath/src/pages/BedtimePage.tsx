/**
 * Bedtime Ideas Page
 * Creative prompts for subconscious synthesis
 * Generated at 9:30pm daily
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Moon, Eye, EyeOff, RefreshCw, Loader2, Star, Maximize2, Link2, Search, Zap, StarIcon, Wind, WifiOff } from 'lucide-react'
import { useToast } from '../components/ui/toast'
import { SubtleBackground } from '../components/SubtleBackground'
import { ZenMode } from '../components/bedtime/ZenMode'
import { DriftMode } from '../components/bedtime/DriftMode'
import { readingDb } from '../lib/db'

interface BedtimePrompt {
  id: string
  prompt: string
  type: 'connection' | 'divergent' | 'revisit' | 'transform'
  format?: 'question' | 'statement' | 'visualization' | 'scenario' | 'incubation'
  metaphor?: string
  context?: string
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
  const [driftModeOpen, setDriftModeOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
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
      // 1. Load from cache first (instant)
      const cached = await readingDb.getDashboard('bedtime')
      if (cached) {
        const rawPrompts = cached.prompts || []
        const uniquePrompts = rawPrompts.map((p: any, index: number) => ({
          ...p,
          id: p.id || `generated-${Date.now()}-${index}`,
          _uniqueId: `${p.id || 'no-id'}-${index}`
        }))
        setPrompts(uniquePrompts)
        setMessage(cached.message || '')
        setLoading(false)
      }

      // 2. If offline, stop here
      if (!navigator.onLine) {
        setIsOffline(true)
        if (!cached) setLoading(false)
        return
      }

      // 3. Fetch fresh data from network
      setIsOffline(false)
      const response = await fetch('/api/projects?resource=bedtime')
      const data = await response.json()

      // Ensure unique IDs to prevent feedback applying to all items
      const rawPrompts = data.prompts || []
      const uniquePrompts = rawPrompts.map((p: any, index: number) => ({
        ...p,
        // Fallback to index-based ID if ID is missing or potential duplicate
        id: p.id || `generated-${Date.now()}-${index}`,
        _uniqueId: `${p.id || 'no-id'}-${index}` // Internal unique key
      }))

      setPrompts(uniquePrompts)
      setMessage(data.message || '')

      // 4. Cache for offline use
      await readingDb.cacheDashboard('bedtime', data)
    } catch (error) {
      if (prompts.length === 0) {
        addToast({
          title: 'Failed to load prompts',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const generateNew = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/projects?resource=bedtime', { method: 'POST' })
      const data = await response.json()

      // Ensure unique IDs
      const rawPrompts = data.prompts || []
      const uniquePrompts = rawPrompts.map((p: any, index: number) => ({
        ...p,
        id: p.id || `generated-${Date.now()}-${index}`,
        _uniqueId: `${p.id || 'no-id'}-${index}`
      }))

      setPrompts(uniquePrompts)
      addToast({
        title: ' New prompts generated',
        description: `${uniquePrompts.length} ideas for tonight`,
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

      // Update prompt type scoring
      if (prompt?.type) {
        fetch('/api/projects?resource=bedtime&action=update-type-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt_type: prompt.type,
            is_breakthrough: !prompt.resulted_in_breakthrough // toggling
          })
        }).catch(console.warn)
      }

      if (newValue) {
        addToast({
          title: ' Breakthrough!',
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
      case 'divergent': return <Zap className="h-5 w-5" />
      case 'revisit': return <Eye className="h-5 w-5" />
      case 'transform': return <Star className="h-5 w-5" />
      default: return <Moon className="h-5 w-5" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'connection': return 'var(--brand-primary)'
      case 'divergent': return 'var(--brand-primary)'
      case 'revisit': return 'var(--brand-primary)'
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
      {/* Deep night wash — bedtime page should *look* like night.
          Indigo gradient, no daytime cyan orbs. Replaces SubtleBackground. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(56, 28, 135, 0.32), transparent 60%), radial-gradient(ellipse 80% 50% at 70% 100%, rgba(15, 24, 41, 0.6), transparent 70%), linear-gradient(180deg, #0a0820 0%, #0a0e18 100%)',
        }}
      />

      {/* Fixed Header — softer, less daylight */}
      <div
        className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(10, 8, 32, 0.7)',
          paddingTop: 'env(safe-area-inset-top)',
          borderBottom: '1px solid rgba(255,255,255,0.04)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Moon className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0 opacity-80" style={{ color: '#c7b8ff' }} />
              <h1
                className="truncate"
                style={{
                  fontFamily: 'var(--brand-font-serif)',
                  fontWeight: 500,
                  fontSize: '1.125rem',
                  letterSpacing: '-0.018em',
                  color: 'rgba(255, 255, 255, 0.92)',
                }}
              >
                Bedtime
              </h1>
            </div>
            <button className="h-11 w-11 flex items-center justify-center rounded-full hover:bg-white/[0.06] transition-colors flex-shrink-0" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <Search className="h-4 w-4 opacity-70" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pb-24 px-4 relative" style={{ paddingTop: 'calc(6rem + env(safe-area-inset-top))' }}>
        {/* Starfield — twinkling pinpricks of light */}
        <div className="fixed inset-0 pointer-events-none opacity-50">
          {[
            { top: '8%',  left: '12%', delay: 0 },
            { top: '18%', left: '78%', delay: 1.4 },
            { top: '32%', left: '24%', delay: 2.8 },
            { top: '46%', left: '68%', delay: 0.7 },
            { top: '58%', left: '14%', delay: 2.1 },
            { top: '70%', left: '82%', delay: 3.4 },
            { top: '82%', left: '38%', delay: 1.0 },
            { top: '12%', left: '52%', delay: 4.0 },
            { top: '38%', left: '88%', delay: 2.4 },
            { top: '64%', left: '46%', delay: 5.2 },
          ].map((s, i) => (
            <div
              key={i}
              className="absolute h-[2px] w-[2px] rounded-full bg-white animate-pulse"
              style={{
                top: s.top,
                left: s.left,
                animationDelay: `${s.delay}s`,
                animationDuration: '4s',
                boxShadow: '0 0 4px rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </div>

        {/* Header Info */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: showWelcome ? 1 : 0, y: showWelcome ? 0 : -12 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-2xl mx-auto mb-8 relative z-10"
        >
          <div className="mb-5">
            <h2
              style={{
                fontFamily: 'var(--brand-font-serif)',
                fontWeight: 500,
                fontSize: 'clamp(2rem, 5.5vw, 2.5rem)',
                letterSpacing: '-0.022em',
                lineHeight: 1.1,
                color: 'rgba(255, 255, 255, 0.95)',
              }}
            >
              Thoughts before bed.
            </h2>
            <p
              className="mt-3 italic text-base"
              style={{
                fontFamily: 'var(--brand-font-serif)',
                color: 'rgba(199, 184, 255, 0.75)',
                fontWeight: 400,
              }}
            >
              Let your mind wander into tomorrow's inspiration.
            </p>
          </div>

          {/* Time indicator */}
          <div className="premium-glass-subtle rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-sm font-semibold premium-text-platinum">
                  {prompts.length > 0 ? "Tonight's Prompts Ready" : "Waiting for 9:30pm"}
                </p>
                {message && (
                  <p className="text-xs mt-0.5 text-[var(--brand-text-secondary)]">
                    {message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {prompts.length > 0 && (
                <>
                  <button
                    onClick={() => setDriftModeOpen(true)}
                    className="min-h-[44px] px-3 rounded-lg transition-all premium-glass-subtle hover:bg-[rgba(255,255,255,0.1)] flex items-center gap-1.5"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    title="Drift Mode"
                  >
                    <Wind className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--brand-primary)" }}>Drift</span>
                  </button>
                  <button
                    onClick={() => setZenModeOpen(true)}
                    className="min-h-[44px] px-3 rounded-lg transition-all premium-glass-subtle hover:bg-[rgba(255,255,255,0.1)] flex items-center gap-1.5"
                    style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                    title="Zen Mode"
                  >
                    <Maximize2 className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--brand-primary)" }}>Zen</span>
                  </button>
                </>
              )}
              <button
                onClick={generateNew}
                disabled={generating}
                className="h-11 w-11 flex items-center justify-center rounded-lg transition-all premium-glass-subtle hover:bg-[rgba(255,255,255,0.1)]"
                style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                title="Refresh prompts"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--brand-primary)" }} />
                ) : (
                  <RefreshCw className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                )}
              </button>
            </div>
          </div>

          {/* Cross-link to daytime drift mode — small & unobtrusive */}
          <div className="mt-2 flex justify-end">
            <Link
              to="/memories"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] transition-opacity hover:opacity-100"
              style={{ color: 'rgba(var(--brand-primary-rgb),0.55)', opacity: 0.75 }}
            >
              <Wind className="h-3 w-3" />
              drift mode
            </Link>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--brand-primary)" }} />
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
                    className="premium-card p-4 sm:p-6 relative overflow-hidden group cursor-pointer"
                    style={{
                      border: `2px solid ${getTypeColor(prompt.type)}40`,
                      opacity: isViewed ? 0.6 : 1,
                      boxShadow: `0 10px 40px ${getTypeColor(prompt.type)}15`
                    }}
                  >
                    {/* Background glow - stronger on hover */}
                    <div
                      className="absolute inset-0 opacity-20 transition-opacity duration-700"
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
                          className="p-2 rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                          title={isViewed ? 'Viewed' : 'Mark as viewed'}
                        >
                          {isViewed ? (
                            <EyeOff className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                          ) : (
                            <Eye className="h-4 w-4" style={{ color: "var(--brand-primary)" }} />
                          )}
                        </button>
                      </div>

                      {/* Prompt text */}
                      <p className="text-base sm:text-lg leading-relaxed premium-text-platinum mb-4">
                        {prompt.prompt}
                      </p>

                      {/* Metaphor hint */}
                      {prompt.metaphor && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-surface)' }}>
                          <div className="flex items-start gap-2">
                            <Star className="h-3 w-3 mt-1 flex-shrink-0" style={{ color: "var(--brand-primary)" }} />
                            <p className="text-xs italic" style={{ color: "var(--brand-primary)" }}>
                              {prompt.metaphor}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Feedback Section */}
                      <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--glass-surface)' }}>
                        <div className="flex items-center justify-between">
                          {/* Star Rating */}
                          <div className="flex items-center gap-1">
                            <span className="text-xs mr-2" style={{ color: "var(--brand-primary)" }}>
                              Rate:
                            </span>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  ratePrompt(prompt.id, star)
                                }}
                                className="h-9 w-9 flex items-center justify-center rounded-lg hover:scale-110 hover:bg-white/5 transition-all"
                                title={`${star} star${star !== 1 ? 's' : ''}`}
                              >
                                <Star
                                  className="h-5 w-5"
                                  style={{
                                    color: (prompt.rating && star <= prompt.rating)
                                      ? 'var(--premium-gold)'
                                      : 'rgba(255, 255, 255, 0.25)',
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${prompt.resulted_in_breakthrough
                              ? 'bg-gradient-to-r from-brand-primary/20 to-brand-primary/20 border border-brand-primary/40'
                              : 'border border-[var(--glass-surface-hover)] hover:border-brand-primary/30'
                              }`}
                            title={prompt.resulted_in_breakthrough ? 'Led to a breakthrough!' : 'Mark as breakthrough'}
                          >
                            <Zap
                              className="h-3.5 w-3.5"
                              style={{
                                color: prompt.resulted_in_breakthrough
                                  ? 'var(--premium-gold)'
                                  : 'var(--brand-text-muted)'
                              }}
                            />
                            <span
                              style={{
                                color: prompt.resulted_in_breakthrough
                                  ? 'var(--premium-gold)'
                                  : 'var(--brand-text-muted)'
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

        <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center justify-center p-3 mb-6 rounded-full bg-[var(--glass-surface)] backdrop-blur-xl border border-[var(--glass-surface-hover)] shadow-2xl">
              <Moon className="w-8 h-8 text-brand-primary" />
            </div>

            <h1 className="text-4xl md:text-5xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-brand-primary via-brand-primary to-brand-primary mb-6 tracking-tight drop-shadow-[0_0_15px_rgba(var(--brand-primary-rgb),0.3)]">
              Bedtime Ideas
            </h1>

            <p className="text-lg md:text-xl text-brand-primary/80 leading-relaxed font-light max-w-lg mx-auto mb-8">
              Gentle prompts generated from your day's activity to <span className="text-brand-primary font-medium">prime your subconscious</span> for sleep.
              <br />
              <span className="text-sm text-brand-primary/60 mt-2 block">
                Insights often arrive in the morning.
              </span>
            </p>
          </motion.div>
        </div>

        {/* Empty state */}
        {!loading && prompts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-md mx-auto text-center py-16"
          >
            {isOffline ? (
              <>
                <div className="p-8 rounded-full premium-glass-subtle inline-flex mb-6">
                  <WifiOff className="h-12 w-12" style={{ color: "var(--brand-primary)" }} />
                </div>
                <h2 className="text-xl font-semibold premium-text-platinum mb-2">
                  Offline
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--brand-primary)" }}>
                  Bedtime prompts will be available when you're back online
                </p>
              </>
            ) : (
              <>
                <div className="p-8 rounded-full premium-glass-subtle inline-flex mb-6">
                  <Moon className="h-12 w-12" style={{ color: "var(--brand-primary)" }} />
                </div>
                <h2 className="text-xl font-semibold premium-text-platinum mb-2">
                  No prompts yet
                </h2>
                <p className="text-sm mb-6" style={{ color: "var(--brand-primary)" }}>
                  {message || 'Check back at 9:30pm for tonight\'s ideas'}
                </p>
                <button
                  onClick={generateNew}
                  disabled={generating}
                  className="px-6 py-3 rounded-lg transition-all inline-flex items-center gap-2"
                  style={{
                    background: 'var(--brand-primary)',
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
                      Generate Now
                    </>
                  )}
                </button>
              </>
            )}
          </motion.div>
        )}

        {/* Footer tip - Enhanced with warmth */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: showWelcome ? 1 : 0, y: showWelcome ? 0 : 20 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="max-w-2xl mx-auto mt-12 p-6 rounded-xl premium-glass-subtle text-center relative z-10 border-2"
          style={{
            borderColor: 'rgba(var(--brand-primary-rgb), 0.2)',
            background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.05), rgba(var(--brand-primary-rgb), 0.05))'
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: "var(--brand-primary)" }}>
            <strong className="premium-text-platinum">Reflection ritual:</strong> These prompts are designed to spark gentle curiosity before sleep. Let them simmer in your subconscious overnightinsights often arrive in the morning. Try Zen Mode for a peaceful, one-at-a-time experience.
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

        {/* Drift Mode */}
        {driftModeOpen && prompts.length > 0 && (
          <DriftMode
            prompts={prompts}
            onClose={() => setDriftModeOpen(false)}
          />
        )}
      </div>
    </motion.div>
  )
}