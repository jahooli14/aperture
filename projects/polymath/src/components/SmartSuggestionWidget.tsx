/**
 * Smart Suggestion Widget
 * AI-powered "What Should I Do Right Now?" component
 * Provides context-aware suggestions based on time, energy, and project status
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Clock, Battery, ChevronRight, RefreshCw, Loader2, Brain, BookOpen, Edit, Moon, Lightbulb } from 'lucide-react'
import { haptic } from '../utils/haptics'

interface SmartSuggestion {
  type: 'project' | 'reading' | 'capture' | 'review' | 'rest'
  title: string
  description: string
  reasoning: string
  item?: any
  estimatedTime?: number
  energyLevel?: string
  priority: number
  action_url?: string
}

interface SuggestionResponse {
  suggestion: SmartSuggestion
  alternatives: SmartSuggestion[]
  context: {
    timeOfDay: string
    isWeekend: boolean
    hour: number
    dayOfWeek: number
  }
}

export function SmartSuggestionWidget() {
  const navigate = useNavigate()
  const [suggestion, setSuggestion] = useState<SmartSuggestion | null>(null)
  const [alternatives, setAlternatives] = useState<SmartSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showAlternatives, setShowAlternatives] = useState(false)

  useEffect(() => {
    fetchSuggestion()
  }, [])

  const fetchSuggestion = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/analytics?resource=smart-suggestion')
      if (response.ok) {
        const data: SuggestionResponse = await response.json()
        setSuggestion(data.suggestion)
        setAlternatives(data.alternatives || [])
      }
    } catch (error) {
      console.error('Failed to fetch smart suggestion:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (sug: SmartSuggestion) => {
    haptic.light()
    if (sug.action_url) {
      navigate(sug.action_url)
    }
  }

  const handleRefresh = () => {
    haptic.light()
    fetchSuggestion()
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Lightbulb className="h-5 w-5" />
      case 'reading':
        return <BookOpen className="h-5 w-5" />
      case 'capture':
        return <Edit className="h-5 w-5" />
      case 'review':
        return <Brain className="h-5 w-5" />
      case 'rest':
        return <Moon className="h-5 w-5" />
      default:
        return <Lightbulb className="h-5 w-5" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'project':
        return {
          primary: 'var(--premium-blue)',
          bg: 'rgba(59, 130, 246, 0.15)',
          border: 'rgba(59, 130, 246, 0.3)'
        }
      case 'reading':
        return {
          primary: 'var(--premium-emerald)',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)'
        }
      case 'capture':
        return {
          primary: 'var(--premium-indigo)',
          bg: 'rgba(99, 102, 241, 0.15)',
          border: 'rgba(99, 102, 241, 0.3)'
        }
      case 'rest':
        return {
          primary: 'var(--premium-text-tertiary)',
          bg: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)'
        }
      default:
        return {
          primary: 'var(--premium-amber)',
          bg: 'rgba(245, 158, 11, 0.15)',
          border: 'rgba(245, 158, 11, 0.3)'
        }
    }
  }

  const getEnergyColor = (level?: string) => {
    switch (level) {
      case 'high':
        return 'var(--premium-blue)'
      case 'moderate':
        return 'var(--premium-amber)'
      case 'low':
        return 'var(--premium-emerald)'
      default:
        return 'var(--premium-text-tertiary)'
    }
  }

  if (loading) {
    return (
      <div className="premium-card p-8">
        <div className="flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--premium-blue)' }} />
          <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
            Analyzing your context...
          </p>
        </div>
      </div>
    )
  }

  if (!suggestion) {
    return null
  }

  const colors = getTypeColor(suggestion.type)

  return (
    <div className="space-y-4">
      {/* Main Suggestion Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="premium-card overflow-hidden"
        style={{ borderColor: colors.border }}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: colors.bg, color: colors.primary }}
              >
                {getTypeIcon(suggestion.type)}
              </div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                What should I do right now?
              </h3>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: 'var(--premium-text-tertiary)' }}
              title="Refresh suggestion"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--premium-text-secondary)' }}>
            {suggestion.reasoning}
          </p>
        </div>

        {/* Main Action */}
        <div
          onClick={() => suggestion.type !== 'rest' && handleSuggestionClick(suggestion)}
          className={`p-5 ${suggestion.type !== 'rest' ? 'cursor-pointer hover:bg-white/5 transition-all' : ''}`}
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="text-xl font-bold mb-2 premium-text-platinum">
                {suggestion.title}
              </h4>
              <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--premium-text-secondary)' }}>
                {suggestion.description}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap gap-3">
                {suggestion.estimatedTime && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: colors.bg }}>
                    <Clock className="h-4 w-4" style={{ color: colors.primary }} />
                    <span className="text-sm font-medium" style={{ color: colors.primary }}>
                      {suggestion.estimatedTime} min
                    </span>
                  </div>
                )}
                {suggestion.energyLevel && suggestion.energyLevel !== 'none' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                    <Battery className="h-4 w-4" style={{ color: getEnergyColor(suggestion.energyLevel) }} />
                    <span className="text-sm font-medium capitalize" style={{ color: getEnergyColor(suggestion.energyLevel) }}>
                      {suggestion.energyLevel} energy
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            {suggestion.type !== 'rest' && (
              <ChevronRight className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: colors.primary }} />
            )}
          </div>
        </div>

        {/* Show Alternatives Toggle */}
        {alternatives.length > 0 && (
          <div className="px-5 pb-5">
            <button
              onClick={() => {
                setShowAlternatives(!showAlternatives)
                haptic.light()
              }}
              className="w-full text-sm font-medium py-2 rounded-lg transition-colors"
              style={{
                color: 'var(--premium-text-tertiary)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)'
              }}
            >
              {showAlternatives ? 'Hide' : 'Show'} other options ({alternatives.length})
            </button>
          </div>
        )}
      </motion.div>

      {/* Alternative Suggestions */}
      <AnimatePresence>
        {showAlternatives && alternatives.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {alternatives.map((alt, index) => {
              const altColors = getTypeColor(alt.type)
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => alt.type !== 'rest' && handleSuggestionClick(alt)}
                  className={`premium-card p-4 ${alt.type !== 'rest' ? 'cursor-pointer hover:bg-white/5 transition-all' : ''}`}
                  style={{ borderColor: altColors.border }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: altColors.bg, color: altColors.primary }}
                    >
                      {getTypeIcon(alt.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold mb-1" style={{ color: 'var(--premium-text-primary)' }}>
                        {alt.title}
                      </h5>
                      <p className="text-sm line-clamp-2" style={{ color: 'var(--premium-text-secondary)' }}>
                        {alt.description}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {alt.estimatedTime && (
                          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--premium-text-tertiary)' }}>
                            <Clock className="h-3 w-3" />
                            {alt.estimatedTime}m
                          </span>
                        )}
                        {alt.energyLevel && alt.energyLevel !== 'none' && (
                          <span className="text-xs flex items-center gap-1 capitalize" style={{ color: getEnergyColor(alt.energyLevel) }}>
                            <Battery className="h-3 w-3" />
                            {alt.energyLevel}
                          </span>
                        )}
                      </div>
                    </div>
                    {alt.type !== 'rest' && (
                      <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: altColors.primary }} />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
