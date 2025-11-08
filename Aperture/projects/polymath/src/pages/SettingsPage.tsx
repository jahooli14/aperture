/**
 * Settings Page - Access to secondary features
 * Timeline, Galaxy, Analysis, and other tools
 */

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
  Moon
} from 'lucide-react'
import { useThemeStore, type AccentColor, type ThemeIntensity, type FontSize } from '../stores/useThemeStore'
import { getAvailableColors, getColorPreview } from '../lib/theme'

interface SettingsOption {
  id: string
  label: string
  description: string
  icon: any
  path: string
  color: string
  glow: string
}

const SETTINGS_OPTIONS: SettingsOption[] = [
  {
    id: 'suggestions',
    label: 'Discover Projects',
    description: 'AI-powered project recommendations from your knowledge',
    icon: Lightbulb,
    path: '/suggestions',
    color: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.4)'
  },
  {
    id: 'bedtime',
    label: 'Bedtime Ideas',
    description: 'Trippy prompts for creative subconscious thinking (9:30pm daily)',
    icon: Moon,
    path: '/bedtime',
    color: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.4)'
  },
  {
    id: 'rss',
    label: 'Auto-Import',
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
    label: 'Galaxy View',
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

export function SettingsPage() {
  const navigate = useNavigate()
  const { accentColor, intensity, fontSize, setAccentColor, setIntensity, setFontSize } = useThemeStore()

  const intensityOptions: { value: ThemeIntensity; label: string; description: string }[] = [
    { value: 'subtle', label: 'Subtle', description: 'Muted colors' },
    { value: 'normal', label: 'Normal', description: 'Balanced' },
    { value: 'vibrant', label: 'Vibrant', description: 'Bold colors' },
  ]

  const fontSizeOptions: { value: FontSize; label: string }[] = [
    { value: 'small', label: 'Small' },
    { value: 'normal', label: 'Normal' },
    { value: 'large', label: 'Large' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen py-12"
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12">
        <div className="text-center">
          <div className="inline-flex items-center justify-center mb-4">
            <Settings
              className="h-12 w-12"
              style={{ color: 'var(--premium-platinum)' }}
            />
          </div>
          <h1
            className="premium-text-platinum mb-3"
            style={{
              fontSize: 'var(--premium-text-h1)',
              fontWeight: 700,
              letterSpacing: 'var(--premium-tracking-tight)',
              textShadow: '0 0 20px rgba(229, 231, 235, 0.2)'
            }}
          >
            Explore More
          </h1>
          <p
            style={{
              color: 'var(--premium-text-secondary)',
              fontSize: 'var(--premium-text-body-lg)'
            }}
          >
            Advanced views and analysis tools
          </p>
        </div>
      </div>

      {/* Options Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4">
          {SETTINGS_OPTIONS.map((option, index) => {
            const Icon = option.icon
            return (
              <motion.button
                key={option.id}
                onClick={() => navigate(option.path)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="premium-card group relative p-6 text-left"
              >
                {/* Glow effect on hover */}
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl pointer-events-none"
                  style={{ backgroundColor: option.glow }}
                />

                <div className="relative z-10 flex items-center gap-4">
                  {/* Icon */}
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

                  {/* Content */}
                  <div className="flex-1">
                    <h3
                      className="font-semibold mb-1"
                      style={{
                        color: 'var(--premium-platinum)',
                        fontSize: 'var(--premium-text-h4)',
                        letterSpacing: 'var(--premium-tracking-normal)'
                      }}
                    >
                      {option.label}
                    </h3>
                    <p
                      style={{
                        color: 'var(--premium-text-secondary)',
                        fontSize: 'var(--premium-text-body-md)'
                      }}
                    >
                      {option.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ChevronRight
                    className="w-6 h-6 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                    style={{ color: 'var(--premium-platinum)' }}
                  />
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Theme Customization */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
            <h2
              className="text-2xl font-bold"
              style={{ color: 'var(--premium-text-primary)' }}
            >
              Theme Customization
            </h2>
          </div>

          {/* Accent Color */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              Accent Color
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
                  className="premium-card p-4 text-center transition-all hover:scale-105"
                >
                  <div className="font-semibold mb-1" style={{ color: 'var(--premium-text-primary)' }}>
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
          <div>
            <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              Font Size
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {fontSizeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFontSize(option.value)}
                  className="premium-card p-4 text-center transition-all hover:scale-105"
                  style={{
                    fontSize: option.value === 'small' ? '14px' : option.value === 'large' ? '18px' : '16px'
                  }}
                >
                  <div className="font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                    {option.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
