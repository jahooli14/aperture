/**
 * Voice Input Component
 * Records audio and transcribes using Web Speech API (web) or Capacitor Voice Recorder (native)
 */

import { useEffect } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { useMediaRecorderVoice } from '../hooks/useMediaRecorderVoice'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  maxDuration?: number // seconds
  autoSubmit?: boolean
  autoStart?: boolean // Auto-start recording when component mounts
  shouldStop?: boolean // Externally signal to stop recording
}

export function VoiceInput({
  onTranscript,
  maxDuration = 30,
  autoSubmit = false,
  autoStart = false,
  shouldStop = false
}: VoiceInputProps) {
  const {
    isRecording,
    transcript,
    timeLeft,
    isProcessing,
    isSupported,
    toggleRecording,
    startRecording,
    stopRecording
  } = useMediaRecorderVoice({
    onTranscript,
    maxDuration,
    autoSubmit
  })

  // Auto-start recording if requested
  useEffect(() => {
    if (autoStart && !isRecording && !isProcessing && isSupported) {
      console.log('[VoiceInput] Auto-starting recording...')
      // Small delay to ensure component is fully mounted and modal animation complete
      const timer = setTimeout(() => {
        console.log('[VoiceInput] Calling startRecording()')
        startRecording().catch(err => {
          console.error('[VoiceInput] Auto-start failed:', err)
        })
      }, 200) // Increased from 100ms for animation buffer
      return () => clearTimeout(timer)
    }
  }, [autoStart, isSupported]) // Reduced dependencies to prevent re-triggers

  // Stop recording if externally requested
  useEffect(() => {
    if (shouldStop && isRecording) {
      console.log('[VoiceInput] Stop requested via shouldStop prop')
      stopRecording()
    }
  }, [shouldStop, isRecording, stopRecording])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        console.log('[VoiceInput] Unmounting while recording - stopping...')
        stopRecording()
      }
    }
  }, [isRecording, stopRecording])

  if (!isSupported) {
    return (
      <div className="p-6 text-center premium-card border-red-500/30 bg-red-500/10">
        <Mic className="h-10 w-10 mx-auto mb-4 text-red-400 opacity-50" />
        <p className="text-red-200 font-medium mb-1">Recording Unsupported</p>
        <p className="text-sm text-red-300/70">
          Your browser doesn't support voice recording. Try using Chrome, Firefox or a recent Safari.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-full py-4 rounded-xl border flex items-center justify-center gap-3 transition-all duration-300 ${isRecording
          ? 'border-red-500/50 bg-red-500/20 text-red-200'
          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
          }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing...
          </>
        ) : isRecording ? (
          <>
            <Square className="h-5 w-5 animate-pulse" />
            Stop Recording ({timeLeft}s)
          </>
        ) : (
          <>
            <Mic className="h-5 w-5" />
            Record Voice ({maxDuration}s max)
          </>
        )}
      </Button>

      {transcript && !isProcessing && (
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <p className="text-sm text-slate-300 italic leading-relaxed">
            "{transcript}"
          </p>
        </div>
      )}
    </div>
  )
}
