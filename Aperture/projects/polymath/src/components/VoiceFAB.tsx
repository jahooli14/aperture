/**
 * Voice FAB (Floating Action Button)
 * Android Material Design pattern for quick voice capture
 * Press and hold to start recording, tap to open full interface
 */

import { useState, useRef } from 'react'
import { Mic, X } from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { cn } from '../lib/utils'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { haptic } from '../utils/haptics'

interface VoiceFABProps {
  onTranscript: (text: string) => void
  maxDuration?: number
  enablePressAndHold?: boolean // Allow disabling press-and-hold for specific pages
}

export function VoiceFAB({ onTranscript, maxDuration = 60, enablePressAndHold = true }: VoiceFABProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [startRecordingOnOpen, setStartRecordingOnOpen] = useState(false)
  const { isOnline } = useOnlineStatus()
  const pressTimerRef = useRef<number | null>(null)
  const pressStartRef = useRef<number>(0)

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsOpen(false)
    setStartRecordingOnOpen(false)
  }

  const handlePointerDown = () => {
    if (!enablePressAndHold) {
      return
    }
    pressStartRef.current = Date.now()
    // Start a timer for press-and-hold (300ms threshold)
    pressTimerRef.current = window.setTimeout(() => {
      // Long press detected - open modal and start recording immediately
      haptic.medium()
      setStartRecordingOnOpen(true)
      setIsOpen(true)
    }, 300)
  }

  const handlePointerUp = () => {
    if (!enablePressAndHold) {
      // If press-and-hold is disabled, just open the modal on tap
      haptic.medium()
      setIsOpen(true)
      return
    }

    const pressDuration = Date.now() - pressStartRef.current

    // Clear the long press timer
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }

    // If it was a quick tap (not already opened by long press), open without auto-start
    if (pressDuration < 300 && !isOpen) {
      haptic.light()
      setStartRecordingOnOpen(false)
      setIsOpen(true)
    }
  }

  const handlePointerCancel = () => {
    // Clean up if the pointer is cancelled (e.g., user drags away)
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          data-voice-fab
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={cn(
            "fixed z-50",
            "bottom-24 md:bottom-6 right-4 md:right-6",
            "h-14 w-14 md:h-16 md:w-16 rounded-full",
            "shadow-lg hover:shadow-xl",
            "flex items-center justify-center",
            "transition-all duration-300",
            "active:scale-90",
            "hover:scale-110"
          )}
          style={{
            background: 'var(--premium-bg-3)'
          }}
          aria-label="Voice capture - Press and hold to record, tap to open"
        >
          <Mic className="h-6 w-6" style={{ color: 'var(--premium-blue)' }} />
        </button>
      )}

      {/* Voice Recording Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Bottom Sheet / Modal */}
          <div className="relative w-full md:w-[500px] premium-card rounded-t-3xl md:rounded-2xl shadow-2xl animate-slide-up" style={{ backgroundColor: 'var(--premium-surface-elevated)' }}>
            <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {/* Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: 'var(--premium-text-tertiary)', opacity: 0.3 }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
                    Voice Capture
                  </h3>
                  {!isOnline && (
                    <p className="text-sm mt-1" style={{ color: 'var(--premium-amber)' }}>Offline mode</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    haptic.light()
                    setIsOpen(false)
                  }}
                  className="h-11 w-11 rounded-full premium-glass-subtle flex items-center justify-center transition-all active:scale-90 touch-manipulation hover:bg-white/10 btn-ripple"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" style={{ color: 'var(--premium-text-secondary)' }} />
                </button>
              </div>

              {/* Voice Input */}
              <div className="px-6 pb-6">
                <VoiceInput
                  onTranscript={handleTranscript}
                  maxDuration={maxDuration}
                  autoSubmit={true}
                  autoStart={startRecordingOnOpen}
                />
                {!isOnline && (
                  <p className="mt-4 text-sm p-3 rounded-lg border" style={{
                    color: 'var(--premium-amber)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderColor: 'rgba(245, 158, 11, 0.3)'
                  }}>
                    You're offline. This capture will sync automatically when you're back online.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
