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
}

export function VoiceInput({ onTranscript, maxDuration = 30, autoSubmit = false, autoStart = false }: VoiceInputProps) {
  const {
    isRecording,
    transcript,
    timeLeft,
    isProcessing,
    toggleRecording,
    startRecording
  } = useMediaRecorderVoice({
    onTranscript,
    maxDuration,
    autoSubmit
  })

  // Auto-start recording if requested
  useEffect(() => {
    if (autoStart && !isRecording && !isProcessing) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        startRecording()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [autoStart, isRecording, isProcessing, startRecording])

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`w-full py-4 rounded-lg border-2 flex items-center justify-center gap-3 transition-smooth ${
          isRecording
            ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
            : 'border-neutral-300 bg-white text-neutral-700 hover:border-blue-500 hover:bg-blue-50'
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
        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-700">
            {transcript}
          </p>
        </div>
      )}
    </div>
  )
}
