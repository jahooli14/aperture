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
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useToast } from './ui/toast'

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
  const { addOptimisticMemory, replaceOptimisticMemory, removeOptimisticMemory } = useMemoryStore()
  const { addOfflineCapture } = useOfflineSync()
  const { addToast } = useToast()
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

  const handleVoiceTranscript = async (text: string) => {
    if (!text) return

    setIsVoiceOpen(false)

    // IMMEDIATELY show optimistic memory
    const tempId = addOptimisticMemory(text)

    try {
      if (isOnline) {
        // Online: send to memories API for parsing
        const response = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text })
        })

        if (!response.ok) {
          const contentType = response.headers.get('content-type')
          if (contentType?.includes('text/html')) {
            throw new Error('Thoughts API not available')
          }
          throw new Error(`Failed to save thought: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('✓ Memory created:', data)

        // Replace optimistic memory with real one
        replaceOptimisticMemory(tempId, data.memory)

        // Success! Show confirmation
        addToast({
          title: 'Thought saved!',
          description: 'Your voice note has been captured.',
          variant: 'success',
        })
      } else {
        // Offline: queue for later but keep optimistic memory
        await addOfflineCapture(text)
        addToast({
          title: 'Queued for sync',
          description: 'Will process when back online.',
          variant: 'default',
        })
      }
    } catch (error) {
      console.error('Failed to capture:', error)
      // Fallback to offline queue if API fails
      try {
        await addOfflineCapture(text)
        addToast({
          title: 'Queued for sync',
          description: 'Will process when API is available.',
          variant: 'default',
        })
        // Keep the optimistic memory visible
      } catch (offlineError) {
        console.error('Failed to queue offline:', offlineError)
        // Remove optimistic memory if complete failure
        removeOptimisticMemory(tempId)
        addToast({
          title: 'Failed to save',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <>
      {/* Voice Input Modal - Material You */}
      <AnimatePresence>
        {isVoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.32)', // M3 scrim overlay
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => setIsVoiceOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6"
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                borderRadius: 'var(--md-sys-shape-corner-extra-large)',
                boxShadow: 'var(--md-sys-shadow-3)',
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

      {/* Menu Backdrop - Material You Scrim */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.32)',
              backdropFilter: 'blur(4px)'
            }}
            className="fixed inset-0 z-40"
          />
        )}
      </AnimatePresence>

      {/* Menu List - Material You */}
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
                  {/* Label - M3 Surface Container */}
                  <div
                    className="px-4 py-2 whitespace-nowrap transition-all font-medium"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--md-sys-color-secondary-container)'
                        : 'var(--md-sys-color-surface-container-high)',
                      color: isActive
                        ? 'var(--md-sys-color-on-secondary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      borderRadius: 'var(--md-sys-shape-corner-large)',
                      boxShadow: 'var(--md-sys-shadow-2)',
                      fontSize: 'var(--md-sys-typescale-label-large-size)',
                      fontWeight: 'var(--md-sys-typescale-label-large-weight)',
                    }}
                  >
                    {option.label}
                  </div>

                  {/* Icon Button - M3 FAB Mini */}
                  <div
                    className="relative w-14 h-14 flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: isActive
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-highest)',
                      color: isActive
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      borderRadius: 'var(--md-sys-shape-corner-large)',
                      boxShadow: isActive ? 'var(--md-sys-shadow-3)' : 'var(--md-sys-shadow-1)',
                    }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice FAB - Material You Secondary Action */}
      <AnimatePresence>
        {!isMenuOpen && isOnline && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsVoiceOpen(true)}
            className="fixed bottom-28 right-6 z-40 w-14 h-14 flex items-center justify-center transition-all"
            style={{
              backgroundColor: 'var(--md-sys-color-secondary-container)',
              color: 'var(--md-sys-color-on-secondary-container)',
              borderRadius: 'var(--md-sys-shape-corner-large)',
              boxShadow: 'var(--md-sys-shadow-2)',
            }}
          >
            <Mic className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main FAB - Material You Primary */}
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
        className="fixed bottom-6 right-6 z-50 w-16 h-16 flex items-center justify-center transition-all relative"
        style={{
          backgroundColor: 'var(--md-sys-color-primary-container)',
          color: 'var(--md-sys-color-on-primary-container)',
          borderRadius: 'var(--md-sys-shape-corner-large)',
          boxShadow: 'var(--md-sys-shadow-3)',
        }}
      >
        {/* Icon */}
        <motion.div
          animate={{ rotate: isMenuOpen ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          {isMenuOpen ? (
            <X className="w-7 h-7" />
          ) : (
            <Sparkles className="w-7 h-7" />
          )}
        </motion.div>

        {/* Subtle pulse when closed */}
        {!isMenuOpen && (
          <motion.div
            animate={{
              opacity: [0.15, 0.3, 0.15],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: 'var(--md-sys-color-primary)',
              borderRadius: 'var(--md-sys-shape-corner-large)',
              filter: 'blur(12px)',
            }}
          />
        )}
      </motion.button>
    </>
  )
}
