/**
 * Floating Navigation - Comprehensive Multi-Layer Menu
 * Replaces both bottom navbar and VoiceFAB
 */

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers,
  FolderKanban,
  FileText,
  Home,
  Mic,
  Calendar,
  Sparkles,
  X
} from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

// Schema colors for each section
const SCHEMA_COLORS = {
  home: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  thoughts: { primary: '#6366f1', glow: 'rgba(99, 102, 241, 0.4)' },
  projects: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  reading: { primary: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
  timeline: { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  constellation: { primary: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.4)' }
} as const

interface NavOption {
  id: string
  label: string
  icon: any
  path: string
  color: keyof typeof SCHEMA_COLORS
}

const NAV_OPTIONS: NavOption[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/', color: 'home' },
  { id: 'thoughts', label: 'Thoughts', icon: Layers, path: '/memories', color: 'thoughts' },
  { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/projects', color: 'projects' },
  { id: 'reading', label: 'Reading', icon: FileText, path: '/reading', color: 'reading' },
  { id: 'timeline', label: 'Timeline', icon: Calendar, path: '/knowledge-timeline', color: 'timeline' },
  { id: 'constellation', label: 'Galaxy', icon: Sparkles, path: '/constellation', color: 'constellation' }
]

export function FloatingNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isVoiceOpen, setIsVoiceOpen] = useState(false)
  const { isOnline } = useOnlineStatus()
  const navigate = useNavigate()
  const location = useLocation()

  // Determine current section
  const getCurrentSection = (): keyof typeof SCHEMA_COLORS => {
    const path = location.pathname
    if (path.startsWith('/constellation')) return 'constellation'
    if (path.startsWith('/memories')) return 'thoughts'
    if (path.startsWith('/projects')) return 'projects'
    if (path.startsWith('/reading')) return 'reading'
    if (path.startsWith('/knowledge-timeline') || path.startsWith('/timeline')) return 'timeline'
    return 'home'
  }

  const currentSection = getCurrentSection()
  const currentColors = SCHEMA_COLORS[currentSection]

  const handleNavClick = (option: NavOption) => {
    navigate(option.path)
    setIsMenuOpen(false)
  }

  const handleVoiceTranscript = (text: string) => {
    // Handle voice transcript (you'll need to implement this based on your needs)
    console.log('[Voice]', text)
    setIsVoiceOpen(false)
  }

  return (
    <>
      {/* Voice Input Modal */}
      <AnimatePresence>
        {isVoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-black/50"
            onClick={() => setIsVoiceOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl backdrop-blur-xl bg-white/90 border-2 shadow-2xl p-6"
              style={{
                borderColor: currentColors.primary,
                boxShadow: `0 20px 60px ${currentColors.glow}`
              }}
            >
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                maxDuration={60}
                autoSubmit={true}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu Backdrop */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-40 backdrop-blur-sm bg-black/20"
          />
        )}
      </AnimatePresence>

      {/* Menu List */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 right-6 z-50 flex flex-col gap-3"
          >
            {NAV_OPTIONS.map((option, index) => {
              const Icon = option.icon
              const colors = SCHEMA_COLORS[option.color]
              const isActive = location.pathname === option.path

              return (
                <motion.button
                  key={option.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    transition: { delay: index * 0.05 }
                  }}
                  exit={{ opacity: 0, x: 20 }}
                  whileHover={{ scale: 1.05, x: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleNavClick(option)}
                  className="flex items-center gap-3 group"
                >
                  {/* Label */}
                  <div
                    className="px-4 py-2 rounded-xl backdrop-blur-xl bg-white/90 border shadow-lg whitespace-nowrap transition-all"
                    style={{
                      borderColor: isActive ? colors.primary : `${colors.primary}30`,
                      backgroundColor: isActive ? `${colors.primary}10` : 'rgba(255,255,255,0.9)'
                    }}
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{ color: colors.primary }}
                    >
                      {option.label}
                    </span>
                  </div>

                  {/* Icon Button */}
                  <div
                    className="relative w-14 h-14 rounded-xl backdrop-blur-xl bg-white/80 border-2 shadow-xl flex items-center justify-center transition-all"
                    style={{
                      borderColor: isActive ? colors.primary : `${colors.primary}50`,
                      boxShadow: isActive ? `0 8px 32px ${colors.glow}` : `0 4px 16px ${colors.glow}`
                    }}
                  >
                    <Icon className="w-6 h-6" style={{ color: colors.primary }} />

                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-xl blur-lg opacity-50"
                        style={{ backgroundColor: colors.glow }}
                      />
                    )}
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice FAB - Secondary Action */}
      <AnimatePresence>
        {!isMenuOpen && isOnline && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsVoiceOpen(true)}
            className="fixed bottom-28 right-6 z-40 w-14 h-14 rounded-xl backdrop-blur-xl bg-white/80 border-2 shadow-xl flex items-center justify-center transition-all"
            style={{
              borderColor: `${currentColors.primary}50`,
              boxShadow: `0 4px 16px ${currentColors.glow}`
            }}
          >
            <Mic className="w-5 h-5" style={{ color: currentColors.primary }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main FAB - Menu Toggle */}
      <motion.button
        onClick={() => {
          if (isVoiceOpen) {
            setIsVoiceOpen(false)
          } else {
            setIsMenuOpen(!isMenuOpen)
          }
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-2xl backdrop-blur-xl bg-white/90 border-2 shadow-2xl flex items-center justify-center transition-all"
        style={{
          borderColor: currentColors.primary,
          boxShadow: `0 8px 32px ${currentColors.glow}`
        }}
      >
        {/* Icon */}
        <motion.div
          animate={{ rotate: isMenuOpen ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {isMenuOpen ? (
            <X className="w-7 h-7" style={{ color: currentColors.primary }} />
          ) : (
            <Sparkles className="w-7 h-7" style={{ color: currentColors.primary }} />
          )}
        </motion.div>

        {/* Pulsing glow when closed */}
        {!isMenuOpen && (
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute inset-0 rounded-2xl blur-xl pointer-events-none"
            style={{ backgroundColor: currentColors.glow }}
          />
        )}
      </motion.button>
    </>
  )
}
