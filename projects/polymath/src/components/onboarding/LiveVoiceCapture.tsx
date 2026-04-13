/**
 * LiveVoiceCapture — voice transport for Aperture onboarding.
 *
 * **Architectural note (April 2026):** The name was chosen during a planned
 * Gemini Live API integration. After testing, that architecture proved
 * unreliable for our use case — the native audio model is trained to be
 * conversational and consistently paraphrases or responds to text we try
 * to feed it via `sendRealtimeInput({ text })`, plus we hit WebSocket 1006
 * abnormal closures. So the current implementation uses the proven stack:
 *
 *   - MediaRecorder (via `useMediaRecorderVoice`) for microphone capture
 *   - Existing /api/memories?action=transcribe endpoint for speech-to-text
 *   - Browser SpeechSynthesis for TTS (Kore-like female voice if available)
 *
 * The component keeps the same external API (`say(text)`, `interrupt()`,
 * `onUserTurn`, `onReady`, `onError`) so the rest of the onboarding code
 * is agnostic to the underlying voice transport. If Google ships a real
 * TTS mode on the Live API or we build a gemini-2.5-flash-preview-tts
 * streaming endpoint, swapping the implementation here is a localised
 * change.
 */

import { useEffect, useImperativeHandle, useRef, useState, forwardRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Mic, Loader2, Square } from 'lucide-react'
import { useMediaRecorderVoice } from '../../hooks/useMediaRecorderVoice'

// ── Public API ─────────────────────────────────────────────────────────────

export interface LiveVoiceCaptureHandle {
  /** Speak a string via browser TTS. Resolves when playback ends. */
  say: (text: string) => Promise<void>
  /** Cancel any in-flight TTS. */
  interrupt: () => void
}

interface LiveVoiceCaptureProps {
  /** Called when a user-spoken turn completes with the final transcript. */
  onUserTurn: (transcript: string) => void
  /** Called once when the voice layer is ready. */
  onReady?: () => void
  /** Called on any unrecoverable error. */
  onError?: (message: string) => void
  /** Render a level meter / waveform — defaults to a pulsing mic icon. */
  showVisualizer?: boolean
}

// ── TTS helper ─────────────────────────────────────────────────────────────
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find(v => /Google UK English Female/i.test(v.name)) ||
    voices.find(v => /Samantha|Karen|Moira|Tessa/i.test(v.name)) ||
    voices.find(v => /en-GB.*Female/i.test(v.name) || /en-US.*Female/i.test(v.name)) ||
    voices.find(v => /en-GB|en-US/i.test(v.lang)) ||
    null
  )
}

function speak(text: string): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve()
      return
    }
    if (!text || text.trim().length === 0) {
      resolve()
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.02
      utter.pitch = 1.0
      utter.volume = 1.0
      const v = pickVoice()
      if (v) utter.voice = v
      utter.onend = () => resolve()
      utter.onerror = () => resolve()
      window.speechSynthesis.speak(utter)
    } catch {
      resolve()
    }
  })
}

// ── Component ──────────────────────────────────────────────────────────────

export const LiveVoiceCapture = forwardRef<LiveVoiceCaptureHandle, LiveVoiceCaptureProps>(
  function LiveVoiceCapture({ onUserTurn, onReady, onError, showVisualizer = true }, ref) {
    const readyFiredRef = useRef(false)
    const [speaking, setSpeaking] = useState(false)

    const handleTranscript = useCallback(
      (text: string) => {
        onUserTurn(text)
      },
      [onUserTurn],
    )

    const handleVoiceError = useCallback(
      (msg: string) => {
        onError?.(msg)
      },
      [onError],
    )

    const {
      isRecording,
      isProcessing,
      isSupported,
      startRecording,
      stopRecording,
    } = useMediaRecorderVoice({
      onTranscript: handleTranscript,
      onError: handleVoiceError,
      maxDuration: 60,
      autoSubmit: true,
    })

    // Fire onReady once on mount (nothing to "connect" anymore — MediaRecorder
    // is available as soon as the component renders if the browser supports it).
    useEffect(() => {
      if (readyFiredRef.current) return
      if (!isSupported) {
        handleVoiceError("This browser doesn't support voice recording. Tap 'type instead'.")
        return
      }
      readyFiredRef.current = true
      onReady?.()
    }, [isSupported, onReady, handleVoiceError])

    // Start recording automatically when we're not currently speaking and not
    // already recording / processing.
    useEffect(() => {
      if (!isSupported) return
      if (speaking) return
      if (isRecording || isProcessing) return
      const t = setTimeout(() => {
        startRecording().catch(err => {
          console.warn('[LiveVoiceCapture] startRecording failed', err)
        })
      }, 250)
      return () => clearTimeout(t)
    }, [speaking, isRecording, isProcessing, isSupported, startRecording])

    // Cleanup TTS on unmount
    useEffect(() => {
      return () => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
      }
    }, [])

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        say: async (text: string) => {
          // Pause recording while we speak so we don't capture our own voice.
          if (isRecording) {
            try { await stopRecording() } catch {}
          }
          setSpeaking(true)
          try {
            await speak(text)
          } finally {
            setSpeaking(false)
          }
        },
        interrupt: () => {
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel()
          }
          setSpeaking(false)
        },
      }),
      [isRecording, stopRecording],
    )

    // Visual
    if (!showVisualizer) return null

    if (!isSupported) {
      return (
        <div className="flex flex-col items-center gap-2 text-sm" style={{ color: 'var(--brand-danger, #dc2626)' }}>
          <Mic className="h-6 w-6 opacity-50" />
          <span>Voice not supported in this browser.</span>
        </div>
      )
    }

    const statusLabel = isProcessing
      ? 'thinking'
      : speaking
        ? 'speaking'
        : isRecording
          ? 'listening'
          : 'ready'

    return (
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={{
            scale: isRecording ? [1, 1.08, 1] : 1,
            opacity: speaking ? 0.5 : 1,
          }}
          transition={{
            duration: isRecording ? 1.6 : 0.3,
            repeat: isRecording ? Infinity : 0,
            ease: 'easeInOut',
          }}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(var(--brand-primary-rgb),0.12)',
            border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
          }}
        >
          {isProcessing ? (
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--brand-primary)' }} />
          ) : speaking ? (
            <Square className="h-5 w-5" style={{ color: 'var(--brand-primary)' }} />
          ) : (
            <Mic className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
          )}
        </motion.div>
        <span
          className="text-[11px] uppercase tracking-wide opacity-50"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          {statusLabel}
        </span>
      </div>
    )
  },
)
