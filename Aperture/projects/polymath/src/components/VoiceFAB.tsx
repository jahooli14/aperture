/**
 * Voice FAB (Floating Action Button)
 * Android Material Design pattern for quick voice capture
 */

import { useState } from 'react'
import { Mic, X } from 'lucide-react'
import { VoiceInput } from './VoiceInput'
import { cn } from '../lib/utils'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

interface VoiceFABProps {
  onTranscript: (text: string) => void
  maxDuration?: number
}

export function VoiceFAB({ onTranscript, maxDuration = 60 }: VoiceFABProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { isOnline } = useOnlineStatus()

  const handleTranscript = (text: string) => {
    onTranscript(text)
    setIsOpen(false)
  }

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "md:hidden fixed z-40",
            "bottom-24 right-4",
            "h-14 w-14 rounded-full",
            "bg-gradient-to-br from-orange-500 to-orange-600",
            "text-white shadow-lg hover:shadow-xl",
            "flex items-center justify-center",
            "transition-all duration-300",
            "active:scale-90",
            "hover:scale-110"
          )}
          aria-label="Voice capture"
        >
          <Mic className="h-6 w-6" />
        </button>
      )}

      {/* Voice Recording Modal */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Bottom Sheet */}
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl animate-slide-up">
            <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {/* Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="w-12 h-1.5 bg-neutral-300 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Voice Capture
                  </h3>
                  {!isOnline && (
                    <p className="text-sm text-amber-600 mt-1">Offline mode</p>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="h-10 w-10 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors active:scale-90"
                >
                  <X className="h-5 w-5 text-neutral-600" />
                </button>
              </div>

              {/* Voice Input */}
              <div className="px-6 pb-6">
                <VoiceInput
                  onTranscript={handleTranscript}
                  maxDuration={maxDuration}
                  autoSubmit={true}
                />
                {!isOnline && (
                  <p className="mt-4 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
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
