/**
 * Floating Navigation - Premium Glassmorphic Bottom Nav Bar
 * Fixed navigation bar with integrated voice input and auth
 */

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Compass, Brain, Layers, List, User, LogOut } from 'lucide-react'
import { VoiceFAB } from './VoiceFAB'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import { useMemoryStore } from '../stores/useMemoryStore'
import type { Memory } from '../types'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useToast } from './ui/toast'
import { useAuthContext } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

// Schema colors for each section — unique per page to reduce blue monotony
const SCHEMA_COLORS = {
  home: { primary: '#38bdf8', glow: 'rgba(56, 189, 248, 0.4)' },
  thoughts: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  projects: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  reading: { primary: '#10b981', glow: 'rgba(16, 185, 129, 0.3)' },
  timeline: { primary: '#22d3ee', glow: 'rgba(34, 211, 238, 0.4)' },
  context: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  lists: { primary: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
  todos: { primary: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
} as const

interface NavOption {
  id: string
  label: string
  icon: any
  path?: string
  action?: 'navigate' | 'toggle-sidebar'
  color: keyof typeof SCHEMA_COLORS
}

// 4 core nav tabs: Home, Thoughts, Projects, Lists
const NAV_OPTIONS: NavOption[] = [
  { id: 'home',     label: 'Home',     icon: Compass, path: '/',         action: 'navigate', color: 'home' },
  { id: 'thoughts', label: 'Thoughts', icon: Brain,   path: '/memories', action: 'navigate', color: 'thoughts' },
  { id: 'projects', label: 'Projects', icon: Layers,  path: '/projects', action: 'navigate', color: 'projects' },
  { id: 'lists',    label: 'Lists',    icon: List,    path: '/lists',    action: 'navigate', color: 'lists' },
]

export function FloatingNav() {
  const { isOnline } = useOnlineStatus()
  const isKeyboardVisible = useKeyboardVisible()
  const { addOptimisticMemory, replaceOptimisticMemory, removeOptimisticMemory } = useMemoryStore()
  const { addOfflineCapture } = useOfflineSync()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuthContext()
  const [showUserMenu, setShowUserMenu] = React.useState(false)

  const location = useLocation()
  const [isHidden, setIsHidden] = React.useState(false)

  const allMemories = useMemoryStore((s: { memories: Memory[] }) => s.memories)
  const hasRecentMemories = allMemories.some((m: Memory) => {
    const created = m.created_at || m.audiopen_created_at
    if (!created) return false
    const mTime = new Date(created).getTime()
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    return mTime > oneDayAgo
  })

  // Only allow hiding on Reader page
  const isReaderPage = location.pathname.startsWith('/reading/') && location.pathname !== '/reading'
  // Explicitly ensure we never hide on memories page
  const isMemoriesPage = location.pathname === '/memories' || location.pathname.startsWith('/memories')

  const shouldHide = (isReaderPage && isHidden) && !isMemoriesPage

  // Listen for toggle-nav events from ReaderPage
  React.useEffect(() => {
    const handleToggle = (e: CustomEvent) => {
      // Only respect toggle events if we're actually on the reader page
      if (location.pathname.startsWith('/reading/')) {
        setIsHidden(e.detail.hidden)
      }
    }
    window.addEventListener('toggle-nav', handleToggle as EventListener)
    return () => window.removeEventListener('toggle-nav', handleToggle as EventListener)
  }, [location.pathname])

  // Reset visibility on route change (e.g. leaving Reader page)
  React.useEffect(() => {
    setIsHidden(false)
  }, [location.pathname])

  // Close user menu on route change
  React.useEffect(() => {
    setShowUserMenu(false)
  }, [location.pathname])

  // Listen for voice captures queued offline (from useMediaRecorderVoice)
  React.useEffect(() => {
    const handleOfflineQueued = () => {
      addToast({
        title: 'Voice note saved offline',
        description: 'Will be transcribed and saved when back online.',
        variant: 'default',
      })
    }
    window.addEventListener('voice-capture-queued-offline', handleOfflineQueued)
    return () => window.removeEventListener('voice-capture-queued-offline', handleOfflineQueued)
  }, [addToast])

  // Listen for memory connections found after creation
  React.useEffect(() => {
    const handleConnectionsFound = (e: Event) => {
      const customEvent = e as CustomEvent
      const { count } = customEvent.detail
      addToast({
        title: `Connected to ${count} related thought${count > 1 ? 's' : ''}`,
        description: 'Tap to explore connections',
        duration: 4000,
        variant: 'success',
      })
    }
    window.addEventListener('memory-connections-found', handleConnectionsFound)
    return () => window.removeEventListener('memory-connections-found', handleConnectionsFound)
  }, [addToast])

  const handleNavClick = (option: NavOption) => {
    if (option.action === 'navigate' && option.path) {
      navigate(option.path)
    }
  }

  const isActive = (option: NavOption): boolean => {
    return location.pathname === option.path
  }

  const handleVoiceFABTap = () => {
    // Force voice capture as requested by user, bypassing project-specific interception
    return false
  }

  const handleSignOut = async () => {
    setShowUserMenu(false)
    await supabase.auth.signOut()
    navigate('/')
  }

  const getAvatarContent = () => {
    if (!user) return null
    const name = user.user_metadata?.full_name || user.email || ''
    const initials = name
      .split(' ')
      .map((n: string) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return initials || <User className="h-3.5 w-3.5" />
  }

  const handleVoiceTranscript = async (text: string) => {
    if (!text) return

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

        console.log('[FloatingNav] API Response:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          contentType: response.headers.get('content-type')
        })

        if (!response.ok) {
          const contentType = response.headers.get('content-type')
          let errorDetails = `HTTP ${response.status}: ${response.statusText}`

          if (contentType?.includes('application/json')) {
            try {
              const errorData = await response.json()
              errorDetails = errorData.details || errorData.error || errorDetails
              console.error('[FloatingNav] API Error Details:', errorData)
            } catch (parseError) {
              console.error('[FloatingNav] Failed to parse error response')
            }
          } else if (contentType?.includes('text/html')) {
            console.error('[FloatingNav] Received HTML instead of JSON - API deployment issue')
            errorDetails = 'Thoughts API not available (deployment issue)'
          }

          throw new Error(errorDetails)
        }

        const data = await response.json()
        console.log(' Memory created:', data)

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
              console.log(' Auto-linked to project:', projectId)
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

      // Only queue for offline if it's truly a network error, not an API error
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isNetworkError =
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        error instanceof TypeError

      if (isNetworkError) {
        // True network error - queue for offline sync
        try {
          await addOfflineCapture(text)
          addToast({
            title: 'Queued for sync',
            description: 'Will process when back online.',
            variant: 'default',
          })
          // Keep the optimistic memory visible
        } catch (offlineError) {
          console.error('Failed to queue offline:', offlineError)
          // Remove optimistic memory if complete failure
          removeOptimisticMemory(tempId)
          addToast({
            title: 'Failed to save',
            description: 'Could not queue for offline. Please try again.',
            variant: 'destructive',
          })
        }
      } else {
        // API error while online - show the error to user, don't queue
        removeOptimisticMemory(tempId)
        addToast({
          title: 'Failed to save',
          description: errorMessage.includes('not available')
            ? 'API temporarily unavailable. Please try again.'
            : 'Error saving thought. Please try again.',
          variant: 'destructive',
        })
      }
    }
  }

  return (
    <>
      {/* Replaced inline FAB with Universal Action FAB */}
      <VoiceFAB
        onTranscript={handleVoiceTranscript}
        hidden={shouldHide || isKeyboardVisible}
        onTap={handleVoiceFABTap}
      />

      {/* User menu popup */}
      <AnimatePresence>
        {showUserMenu && user && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998]"
              onClick={() => setShowUserMenu(false)}
            />
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed z-[9999] right-4"
              style={{
                bottom: 'calc(var(--safe-area-inset-bottom, 20px) + 5rem)',
              }}
            >
              <div
                className="rounded-2xl overflow-hidden min-w-[200px]"
                style={{
                  backgroundColor: 'rgba(15, 24, 41, 0.96)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                {/* User info */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--brand-text-primary)' }}>
                    {user.user_metadata?.full_name || 'signed in'}
                  </p>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--brand-text-muted)' }}>
                    {user.email}
                  </p>
                </div>
                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors hover:bg-white/5"
                  style={{ color: 'var(--brand-text-secondary)' }}
                >
                  <LogOut className="h-4 w-4 flex-shrink-0" />
                  sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar - Premium Glassmorphism */}
      <motion.nav
        initial={false}
        animate={{ y: (shouldHide || isKeyboardVisible) ? 100 : 0, opacity: isKeyboardVisible ? 0 : 1 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-[9999] w-full"
        style={{
          paddingBottom: 'calc(var(--safe-area-inset-bottom, 20px) + 1rem)',
          transform: 'translate3d(0, 0, 0)', // Force hardware acceleration
          WebkitTransform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          willChange: 'transform',
          isolation: 'isolate'
        }}
      >
        <div className="mx-auto max-w-2xl px-2 sm:px-4">
          <div
            className="premium-glass flex items-center gap-0"
            style={{
              borderRadius: 'var(--premium-radius-2xl)',
              backgroundColor: 'var(--brand-glass-bg)',
              backdropFilter: 'var(--brand-glass-blur)',
              WebkitBackdropFilter: 'var(--brand-glass-blur)',
              padding: '4px 6px',
              border: '1px solid rgba(56,189,248,0.1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 30px rgba(56,189,248,0.06)',
            }}
          >
            {/* Nav tabs */}
            <div className="flex flex-1 items-center">
              {NAV_OPTIONS.map((option) => {
                const Icon = option.icon
                const colors = SCHEMA_COLORS[option.color]
                const active = isActive(option)

                const dot = option.id === 'thoughts' && hasRecentMemories

                return (
                  <motion.button
                    key={option.id}
                    onClick={() => handleNavClick(option)}
                    whileTap={{ scale: 0.85 }}
                    className="flex flex-col items-center justify-center relative min-w-0"
                    style={{
                      flex: '1 1 0px',
                      paddingTop: '6px',
                      paddingBottom: active ? '2px' : '6px',
                      gap: active ? '3px' : '0px',
                    }}
                  >
                    {/* Active pill indicator */}
                    {active && (
                      <motion.div
                        layoutId="floatingNavActiveTab"
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: `linear-gradient(to top, ${colors.glow}, transparent)`,
                          border: `1px solid ${colors.primary}30`,
                        }}
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}

                    {/* Icon + badge wrapper */}
                    <div className="relative z-10">
                      <motion.div
                        animate={{ scale: active ? 1.12 : 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      >
                        <Icon
                          style={{
                            width: '22px',
                            height: '22px',
                            color: active ? colors.primary : 'rgba(255,255,255,0.38)',
                            transition: 'color 200ms',
                            filter: active ? `drop-shadow(0 0 5px ${colors.glow})` : 'none'
                          }}
                        />
                      </motion.div>

                      {/* Dot badge (recent thoughts) */}
                      {dot && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                          style={{
                            background: colors.primary,
                            boxShadow: `0 0 4px ${colors.glow}`
                          }}
                        />
                      )}
                    </div>

                    {/* Label - only visible for active tab */}
                    <AnimatePresence>
                      {active && (
                        <motion.span
                          key={option.id + '-label'}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.15 }}
                          className="relative z-10 font-semibold"
                          style={{
                            color: colors.primary,
                            fontSize: '10px',
                            letterSpacing: '0.04em',
                            lineHeight: 1,
                          }}
                        >
                          {option.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                )
              })}
            </div>

            {/* Divider */}
            <div
              className="w-px self-stretch mx-1 my-2 flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            />

            {/* User / Login button */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                if (user) {
                  setShowUserMenu(prev => !prev)
                } else {
                  navigate('/login')
                }
              }}
              className="flex flex-col items-center justify-center relative flex-shrink-0"
              style={{
                width: '52px',
                paddingTop: '6px',
                paddingBottom: '6px',
                gap: '3px',
              }}
            >
              {user ? (
                <>
                  {/* Avatar circle */}
                  <motion.div
                    animate={{ scale: showUserMenu ? 1.12 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: showUserMenu
                        ? 'linear-gradient(135deg, #3b82f6, #818cf8)'
                        : 'rgba(59, 130, 246, 0.2)',
                      border: `1.5px solid ${showUserMenu ? '#3b82f6' : 'rgba(59,130,246,0.35)'}`,
                      color: showUserMenu ? '#fff' : '#3b82f6',
                      boxShadow: showUserMenu ? '0 0 10px rgba(59,130,246,0.4)' : 'none',
                      transition: 'all 200ms',
                    }}
                  >
                    {getAvatarContent()}
                  </motion.div>
                  <span
                    className="font-semibold"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                      lineHeight: 1,
                      color: showUserMenu ? '#3b82f6' : 'rgba(255,255,255,0.38)',
                      transition: 'color 200ms',
                    }}
                  >
                    you
                  </span>
                </>
              ) : (
                <>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1.5px dashed rgba(255,255,255,0.2)',
                    }}
                  >
                    <User
                      style={{
                        width: '14px',
                        height: '14px',
                        color: 'rgba(255,255,255,0.38)',
                      }}
                    />
                  </motion.div>
                  <span
                    className="font-semibold"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                      lineHeight: 1,
                      color: 'rgba(255,255,255,0.38)',
                    }}
                  >
                    sign in
                  </span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.nav>
    </>
  )
}
