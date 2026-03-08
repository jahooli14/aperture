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
  BookOpen,
  FileText,
  Mic,
  MoreHorizontal,
  AlignLeft,
  CheckSquare,
} from 'lucide-react'
import { VoiceFAB } from './VoiceFAB'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useToast } from './ui/toast'
import { useTodoStore, selectToday } from '../stores/useTodoStore'
import { useReadingStore } from '../stores/useReadingStore'

// Schema colors for each section - unified blue theme
const SCHEMA_COLORS = {
  home: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  thoughts: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  projects: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  reading: { primary: 'rgba(34, 211, 238, 0.9)', glow: 'rgba(34, 211, 238, 0.3)' },
  timeline: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  context: { primary: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)' },
  lists: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  todos: { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
} as const

interface NavOption {
  id: string
  label: string
  icon: any
  path?: string
  action?: 'navigate' | 'toggle-sidebar'
  color: keyof typeof SCHEMA_COLORS
}

// Core navigation: Home + 4 primary sections
// Projects removed from bottom nav (accessible from Home) — Reading added as a daily-use feature
const NAV_OPTIONS: NavOption[] = [
  { id: 'home',     label: 'Home',     icon: Home,         path: '/',         action: 'navigate', color: 'home' },
  { id: 'todos',    label: 'Todos',    icon: CheckSquare,  path: '/todos',    action: 'navigate', color: 'todos' },
  { id: 'reading',  label: 'Reading',  icon: BookOpen,     path: '/reading',  action: 'navigate', color: 'reading' },
  { id: 'lists',    label: 'Lists',    icon: AlignLeft,    path: '/lists',    action: 'navigate', color: 'lists' },
  { id: 'thoughts', label: 'Thoughts', icon: Brain,        path: '/memories', action: 'navigate', color: 'thoughts' },
]

export function FloatingNav() {
  const { isOnline } = useOnlineStatus()
  const { addOptimisticMemory, replaceOptimisticMemory, removeOptimisticMemory } = useMemoryStore()
  const { addOfflineCapture } = useOfflineSync()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const location = useLocation()
  const [isHidden, setIsHidden] = React.useState(false)

  // Badge counts for nav tabs
  const allTodos = useTodoStore(s => s.todos)
  const todayTodos = selectToday(allTodos)
  const overdueTodosCount = todayTodos.filter(t => {
    const now = new Date().toISOString().slice(0, 10)
    return !!(
      (t.deadline_date && t.deadline_date < now) ||
      (t.scheduled_date && t.scheduled_date < now)
    )
  }).length

  const allArticles = useReadingStore(s => s.articles)
  const hasUnreadArticles = allArticles.some(a => a.status === 'unread')

  const allMemories = useMemoryStore(s => s.memories)
  const hasRecentMemories = allMemories.some(m => {
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
    if (option.id === 'reading') {
      // Active on /reading list page but not on individual article reader (/reading/:id)
      return location.pathname === '/reading'
    }
    return location.pathname === option.path
  }

  // Check if we're on a project detail page
  const isProjectDetailPage = location.pathname.startsWith('/projects/') && location.pathname !== '/projects'


  const handleVoiceFABTap = () => {
    // Force voice capture as requested by user, bypassing project-specific interception
    return false
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
        hidden={shouldHide}
        onTap={handleVoiceFABTap}
      />

      {/* Bottom Navigation Bar - Premium Glassmorphism */}
      <motion.nav
        initial={false}
        animate={{ y: shouldHide ? 100 : 0, opacity: 1 }}
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
            className="premium-glass flex items-center justify-between gap-1 px-2 py-3"
            style={{
              borderRadius: 'var(--premium-radius-2xl)',
              backgroundColor: 'var(--premium-bg-2)'
            }}
          >
            {NAV_OPTIONS.map((option) => {
              const Icon = option.icon
              const colors = SCHEMA_COLORS[option.color]
              const active = isActive(option)

              // Determine badge for this tab
              const badge = option.id === 'todos' && overdueTodosCount > 0
                ? overdueTodosCount
                : null
              const dot = (option.id === 'reading' && hasUnreadArticles) ||
                          (option.id === 'thoughts' && hasRecentMemories)

              return (
                <motion.button
                  key={option.id}
                  onClick={() => handleNavClick(option)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.9 }}
                  // TODO: Add Capacitor Haptics here when plugin is available:
                  // onTouchStart={() => Haptics.impact({ style: ImpactStyle.Light })}
                  className="flex flex-col items-center justify-center gap-1 px-1 sm:px-3 py-2 rounded-xl transition-all relative min-w-0"
                  style={{ flex: '1 1 0px' }}
                >
                  {/* Active Background: gradient glow from bottom */}
                  {active && (
                    <motion.div
                      layoutId="floatingNavActiveTab"
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: `linear-gradient(to top, ${colors.glow}, transparent)`,
                        border: `1px solid ${colors.primary}40`,
                        boxShadow: `0 0 12px 0 ${colors.glow}`
                      }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}

                  {/* Icon + badge wrapper */}
                  <div className="relative z-10">
                    <Icon
                      className="w-6 h-6"
                      style={{
                        color: active ? colors.primary : 'var(--premium-platinum)',
                        transition: 'color 200ms',
                        filter: active ? `drop-shadow(0 0 6px ${colors.glow})` : 'none'
                      }}
                    />

                    {/* Count badge (overdue todos) */}
                    {badge !== null && (
                      <span
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-white font-bold"
                        style={{
                          fontSize: '9px',
                          lineHeight: 1,
                          background: '#ef4444',
                          boxShadow: '0 0 6px rgba(239,68,68,0.6)'
                        }}
                      >
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}

                    {/* Dot badge (unread articles / recent thoughts) */}
                    {dot && !badge && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                        style={{
                          background: colors.primary,
                          boxShadow: `0 0 4px ${colors.glow}`
                        }}
                      />
                    )}
                  </div>

                  {/* Label — scales up slightly when active */}
                  <motion.span
                    className="relative z-10 text-xs font-medium"
                    animate={{ scale: active ? 1.08 : 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    style={{
                      color: active ? colors.primary : 'var(--premium-text-tertiary)',
                      fontSize: 'var(--premium-text-body-xs)',
                      letterSpacing: 'var(--premium-tracking-wide)',
                      transition: 'color 200ms'
                    }}
                  >
                    {option.label}
                  </motion.span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </motion.nav>
    </>
  )
}
