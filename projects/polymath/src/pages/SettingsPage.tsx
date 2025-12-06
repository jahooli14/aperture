import React, { useEffect, useState } from 'react'
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

// ... existing interfaces
interface SettingsOption {
  id: string
  label: string
  description: string
  icon: any
  path: string
  color: string
  glow: string
}

interface Capability {
  id: string
  name: string
  description: string
  strength: number
  last_used?: string
}

// ... existing options
const SETTINGS_OPTIONS: SettingsOption[] = [
  {
    id: 'map',
    label: 'Knowledge map',
    description: 'Geographic visualization with glowing doors of opportunity',
    icon: Map,
    path: '/map',
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.4)'
  },
  // ... other options
  {
    id: 'suggestions',
    label: 'Discover projects',
    description: 'AI-powered project recommendations from your knowledge',
    icon: Lightbulb,
    path: '/suggestions',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)'
  },
  {
    id: 'bedtime',
    label: 'Bedtime ideas',
    description: 'Trippy prompts for creative subconscious thinking (9:30pm daily)',
    icon: Moon,
    path: '/bedtime',
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.4)'
  },
  {
    id: 'rss',
    label: 'Auto-import',
    description: 'RSS feeds & email newsletters auto-added to reading queue',
    icon: Rss,
    path: '/rss',
    color: '#f97316',
    glow: 'rgba(249, 115, 22, 0.4)'
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Chronological view of your knowledge journey',
    icon: Calendar,
    path: '/knowledge-timeline',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)'
  },
  {
    id: 'galaxy',
    label: 'Galaxy view',
    description: 'Explore connections in 3D space',
    icon: Sparkles,
    path: '/constellation',
    color: '#8b5cf6',
    glow: 'rgba(139, 92, 246, 0.4)'
  },
  {
    id: 'insights',
    label: 'Analysis',
    description: 'Deep insights and patterns in your data',
    icon: TrendingUp,
    path: '/insights',
    color: '#10b981',
    glow: 'rgba(16, 185, 129, 0.4)'
  }
]

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
    >
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
            <Settings className="h-7 w-7" style={{ color: 'var(--premium-blue)', opacity: 0.7 }} />
            <h1 className="text-2xl sm:text-3xl" style={{
              fontWeight: 600,
              letterSpacing: 'var(--premium-tracking-tight)',
              color: 'var(--premium-text-secondary)',
              opacity: 0.7
            }}>
              Settings
            </h1>
          </div>
          <button
            onClick={() => navigate('/search')}
            className="h-10 w-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/5"
            style={{
              color: 'var(--premium-blue)'
            }}
            title="Search everything"
          >
            <Search className="h-5 w-5" />
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
              Explore <span style={{ color: 'var(--premium-blue)' }}>more</span>
            </h2>
            <p className="mt-2 text-lg" style={{ color: 'var(--premium-text-secondary)' }}>
              Advanced views and analysis tools
            </p>
          </div>
        </section>

        {/* Options Grid */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
          <div className="grid grid-cols-1 gap-4">
            {SETTINGS_OPTIONS.map((option, index) => {
              const Icon = option.icon
              return (
                <motion.button
                  key={option.id}
                  onClick={() => navigate(option.path)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 rounded-xl backdrop-blur-xl transition-all duration-300 text-left group relative"
                  style={{
                    background: 'var(--premium-bg-2)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--premium-bg-3)'
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--premium-bg-2)'
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <div
                    className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl pointer-events-none"
                    style={{ backgroundColor: option.glow }}
                  />

                  <div className="relative z-10 flex items-center gap-4">
                    <div
                      className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${option.glow}, transparent)`
                      }}
                    >
                      <Icon
                        className="w-7 h-7"
                        style={{ color: option.color }}
                      />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 premium-text-platinum">
                        {option.label}
                      </h3>
                      <p style={{ color: 'var(--premium-text-secondary)' }}>
                        {option.description}
                      </p>
                    </div>

                    <ChevronRight
                      className="w-6 h-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                      style={{ color: 'var(--premium-platinum)' }}
                    />
                  </div>
                </motion.button>
              )
            })}
          </div>
        </section>

        {/* Capabilities Section (RPG Style) */}
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
                    Skills and interests extracted from your projects (RPG Stats)
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {capabilities.map(cap => {
                  // Calculate RPG stats
                  const level = Math.floor(cap.strength)
                  const progress = (cap.strength - level) * 100
                  const daysSinceUse = cap.last_used 
                    ? Math.floor((Date.now() - new Date(cap.last_used).getTime()) / (1000 * 60 * 60 * 24))
                    : 0
                  const isDecaying = daysSinceUse > 30
                  
                  return (
                    <div
                      key={cap.id}
                      className="group relative overflow-hidden rounded-xl p-4 transition-all border hover:scale-[1.02]"
                      style={{
                        background: isDecaying 
                          ? 'linear-gradient(135deg, rgba(120, 50, 50, 0.1), rgba(80, 40, 40, 0.2))'
                          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.05), rgba(255, 255, 255, 0.02))',
                        borderColor: isDecaying 
                          ? 'rgba(150, 50, 50, 0.3)' 
                          : level >= 5 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                        boxShadow: level >= 5 ? '0 0 15px rgba(255, 215, 0, 0.1)' : 'none'
                      }}
                    >
                      {/* Level Badge */}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <span className="text-xs font-mono opacity-50 uppercase tracking-wider">LVL {level}</span>
                        {level >= 5 && <Sparkles className="h-3 w-3 text-yellow-400" />}
                      </div>

                      <h3 className="font-bold text-base mb-1" style={{ 
                        color: isDecaying ? 'rgba(255, 200, 200, 0.8)' : 'var(--premium-text-primary)' 
                      }}>
                        {cap.name}
                      </h3>
                      
                      <p className="text-xs line-clamp-2 mb-3 h-8" style={{ color: 'var(--premium-text-secondary)' }}>
                        {cap.description}
                      </p>

                      {/* XP Bar */}
                      <div className="relative h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-500"
                          style={{ 
                            width: `${progress}%`,
                            background: isDecaying ? '#ef4444' : level >= 5 ? '#fbbf24' : '#3b82f6'
                          }}
                        />
                      </div>
                      
                      {/* Footer Status */}
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px]" style={{ color: isDecaying ? '#fca5a5' : 'var(--premium-text-tertiary)' }}>
                          {isDecaying ? `${daysSinceUse}d dormant (Rusting)` : 'Active'}
                        </span>
                        <button
                          onClick={() => handleDeleteCapability(cap.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/20"
                          title="Remove Capability"
                        >
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  )
                })}
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