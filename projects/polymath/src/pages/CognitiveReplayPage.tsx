/**
 * Cognitive Replay Page
 * "What was I thinking?" — reconstructs a narrative of the user's mental state
 * for a selected time window using their captures, reading, and projects.
 */

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { SubtleBackground } from '../components/SubtleBackground'
import { BookOpen, Calendar, Brain, TrendingUp, TrendingDown, Minus, ChevronDown, Zap, WifiOff } from 'lucide-react'
import { cn } from '../lib/utils'

interface EmotionalPoint {
  date: string
  tone: string
  title: string
}

interface ActiveProject {
  title: string
  status: string
  momentum: 'rising' | 'steady' | 'fading'
}

interface ReplayChapter {
  period: { start: string; end: string }
  title: string
  narrative: string
  emotionalArc: EmotionalPoint[]
  dominantThemes: string[]
  activeProjects: ActiveProject[]
  breakthroughs: string[]
  memoryCount: number
  articleCount: number
}

type PresetPeriod = 'last-week' | 'last-month' | 'last-3-months' | 'custom'

function getPresetDates(preset: PresetPeriod): { start: string; end: string } {
  const end = new Date()
  const start = new Date()

  switch (preset) {
    case 'last-week':
      start.setDate(start.getDate() - 7)
      break
    case 'last-month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'last-3-months':
      start.setMonth(start.getMonth() - 3)
      break
    default:
      start.setMonth(start.getMonth() - 1)
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

const TONE_COLORS: Record<string, string> = {
  excited: 'bg-brand-primary',
  curious: 'bg-brand-primary',
  focused: 'bg-brand-primary',
  reflective: 'bg-brand-primary/60',
  anxious: 'bg-brand-primary',
  frustrated: 'bg-brand-primary/40',
  calm: 'bg-brand-primary/80',
  neutral: 'bg-slate-400',
  inspired: 'bg-brand-primary',
  determined: 'bg-brand-primary',
}

function getToneColor(tone: string): string {
  const key = tone.toLowerCase().trim()
  return TONE_COLORS[key] || 'bg-slate-400'
}

const MomentumIcon = ({ momentum }: { momentum: string }) => {
  switch (momentum) {
    case 'rising': return <TrendingUp className="w-4 h-4 text-brand-primary" />
    case 'fading': return <TrendingDown className="w-4 h-4 text-brand-primary" />
    default: return <Minus className="w-4 h-4 text-slate-400" />
  }
}

export function CognitiveReplayPage() {
  const [chapter, setChapter] = useState<ReplayChapter | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<PresetPeriod>('last-month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const generateReplay = useCallback(async () => {
    if (isOffline) return

    setLoading(true)
    setError(null)

    try {
      const dates = selectedPreset === 'custom'
        ? { start: customStart, end: customEnd }
        : getPresetDates(selectedPreset)

      if (!dates.start || !dates.end) {
        setError('Please select a date range')
        setLoading(false)
        return
      }

      const response = await fetch('/api/memories?action=replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: dates.start, end_date: dates.end }),
      })

      if (!response.ok) throw new Error('Failed to generate replay')

      const data = await response.json()
      setChapter(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [selectedPreset, customStart, customEnd, isOffline])

  const presets = [
    { id: 'last-week' as PresetPeriod, label: 'Last Week' },
    { id: 'last-month' as PresetPeriod, label: 'Last Month' },
    { id: 'last-3-months' as PresetPeriod, label: 'Last 3 Months' },
    { id: 'custom' as PresetPeriod, label: 'Custom' },
  ]

  return (
    <div className="min-h-screen pb-20 relative" style={{ paddingTop: '5.5rem' }}>
      <SubtleBackground />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold premium-text-platinum tracking-tight">Cognitive Replay</h1>
          <p className="text-[var(--brand-text-secondary)] text-sm mt-1">Reconstruct what you were thinking</p>
        </div>

        {isOffline && (
          <Card className="mb-6 border-brand-primary/20 bg-brand-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-brand-primary" />
              <p className="text-sm text-brand-primary">Replay requires a connection to generate narratives.</p>
            </CardContent>
          </Card>
        )}

        {/* Period Selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedPreset(preset.id)
                setShowCustom(preset.id === 'custom')
              }}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all border',
                selectedPreset === preset.id
                  ? 'bg-brand-primary/20 text-brand-primary border-brand-primary/30'
                  : 'bg-[var(--glass-surface)] text-[var(--brand-text-secondary)] border-[var(--glass-surface-hover)] hover:bg-[rgba(255,255,255,0.1)]'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        <AnimatePresence>
          {showCustom && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex gap-3"
            >
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-primary)] text-sm"
              />
              <span className="text-[var(--brand-text-muted)] self-center">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-[var(--brand-text-primary)] text-sm"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generate Button */}
        <Button
          onClick={generateReplay}
          disabled={loading || isOffline}
          className="w-full mb-8 btn-primary rounded-xl py-3 text-base font-semibold flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
              Reconstructing your thoughts...
            </>
          ) : (
            <>
              <Brain className="w-5 h-5" />
              Generate Replay
            </>
          )}
        </Button>

        {error && (
          <Card className="mb-6 border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 text-sm text-red-300">{error}</CardContent>
          </Card>
        )}

        {/* The Chapter */}
        <AnimatePresence mode="wait">
          {chapter && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', damping: 25 }}
              className="space-y-6"
            >
              {/* Chapter Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold uppercase tracking-wider mb-4">
                  <BookOpen className="w-3 h-3" />
                  {new Date(chapter.period.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(chapter.period.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold premium-text-platinum leading-tight">
                  {chapter.title}
                </h2>
                <p className="text-[var(--brand-text-muted)] text-sm mt-2">
                  {chapter.memoryCount} captures, {chapter.articleCount} articles
                </p>
              </div>

              {/* Narrative */}
              <Card className="premium-card overflow-hidden">
                <CardContent className="p-8 md:p-10">
                  <div className="prose prose-invert max-w-none">
                    {chapter.narrative.split('\n\n').map((paragraph, i) => (
                      <p key={i} className="text-[var(--brand-text-secondary)] leading-relaxed text-base mb-4 last:mb-0">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Emotional Arc */}
              {chapter.emotionalArc.length > 0 && (
                <Card className="premium-card overflow-hidden">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Emotional Arc
                    </h3>
                    <div className="space-y-2">
                      {chapter.emotionalArc.map((point, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="text-xs text-[var(--brand-text-muted)] w-16 flex-shrink-0">{point.date}</span>
                          <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', getToneColor(point.tone))} />
                          <span className="text-xs font-medium text-[var(--brand-text-secondary)] capitalize w-20 flex-shrink-0">{point.tone}</span>
                          <span className="text-xs text-[var(--brand-text-muted)] truncate">{point.title}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Themes + Projects Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dominant Themes */}
                {chapter.dominantThemes.length > 0 && (
                  <Card className="premium-card">
                    <CardContent className="p-6">
                      <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Dominant Themes
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {chapter.dominantThemes.map(theme => (
                          <span
                            key={theme}
                            className="px-3 py-1.5 rounded-lg bg-[var(--glass-surface)] border border-[var(--glass-surface-hover)] text-xs font-medium text-[var(--brand-text-secondary)]"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Active Projects */}
                {chapter.activeProjects.length > 0 && (
                  <Card className="premium-card">
                    <CardContent className="p-6">
                      <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Projects in Play
                      </h3>
                      <div className="space-y-3">
                        {chapter.activeProjects.map(project => (
                          <div key={project.title} className="flex items-center justify-between">
                            <span className="text-sm text-[var(--brand-text-secondary)]">{project.title}</span>
                            <div className="flex items-center gap-2">
                              <MomentumIcon momentum={project.momentum} />
                              <span className="text-xs text-[var(--brand-text-muted)] capitalize">{project.momentum}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Breakthroughs */}
              {chapter.breakthroughs.length > 0 && (
                <Card className="premium-card border-brand-primary/20">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Breakthrough Moments
                    </h3>
                    <ul className="space-y-2">
                      {chapter.breakthroughs.map((b, i) => (
                        <li key={i} className="text-sm text-[var(--brand-text-secondary)] flex items-start gap-2">
                          <span className="text-brand-primary mt-1">*</span>
                          {b}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
