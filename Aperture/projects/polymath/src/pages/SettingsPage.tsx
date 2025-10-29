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
  Rss
} from 'lucide-react'

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
    id: 'today',
    label: 'Daily Queue',
    description: 'Your personalized daily tasks and priorities',
    icon: ListChecks,
    path: '/today',
    color: '#3b82f6',
    glow: 'rgba(59, 130, 246, 0.4)'
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
                      background: `linear-gradient(135deg, ${option.glow}, transparent)`,
                      border: `1px solid ${option.color}40`,
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
    </motion.div>
  )
}
