/**
 * Voice Input Component
 * Records audio and transcribes using Web Speech API (web) or Capacitor Voice Recorder (native)
 */

import { useEffect } from 'react'
import { Mic, Square, Loader2, RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { useMediaRecorderVoice } from '../hooks/useMediaRecorderVoice'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  onError?: (message: string) => void
  maxDuration?: number // seconds
  autoSubmit?: boolean
  autoStart?: boolean // Auto-start recording when component mounts
  shouldStop?: boolean // Externally signal to stop recording
}

export function VoiceInput({
  onTranscript,
  onError,
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
    error,
    canRetry,
    retry,
    toggleRecording,
    startRecording,
    stopRecording
  } = useMediaRecorderVoice({
    onTranscript,
    onError,
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
      }, 50) // Reduced from 200ms to minimize "start cutoff"
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

  // Recording progress: elapsed counts up, the bar fills toward the cap, and
  // both turn amber in the final 15s so the auto-stop isn't a surprise.
  const elapsed = Math.max(0, maxDuration - timeLeft)
  const progressPct = maxDuration > 0 ? Math.min(100, (elapsed / maxDuration) * 100) : 0
  const lowTime = timeLeft <= 15
  const WARN_COLOR = '#f59e0b'
  const fmtTime = (s: number) => {
    const total = Math.max(0, Math.floor(s))
    const m = Math.floor(total / 60)
    const sec = total % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!isSupported) {
    return (
      <div className="p-6 text-center glass-card border-red-500/30 bg-brand-primary/10">
        <Mic className="h-10 w-10 mx-auto mb-4 text-brand-text-secondary opacity-50" />
        <p className="text-brand-primary font-medium mb-1">Recording Unsupported</p>
        <p className="text-sm text-brand-primary/70">
          Your browser doesn't support voice recording. Try using Chrome, Firefox or a recent Safari.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Active-recording panel: a big count-up timer is the hero, with a
          progress bar filling toward the cap and an explicit "time left" so
          you always know how much you've used and how much remains. */}
      {isRecording && !isProcessing && (
        <div
          className="rounded-2xl px-5 py-4"
          style={{
            background: 'var(--glass-surface)',
            boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* Pulsing live dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-[var(--brand-text-secondary)]">
                Recording
              </span>
            </div>
            <span
              className="text-sm font-medium tabular-nums"
              style={{ color: lowTime ? WARN_COLOR : 'var(--brand-text-secondary)' }}
            >
              {fmtTime(timeLeft)} left
            </span>
          </div>

          {/* Hero: elapsed time, counting up */}
          <div
            className="text-center tabular-nums font-semibold leading-none mb-3"
            style={{ fontSize: '2.75rem', color: 'var(--brand-text-primary)' }}
          >
            {fmtTime(elapsed)}
          </div>

          {/* Progress toward the cap */}
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${progressPct}%`,
                background: lowTime ? WARN_COLOR : 'rgb(var(--brand-primary-rgb))',
              }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-[var(--brand-text-secondary)] opacity-60">
            <span>0:00</span>
            <span>{fmtTime(maxDuration)}</span>
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={canRetry ? retry : toggleRecording}
        disabled={isProcessing}
        className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all duration-300 ${isRecording
          ? 'bg-brand-primary/20 text-brand-primary'
          : 'bg-[var(--glass-surface)] text-[var(--brand-text-secondary)] hover:bg-[rgba(255,255,255,0.1)]'
          }`}
        style={{
          boxShadow: isRecording
            ? 'inset 0 0 0 1px rgba(239,68,68,0.5)'
            : 'inset 0 0 0 1px rgba(255,255,255,0.1)',
        }}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Transcribing your note…
          </>
        ) : canRetry ? (
          <>
            <RotateCcw className="h-5 w-5" />
            Try again
          </>
        ) : isRecording ? (
          <>
            <Square className="h-5 w-5" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="h-5 w-5" />
            Tap to talk
          </>
        )}
      </Button>

      {/* Processing: a calm moving rule so the wait reads as deliberate work,
          not a frozen spinner. */}
      {isProcessing && (
        <div className="h-[2px] w-full overflow-hidden rounded-full" style={{ background: 'rgba(var(--brand-primary-rgb), 0.12)' }}>
          <div
            className="h-full w-1/3 rounded-full animate-voice-progress"
            style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--brand-primary-rgb)), transparent)' }}
          />
        </div>
      )}

      {/* Recording failed (non-network) — the audio is kept; the button above
          becomes a one-tap retry. Explain in plain English. */}
      {error && !isProcessing && (
        <p className="text-[13px] text-center text-[var(--brand-text-secondary)] opacity-80 leading-relaxed">
          {error}
        </p>
      )}

      {transcript && !isProcessing && (
        <div className="p-4 bg-[var(--glass-surface)] rounded-xl" style={{ boxShadow: 'inset 0 0 0 1px var(--glass-surface-hover)' }}>
          <p className="text-sm text-[var(--brand-text-secondary)] italic leading-relaxed">
            "{transcript}"
          </p>
        </div>
      )}
    </div>
  )
}
