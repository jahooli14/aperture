import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Check, X, Loader } from 'lucide-react'
import { useAIStore } from '../stores/useAIStore'
import { transcribeVoiceNote } from '../lib/gemini'
import type { GeminiContext } from '../lib/gemini'

type InsertTarget = 'prose' | 'footnotes'

interface Props {
  ctx: GeminiContext
  onInsert: (text: string, target: InsertTarget) => void
}

type State = 'idle' | 'recording' | 'processing' | 'preview' | 'error'

export default function VoiceNoteButton({ ctx, onInsert }: Props) {
  const { apiKey } = useAIStore()
  const resolvedKey = apiKey || (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || null

  const [state, setState] = useState<State>('idle')
  const [previewText, setPreviewText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [recordingSeconds, setRecordingSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)

  const startRecording = useCallback(async () => {
    if (!resolvedKey) {
      setErrorMsg('No Gemini API key set. Add one in the AI assistant.')
      setState('error')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)

        const blob = new Blob(chunksRef.current, { type: mimeType })
        if (blob.size === 0) {
          setState('idle')
          return
        }

        setState('processing')

        try {
          const base64 = await blobToBase64(blob)
          const cleaned = await transcribeVoiceNote(resolvedKey, base64, mimeType, ctx)
          setPreviewText(cleaned.trim())
          setState('preview')
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Transcription failed'
          setErrorMsg(msg)
          setState('error')
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setRecordingSeconds(0)
      setState('recording')

      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } catch {
      setErrorMsg('Microphone access denied. Check your browser permissions.')
      setState('error')
    }
  }, [resolvedKey, ctx])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
  }, [])

  const handleInsert = (target: InsertTarget) => {
    onInsert(previewText, target)
    setPreviewText('')
    setState('idle')
  }

  const handleDiscard = () => {
    setPreviewText('')
    setState('idle')
  }

  const handleErrorDismiss = () => {
    setErrorMsg('')
    setState('idle')
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
      {/* Mic button */}
      <button
        onClick={state === 'recording' ? stopRecording : startRecording}
        disabled={state === 'processing'}
        className={`p-2 rounded-lg transition-colors relative ${
          state === 'recording'
            ? 'bg-red-600/20 text-red-400'
            : state === 'processing'
            ? 'text-ink-600'
            : 'text-ink-400'
        }`}
        title={state === 'recording' ? 'Stop recording' : 'Record voice note'}
      >
        {state === 'processing' ? (
          <Loader className="w-5 h-5 animate-spin" />
        ) : state === 'recording' ? (
          <>
            <MicOff className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
          </>
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </button>

      {/* Recording time badge */}
      <AnimatePresence>
        {state === 'recording' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="text-xs text-red-400 font-mono font-medium px-1"
          >
            {formatTime(recordingSeconds)}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Preview / Error modal */}
      <AnimatePresence>
        {(state === 'preview' || state === 'error') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={state === 'error' ? handleErrorDismiss : undefined}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-lg bg-ink-900 border border-ink-700 rounded-t-2xl p-5 pb-safe"
              onClick={e => e.stopPropagation()}
            >
              {state === 'error' ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-red-900/40 flex items-center justify-center">
                      <MicOff className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-sm font-medium text-ink-200">Voice note failed</span>
                  </div>
                  <p className="text-sm text-ink-400 mb-4">{errorMsg}</p>
                  <button
                    onClick={handleErrorDismiss}
                    className="w-full py-2.5 bg-ink-800 rounded-xl text-sm text-ink-300"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-purple-900/40 flex items-center justify-center">
                      <Mic className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-ink-200">Voice note</span>
                    <span className="ml-auto text-xs text-ink-500">AI cleaned</span>
                  </div>

                  <div className="bg-ink-800 rounded-xl p-3 mb-4 max-h-48 overflow-y-auto">
                    <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">{previewText}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleInsert('prose')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-purple-600/20 border border-purple-600/40 rounded-xl text-sm text-purple-300"
                    >
                      <Check className="w-4 h-4" />
                      Add to prose
                    </button>
                    <button
                      onClick={() => handleInsert('footnotes')}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-ink-700 rounded-xl text-sm text-ink-300"
                    >
                      Add to notes
                    </button>
                    <button
                      onClick={handleDiscard}
                      className="p-2.5 bg-ink-800 rounded-xl text-ink-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip "data:<mime>;base64," prefix
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
