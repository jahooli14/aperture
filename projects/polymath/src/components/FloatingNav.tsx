/**
 * Floating Navigation - Premium Glassmorphic Bottom Nav Bar
 * Fixed navigation bar with integrated voice input
 */

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Brain,
  Layers,
  FileText,
  Mic,
  Settings,
  Sparkles
} from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useToast } from './ui/toast'

// Schema colors for each section - unified blue theme
const SCHEMA_COLORS = {
  home: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  thoughts: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  projects: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  reading: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  timeline: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  constellation: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  context: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' }
} as const

interface NavOption {
  id: string
  label: string
  icon: any
  path?: string
  action?: 'navigate' | 'toggle-sidebar'
  color: keyof typeof SCHEMA_COLORS
}

// Core navigation: Home + 3 tenets + Settings
const NAV_OPTIONS: NavOption[] = [
  { id: 'home', label: 'Home', icon: Home, path: '/', action: 'navigate', color: 'home' },
  { id: 'reading', label: 'Reading', icon: FileText, path: '/reading', action: 'navigate', color: 'reading' },
  { id: 'projects', label: 'Projects', icon: Layers, path: '/projects', action: 'navigate', color: 'projects' },
  { id: 'thoughts', label: 'Thoughts', icon: Brain, path: '/memories', action: 'navigate', color: 'thoughts' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings', action: 'navigate', color: 'home' },
]

export function FloatingNav() {
  const [isVoiceOpen, setIsVoiceOpen] = React.useState(false)
  const { isOnline } = useOnlineStatus()
  const { addOptimisticMemory, replaceOptimisticMemory, removeOptimisticMemory } = useMemoryStore()
  const { addOfflineCapture } = useOfflineSync()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  // Listen for voice capture requests from AddNoteDialog
  React.useEffect(() => {
    const handleOpenVoiceCapture = () => {
      console.log('[FloatingNav] Received openVoiceCapture event')
      if (isOnline) {
        setIsVoiceOpen(true)
      }
    }
    window.addEventListener('openVoiceCapture', handleOpenVoiceCapture)
    return () => window.removeEventListener('openVoiceCapture', handleOpenVoiceCapture)
  }, [isOnline])

  const handleNavClick = (option: NavOption) => {
    if (option.action === 'navigate' && option.path) {
      navigate(option.path)
    }
  }

  const isActive = (option: NavOption): boolean => {
    return location.pathname === option.path
  }

  // Check if we're on a project detail page
  const isProjectDetailPage = location.pathname.startsWith('/projects/') && location.pathname !== '/projects'

  // Hide on Knowledge Map page (has its own controls)
  const isMapPage = location.pathname === '/map'
  if (isMapPage) {
    return null
  }

  const handleVoiceFABClick = () => {
    if (!isOnline) return

    // On project pages, trigger the project's AddNote dialog instead
    if (isProjectDetailPage) {
      console.log('[FloatingNav] Dispatching openProjectAddNote event')
      window.dispatchEvent(new CustomEvent('openProjectAddNote'))
      return
    }

    // Simple click to open voice modal
    console.log('[FloatingNav] Opening voice modal')
    setIsVoiceOpen(true)
  }

  const handleVoiceTranscript = async (text: string) => {
    if (!text) return

    setIsVoiceOpen(false)

    // IMMEDIATELY show optimistic memory
    const tempId = addOptimisticMemory(text)

    // Show immediate feedback
    addToast({
      title: 'Saving thought...',
      description: 'Processing your voice note',
      variant: 'default',
    })

    // Detect if we're on a project page
    const projectMatch = location.pathname.match(/^\/projects\/([^/]+)$/)
    const projectId = projectMatch ? projectMatch[1] : null

    try {
      if (isOnline) {
        console.log('[FloatingNav] Sending to API:', { textLength: text.length, projectId })

        // Online: send to memories API for parsing
        const response = await fetch('/api/memories?capture=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: text,
            source_reference: projectId ? `project:${projectId}` : null
          })
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

        // If we're on a project page, create a connection
        if (projectId && data.memory?.id) {
          try {
            const connectionResponse = await fetch('/api/connections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_type: 'project',
                source_id: projectId,
                target_type: 'memory',
                target_id: data.memory.id,
                connection_type: 'project_voice_note',
                reasoning: 'Voice note captured while viewing this project'
              })
            })

            if (connectionResponse.ok) {
              console.log('✓ Auto-linked to project:', projectId)
            }
          } catch (linkError) {
            console.warn('Failed to auto-link to project:', linkError)
            // Don't fail the whole operation if linking fails
          }
        }

        // Success! Show confirmation
        addToast({
          title: projectId ? 'Thought saved & linked!' : 'Thought saved!',
          description: projectId ? 'Auto-linked to this project.' : 'Your voice note has been captured.',
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
      {/* Voice Input Modal - Premium Glass */}
      <AnimatePresence>
        {isVoiceOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              backgroundColor: 'rgba(10, 14, 26, 0.6)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)'
            }}
            onClick={() => {
              setIsVoiceOpen(false)
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="premium-glass-strong w-full max-w-md p-6"
            >
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                maxDuration={60}
                autoSubmit={true}
                autoStart={false}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prominent Capture FAB - Bottom right above nav */}
      <motion.button
        data-voice-fab
        onClick={handleVoiceFABClick}
        disabled={!isOnline}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          delay: 0.2
        }}
        className="fixed z-30 w-16 h-16 rounded-2xl flex items-center justify-center group"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8rem)',
          right: 'max(1rem, env(safe-area-inset-right, 1rem))',
          opacity: !isOnline ? 0.3 : 1,
          background: 'var(--premium-bg-3)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Icon */}
        <Mic
          className="relative z-10 w-8 h-8"
          style={{
            color: 'var(--premium-blue)'
          }}
        />

        {/* No label needed for bottom-right position */}
      </motion.button>

      {/* Bottom Navigation Bar - Premium Glassmorphism */}
      <motion.nav
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-40 pb-safe"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
        }}
      >
        <div className="mx-auto max-w-2xl px-4">
          <div
            className="premium-glass flex items-center justify-between gap-2 px-3 py-3"
            style={{
              borderRadius: 'var(--premium-radius-2xl)',
              backgroundColor: 'var(--premium-bg-2)'
            }}
          >
            {NAV_OPTIONS.map((option) => {
              const Icon = option.icon
              const colors = SCHEMA_COLORS[option.color]
              const active = isActive(option)

              return (
                <motion.button
                  key={option.id}
                  onClick={() => handleNavClick(option)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all relative min-w-0"
                  style={{ flex: '1 1 0px' }}
                >
                  {/* Active Background Glow */}
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: colors.glow,
                        border: `1px solid ${colors.primary}`,
                        opacity: 0.2
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  {/* Icon */}
                  <Icon
                    className="relative z-10 w-6 h-6"
                    style={{
                      color: active ? colors.primary : 'var(--premium-platinum)',
                      transition: 'color 200ms'
                    }}
                  />

                  {/* Label */}
                  <span
                    className="relative z-10 text-xs font-medium"
                    style={{
                      color: active ? colors.primary : 'var(--premium-text-tertiary)',
                      fontSize: 'var(--premium-text-body-xs)',
                      letterSpacing: 'var(--premium-tracking-wide)',
                      transition: 'color 200ms'
                    }}
                  >
                    {option.label}
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </motion.nav>
    </>
  )
}
