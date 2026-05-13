/**
 * Floating Navigation - Premium Glassmorphic Bottom Nav Bar
 * Fixed navigation bar with integrated voice input and auth
 */

import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Lightbulb, Rocket, ListChecks } from 'lucide-react'
import { VoiceFAB } from './VoiceFAB'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { useKeyboardVisible } from '../hooks/useKeyboardVisible'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useDriftStore, wrapWithDriftContext } from '../stores/useDriftStore'
import type { Memory } from '../types'
import { useOfflineSync } from '../hooks/useOfflineSync'
import { useToast } from './ui/toast'
import { useAuthContext } from '../contexts/AuthContext'

// Schema colors for each section — unique per page to reduce blue monotony
const SCHEMA_COLORS = {
  home: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.4)' },
  thoughts: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.4)' },
  projects: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.4)' },
  reading: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.3)' },
  timeline: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.4)' },
  context: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.4)' },
  lists: { primary: 'rgb(var(--brand-primary-rgb))', glow: 'rgba(var(--brand-primary-rgb), 0.4)' },
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
  { id: 'home',     label: 'Home',     icon: Home,       path: '/',         action: 'navigate', color: 'home' },
  { id: 'thoughts', label: 'Thoughts', icon: Lightbulb,  path: '/memories', action: 'navigate', color: 'thoughts' },
  { id: 'projects', label: 'Projects', icon: Rocket,     path: '/projects', action: 'navigate', color: 'projects' },
  { id: 'lists',    label: 'Lists',    icon: ListChecks, path: '/lists',    action: 'navigate', color: 'lists' },
]

export function FloatingNav() {
  const { isOnline } = useOnlineStatus()
  const isKeyboardVisible = useKeyboardVisible()
  const { addOptimisticMemory, replaceOptimisticMemory, removeOptimisticMemory } = useMemoryStore()
  const { addOfflineCapture } = useOfflineSync()
  const { addToast } = useToast()
  const navigate = useNavigate()
  const { user } = useAuthContext()

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

  const handleVoiceTranscript = async (rawText: string) => {
    if (!rawText) return

    // If a Drift session is active, wrap the transcript so the saved
    // thought lands as a coherent reply to the drift question rather
    // than a free-floating note.
    const drift = useDriftStore.getState().active
    const text = wrapWithDriftContext(rawText, drift)

    // IMMEDIATELY show optimistic memory
    const tempId = addOptimisticMemory(text)

    // Show immediate feedback
    addToast({
      title: 'Saving thought…',
      description: 'Transcribing and tidying.',
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
            description: 'Couldn\'t queue for offline. Try again in a moment.',
            variant: 'destructive',
          })
        }
      } else {
        // API error while online - show the error to user, don't queue
        removeOptimisticMemory(tempId)
        addToast({
          title: 'Failed to save',
          description: errorMessage.includes('not available')
            ? 'Service is briefly unavailable — try again in a moment.'
            : 'Couldn\'t save the thought — try again in a moment.',
          variant: 'destructive',
        })
      }
    }
  }

  // Hide the whole nav (FAB + pill) for unauth visitors. They don't have
  // anywhere to capture TO, and every action behind the FAB hits
  // authenticated endpoints, so showing it as a pre-signup teaser would
  // just be noise. The AuthProvider blocks rendering during `loading`, so
  // by the time we run here `user` is either really there or really not.
  if (!user) return null

  return (
    <>
      {/* Universal voice/action FAB — now centered above the nav (raised
          middle slot) rather than the right-edge orphan it used to be. */}
      <VoiceFAB
        onTranscript={handleVoiceTranscript}
        hidden={shouldHide || isKeyboardVisible}
        onTap={handleVoiceFABTap}
      />

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
        <div className="mx-auto max-w-2xl px-2 sm:px-4 relative">
          <div
            className="flex items-center gap-0"
            style={{
              position: 'relative',
              borderRadius: '999px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 35%, rgba(0,0,0,0.10) 100%), rgba(15, 24, 41, 0.62)',
              backdropFilter: 'blur(36px) saturate(200%)',
              WebkitBackdropFilter: 'blur(36px) saturate(200%)',
              padding: '8px 10px',
              border: '1px solid rgba(56, 189, 248, 0.18)',
              boxShadow:
                '0 20px 60px -16px rgba(0,0,0,0.65),' +
                '0 8px 24px rgba(0,0,0,0.30),' +
                '0 0 48px rgba(56,189,248,0.14),' +
                'inset 0 1px 0 rgba(255,255,255,0.18),' +
                'inset 0 -1px 0 rgba(0,0,0,0.30)',
              // Semicircular cradle at the top-center so the raised FAB
              // reads as nested into the bar, not floating in front of it.
              maskImage:
                'radial-gradient(circle 36px at 50% 0%, transparent 36px, #000 37px)',
              WebkitMaskImage:
                'radial-gradient(circle 36px at 50% 0%, transparent 36px, #000 37px)',
            }}
          >
            {/* Four equal-flex tabs with a centered spacer for the raised
                voice FAB. The "you" tab has been removed — settings + sign
                out live on the /settings page. */}
            <div className="flex flex-1 items-center">
              {(() => {
                const renderTab = (option: NavOption) => {
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
                        paddingTop: '10px',
                        paddingBottom: '10px',
                      }}
                    >
                      <div className="relative z-10 flex items-center justify-center" style={{ width: '20px', height: '20px' }}>
                        <motion.div
                          animate={{ scale: active ? 1.1 : 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                          <Icon
                            style={{
                              width: '20px',
                              height: '20px',
                              color: active ? colors.primary : 'rgba(255,255,255,0.5)',
                              transition: 'color 200ms',
                              filter: active ? `drop-shadow(0 0 6px ${colors.glow})` : 'none',
                              strokeWidth: active ? 2 : 1.5,
                            }}
                          />
                        </motion.div>
                        {dot && (
                          <span
                            className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
                            style={{
                              background: colors.primary,
                              boxShadow: `0 0 4px ${colors.glow}`,
                            }}
                          />
                        )}
                      </div>
                      {active && (
                        <motion.div
                          layoutId="floatingNavActiveDot"
                          className="absolute w-1 h-1 rounded-full"
                          style={{
                            bottom: '4px',
                            background: colors.primary,
                            boxShadow: `0 0 8px ${colors.glow}, 0 0 16px ${colors.glow}`,
                          }}
                          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                        />
                      )}
                    </motion.button>
                  )
                }
                return (
                  <>
                    {NAV_OPTIONS.slice(0, 2).map(renderTab)}
                    {/* Spacer for the raised voice FAB that sits above the
                        nav center. Keeps tap targets on either side of it. */}
                    <div aria-hidden style={{ width: '64px', flexShrink: 0 }} />
                    {NAV_OPTIONS.slice(2).map(renderTab)}
                  </>
                )
              })()}
            </div>
          </div>
          {/* Cradle outline — traces the cutaway arc so the notch keeps
              the brand border and inner highlight that the mask clips
              off the pill itself. Sits below the FAB (which is in a
              z-[25001] portal) so the + still pops above. */}
          <svg
            aria-hidden
            width="74"
            height="38"
            viewBox="0 0 74 38"
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <path
              d="M 1 0 A 36 36 0 0 1 73 0"
              fill="none"
              stroke="rgba(56, 189, 248, 0.22)"
              strokeWidth="1"
            />
            <path
              d="M 2 1 A 35 35 0 0 1 72 1"
              fill="none"
              stroke="rgba(255, 255, 255, 0.10)"
              strokeWidth="1"
            />
          </svg>
        </div>
      </motion.nav>
    </>
  )
}
