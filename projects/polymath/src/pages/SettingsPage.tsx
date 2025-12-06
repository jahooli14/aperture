/**
 * Settings Page - Access to secondary features
 * Timeline, Galaxy, Analysis, and other tools
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Settings,
  ChevronRight,
  Lightbulb,
  ListChecks,
  Rss,
  Palette,
  Check,
  Moon,
  Map,
  Search,
  Bug,
  ToggleRight,
  ToggleLeft,
  Zap,
  RefreshCw,
  Trash2,
  Loader2
} from 'lucide-react'
import { useThemeStore, type AccentColor, type ThemeIntensity, type FontSize } from '../stores/useThemeStore'
import { getAvailableColors, getColorPreview } from '../lib/theme'
import { SubtleBackground } from '../components/SubtleBackground'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/toast'

// ... (keep existing interfaces)

interface Capability {
  id: string
  name: string
  description: string
  strength: number
}

const intensityOptions = [
  { value: 'subtle' as const, label: 'Subtle', description: 'Minimal visual effects' },
  { value: 'balanced' as const, label: 'Balanced', description: 'Default experience' },
  { value: 'vibrant' as const, label: 'Vibrant', description: 'Enhanced visuals' }
]

const fontSizeOptions = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' }
]

export function SettingsPage() {
  const navigate = useNavigate()
  const { accentColor, intensity, fontSize, showBugTracker, setAccentColor, setIntensity, setFontSize, setShowBugTracker } = useThemeStore()
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
        description: `Found ${result.extracted?.length || 0} new capabilities`,
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

  // ... (keep existing options setup)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
      {/* ... (keep header) */}
      
      <div className="min-h-screen pb-24" style={{ paddingTop: '5.5rem' }}>
        {/* ... (keep Explore More section) */}

        {/* Options Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          {/* ... (keep existing grid) */}
        </section>

        {/* Capabilities Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Zap className="h-6 w-6" style={{ color: 'var(--premium-gold)' }} />
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--premium-text-primary)' }}>
                    Your Capabilities
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                    Skills and interests extracted from your projects
                  </p>
                </div>
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

            {loadingCaps ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : capabilities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {capabilities.map(cap => (
                  <div
                    key={cap.id}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all hover:border-red-500/30 hover:bg-red-500/5"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      borderColor: 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <span className="text-sm font-medium premium-text-platinum">
                      {cap.name}
                    </span>
                    <button
                      onClick={() => handleDeleteCapability(cap.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No capabilities found. Try refreshing to analyze your data.
              </div>
            )}
          </div>
        </section>

        {/* Theme Customization */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 rounded-xl backdrop-blur-xl" style={{
            background: 'var(--premium-bg-2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}>
          <div className="flex items-center gap-3 mb-6">
            <Palette className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <h2
              className="text-2xl font-bold"
              style={{ color: 'var(--premium-text-primary)' }}
            >
              Theme customization
            </h2>
          </div>

          {/* Accent Color */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              Accent color
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {getAvailableColors().map((color) => {
                const preview = getColorPreview(color)
                const isSelected = accentColor === color
                return (
                  <button
                    key={color}
                    onClick={() => setAccentColor(color)}
                    className="relative aspect-square rounded-xl transition-transform hover:scale-110 active:scale-95"
                    style={{
                      background: `linear-gradient(135deg, ${preview.primary}, ${preview.light})`
                    }}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="h-8 w-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                    <div className="sr-only">{color}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Intensity */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              Intensity
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {intensityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setIntensity(option.value)}
                  className="p-4 rounded-xl backdrop-blur-xl transition-all text-center"
                  style={{
                    background: intensity === option.value ? 'var(--premium-bg-3)' : 'var(--premium-bg-2)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                  }}
                >
                  <div className="font-semibold mb-1 premium-text-platinum">
                    {option.label}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--premium-text-secondary)' }}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 premium-text-platinum">
              Font size
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {fontSizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFontSize(option.value)}
                  className="p-4 rounded-xl backdrop-blur-xl transition-all text-center"
                  style={{
                    background: fontSize === option.value ? 'var(--premium-bg-3)' : 'var(--premium-bg-2)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
                    fontSize: option.value === 'small' ? '14px' : option.value === 'large' ? '18px' : '16px'
                  }}
                >
                  <div className="font-semibold premium-text-platinum">
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bug Tracker Toggle */}
          <div className="pt-6 border-t border-white/10">
            <button
              onClick={() => setShowBugTracker(!showBugTracker)}
              className="w-full flex items-center gap-4 p-4 rounded-xl backdrop-blur-xl transition-all text-left"
              style={{
                background: 'var(--premium-bg-2)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{
                background: 'rgba(239, 68, 68, 0.2)'
              }}>
                <Bug className="w-6 h-6" style={{ color: '#ef4444' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold premium-text-platinum">
                  Bug Tracker
                </h3>
                <p style={{ color: 'var(--premium-text-secondary)', fontSize: '0.875rem' }}>
                  {showBugTracker ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div>
                {showBugTracker ? (
                  <ToggleRight className="w-6 h-6" style={{ color: '#10b981' }} />
                ) : (
                  <ToggleLeft className="w-6 h-6" style={{ color: 'var(--premium-text-secondary)' }} />
                )}
              </div>
            </button>
          </div>
          </div>
        </section>
      </div>
    </motion.div>
  )
}
