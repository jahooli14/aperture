/**
 * Media Recorder Voice Hook - Reliable voice recording for web and Android
 * Uses MediaRecorder API instead of unreliable Web Speech API
 * Transcription happens via Gemini API (could be swapped for Deepgram/AssemblyAI)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { VoiceRecorder } from 'capacitor-voice-recorder'
import { isNative, base64ToBlob } from '../lib/platform'

interface UseMediaRecorderVoiceOptions {
  onTranscript: (text: string) => void
  onError?: (message: string) => void
  maxDuration?: number // seconds
  autoSubmit?: boolean
}

export function useMediaRecorderVoice({
  onTranscript,
  onError,
  maxDuration = 120,
  autoSubmit = false
}: UseMediaRecorderVoiceOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [timeLeft, setTimeLeft] = useState(maxDuration)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  // When transcription fails for a non-network reason we keep the recording
  // around so the user can retry without re-recording — losing a voice note
  // to a transient blip is the worst thing this flow can do.
  const [error, setError] = useState<string | null>(null)
  const [canRetry, setCanRetry] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const recordingStartTimeRef = useRef<number>(0)
  // The last recorded blob, retained so retry() can resend it.
  const lastBlobRef = useRef<Blob | null>(null)

  const MIN_RECORDING_MS = 2000 // Discard recordings shorter than 2 seconds

  // Check support on mount
  useEffect(() => {
    if (typeof MediaRecorder === 'undefined' && !isNative()) {
      console.error('[MediaRecorder] Not supported in this browser')
      setIsSupported(false)
    }
  }, [])

  /**
   * Get best supported audio format for MediaRecorder
   */
  const getBestAudioFormat = useCallback((): string => {
    const formats = [
      'audio/webm;codecs=opus', // Chrome, Firefox, Safari 18.4+
      'audio/webm',              // Chrome, Firefox
      'audio/mp4',               // Safari < 18.4
      'audio/wav'                // Fallback
    ]

    for (const format of formats) {
      if (MediaRecorder.isTypeSupported(format)) {
        console.log('[MediaRecorder] Using format:', format)
        return format
      }
    }

    console.warn('[MediaRecorder] No supported format found, using default')
    return 'audio/webm'
  }, [])

  /**
   * Transcribe audio using Gemini API
   */
  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    console.log('[Transcribe] Preparing to send audio:', audioBlob.size, 'bytes, type:', audioBlob.type)

    // Validate blob size to prevent memory crashes
    const MAX_AUDIO_SIZE = 25 * 1024 * 1024 // 25MB limit
    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty - no audio was recorded')
    }
    if (audioBlob.size > MAX_AUDIO_SIZE) {
      const sizeMB = (audioBlob.size / 1024 / 1024).toFixed(1)
      throw new Error(
        `Audio file too large (${sizeMB}MB). Maximum size is 25MB. Try recording a shorter clip.`
      )
    }

    const formData = new FormData()

    // Determine file extension based on MIME type
    let fileName = 'recording.webm'
    if (audioBlob.type.includes('mp4')) {
      fileName = 'recording.mp4'
    } else if (audioBlob.type.includes('wav')) {
      fileName = 'recording.wav'
    } else if (audioBlob.type.includes('aac')) {
      fileName = 'recording.aac'
    }

    formData.append('audio', audioBlob, fileName)

    console.log('[Transcribe] Sending to API:', fileName)

    // Send once, and on a transient failure (network blip or 5xx) retry a
    // single time after a short backoff before giving up. A flaky connection
    // shouldn't cost the user their recording.
    const sendOnce = async () => {
      const response = await fetch('/api/memories?action=transcribe', {
        method: 'POST',
        body: formData
      })

      console.log('[Transcribe] Response status:', response.status)

      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('text/html')) {
          throw new Error('Transcription API not available. Please check deployment.')
        }

        let errorMessage = 'Transcription failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.details || errorData.error || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }

        const err = new Error(errorMessage) as Error & { status?: number }
        err.status = response.status
        throw err
      }

      const result = await response.json()
      console.log('[Transcribe] API response:', result)

      if (!result.text || result.text.trim().length === 0) {
        throw new Error('No transcription returned from API')
      }

      console.log('[Transcribe] Success:', result.text)
      return result.text as string
    }

    try {
      return await sendOnce()
    } catch (firstErr: any) {
      const isTransient =
        firstErr instanceof TypeError || // network failure
        firstErr?.message?.includes('Failed to fetch') ||
        firstErr?.message?.includes('NetworkError') ||
        (typeof firstErr?.status === 'number' && firstErr.status >= 500)
      if (!isTransient) throw firstErr
      console.warn('[Transcribe] Transient failure, retrying once:', firstErr?.message)
      await new Promise(r => setTimeout(r, 800))
      return await sendOnce()
    }
  }

  /**
   * Shared post-recording path: transcribe, and route failures sensibly.
   * - Success → emit transcript.
   * - Real network failure → queue offline so nothing is lost.
   * - Any other failure → keep the blob, surface a retryable error.
   */
  const processAndTranscribe = async (audioBlob: Blob, mimeType: string) => {
    lastBlobRef.current = audioBlob
    setError(null)
    setCanRetry(false)
    setIsProcessing(true)
    try {
      const text = await transcribeAudio(audioBlob)
      setTranscript(text)
      onTranscript(text)
      lastBlobRef.current = null
      if (autoSubmit) setTranscript('')
    } catch (transcribeError: any) {
      console.error('[Transcribe] Failed:', transcribeError?.message)

      const isNetworkError =
        transcribeError?.message?.includes('Failed to fetch') ||
        transcribeError?.message?.includes('NetworkError') ||
        transcribeError instanceof TypeError

      if (isNetworkError) {
        // Genuinely offline — save the audio so the sync manager can
        // transcribe it once we're back online. Don't create a placeholder note.
        console.log('[Transcribe] Network error — saving to IndexedDB for later')
        const { db } = await import('../lib/db')
        const { queueOperation } = await import('../lib/offlineQueue')
        const captureId = await db.addPendingCapture({ blob: audioBlob, mimeType })
        await queueOperation('capture_media', { captureId })
        // Bump the visible "pending sync" count immediately so the queued
        // note shows up in the offline indicator — otherwise it stays hidden
        // until the next sync tick and the capture feels lost.
        try {
          const { useOfflineStore } = await import('../stores/useOfflineStore')
          await useOfflineStore.getState().updateQueueSize()
        } catch { /* non-critical */ }
        window.dispatchEvent(new CustomEvent('voice-capture-queued-offline', {
          detail: { message: 'Voice note saved offline and will be transcribed when back online' }
        }))
        lastBlobRef.current = null
        setTranscript('')
      } else {
        // Server/API error while online — keep the recording so the user can
        // retry without speaking again, and surface a plain-English message.
        setError("Couldn't transcribe that — your recording is safe. Tap to try again.")
        setCanRetry(true)
        onError?.("Couldn't transcribe that — tap to try again.")
      }
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Retry transcription on the last recording without re-recording.
   */
  const retry = useCallback(async () => {
    const blob = lastBlobRef.current
    if (!blob || isProcessing) return
    await processAndTranscribe(blob, blob.type || 'audio/webm')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessing])

  /**
   * Start recording - Native platform
   */
  const startNativeRecording = async () => {
    try {
      const result = await VoiceRecorder.hasAudioRecordingPermission()
      if (!result.value) {
        const permResult = await VoiceRecorder.requestAudioRecordingPermission()
        if (!permResult.value) {
          onError?.('Microphone permission is required for voice recording')
          return
        }
      }

      await VoiceRecorder.startRecording()
      setHasPermission(true)
      setIsRecording(true)
      recordingStartTimeRef.current = Date.now()
      startTimer()
      console.log('[Native] Recording started')
    } catch (error) {
      console.error('[Native] Failed to start recording:', error)
      onError?.('Failed to start recording. Please try again.')
    }
  }

  /**
   * Start countdown timer
   */
  const startTimer = () => {
    setTimeLeft(maxDuration)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Call stop via the public API
          stopRecording()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  /**
   * Stop countdown timer
   */
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimeLeft(maxDuration)
  }

  /**
   * Start recording - Web platform
   */
  const startWebRecording = async () => {
    try {
      console.log('[Web] Requesting microphone access...')

      // Request microphone with optimal settings for voice
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream
      setHasPermission(true)

      // Determine best audio format
      const mimeType = getBestAudioFormat()

      // Create MediaRecorder with lower bitrate for voice
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000 // 32kbps sufficient for voice
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event) => {
        console.log('[Web] dataavailable event:', event.data.size, 'bytes')
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log('[Web] Chunk added, total chunks:', chunksRef.current.length)
        } else {
          console.warn('[Web] Received empty chunk')
        }
      }

      // Handle recording stop
      mediaRecorder.onstop = () => {
        console.log('[Web] MediaRecorder stopped, total chunks:', chunksRef.current.length)
      }

      // Handle recording errors
      mediaRecorder.onerror = (error) => {
        console.error('[Web] MediaRecorder error:', error)
        onError?.('Recording error occurred. Please try again.')
        stopWebRecording()
      }

      // Start recording - we'll explicitly request data before stopping
      mediaRecorder.start()
      console.log('[Web] MediaRecorder state after start():', mediaRecorder.state)

      setIsRecording(true)
      recordingStartTimeRef.current = Date.now()
      startTimer()

      console.log('[Web] Recording started with format:', mimeType)
    } catch (error: any) {
      console.error('[Web] Failed to start recording:', error)

      if (error.name === 'NotAllowedError') {
        onError?.('Microphone access denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        onError?.('No microphone found. Please connect a microphone and try again.')
      } else {
        onError?.(`Failed to start recording: ${error.message}`)
      }
    }
  }

  /**
   * Stop recording - Native platform
   */
  const stopNativeRecording = async () => {
    const elapsed = Date.now() - recordingStartTimeRef.current
    setIsRecording(false)
    stopTimer()

    if (elapsed < MIN_RECORDING_MS) {
      console.log('[Native] Recording too short:', elapsed, 'ms  discarding')
      window.dispatchEvent(new CustomEvent('voice-capture-too-short'))
      try { await VoiceRecorder.stopRecording() } catch (_) {}
      return
    }

    try {
      // Show the processing state immediately while we stop + transcribe so
      // the button never flashes back to "Tap to talk" mid-flight.
      setIsProcessing(true)
      const result = await VoiceRecorder.stopRecording()

      if (!result.value || !result.value.recordDataBase64) {
        throw new Error('No audio data recorded')
      }

      console.log('[Native] Recording stopped, transcribing...')

      // Convert to blob and hand off to the shared transcribe/retry/offline path.
      const audioBlob = base64ToBlob(result.value.recordDataBase64, 'audio/aac')
      await processAndTranscribe(audioBlob, 'audio/aac')
    } catch (error) {
      console.error('[Native] Failed to process recording:', error)
      onError?.('Failed to process recording. Please try again.')
      setIsProcessing(false)
    }
  }

  /**
   * Stop recording - Web platform
   */
  const stopWebRecording = async () => {
    const elapsed = Date.now() - recordingStartTimeRef.current
    console.log('[Web] Stopping recording, current state:', mediaRecorderRef.current?.state)
    setIsRecording(false)
    stopTimer()

    if (elapsed < MIN_RECORDING_MS) {
      console.log('[Web] Recording too short:', elapsed, 'ms  discarding')
      window.dispatchEvent(new CustomEvent('voice-capture-too-short'))
      streamRef.current?.getTracks().forEach(track => track.stop())
      mediaRecorderRef.current?.stop()
      chunksRef.current = []
      return
    }

    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
      console.warn('[Web] MediaRecorder not in recording state:', mediaRecorderRef.current?.state)
      // If we're already starting or inactive, just reset states and return
      // This often happens if the user releases the button before the mic fully initialized
      setIsRecording(false)
      stopTimer()
      return
    }

    // Show the processing state immediately so the button doesn't flash back
    // to "Tap to talk" during the stop wait (can be up to 3s).
    setIsProcessing(true)

    // Stop MediaRecorder and wait for ondataavailable + onstop events
    const waitForStop = new Promise<void>((resolve) => {
      console.log('[Web] Setting up stop handlers')

      const timeoutId = setTimeout(() => {
        console.warn('[Web] Stop event timeout after 3s - proceeding anyway')
        resolve()
      }, 3000)

      const originalOnStop = mediaRecorderRef.current!.onstop
      mediaRecorderRef.current!.onstop = (event) => {
        console.log('[Web] onstop fired')
        clearTimeout(timeoutId)
        if (originalOnStop) {
          originalOnStop.call(mediaRecorderRef.current!, event)
        }
        // Give extra time for final ondataavailable event
        setTimeout(resolve, 100) // 100ms is safe for final buffers
      }

      console.log('[Web] Calling stop() on MediaRecorder')
      mediaRecorderRef.current!.stop()
    })

    try {
      // Wait for recording to fully stop and all events to fire
      await waitForStop

      console.log('[Web] Chunks collected after waiting:', chunksRef.current.length)

      // Release microphone
      streamRef.current?.getTracks().forEach(track => track.stop())

      if (chunksRef.current.length === 0) {
        console.error('[Web] No audio chunks recorded - this indicates the dataavailable event never fired')
        onError?.('No audio was recorded. Please try again and make sure to speak.')
        setIsProcessing(false)
        return
      }

      // Combine chunks into single blob
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
      const audioBlob = new Blob(chunksRef.current, { type: mimeType })

      console.log('[Web] Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type)

      if (audioBlob.size === 0) {
        throw new Error('Audio blob is empty')
      }

      // Hand off to the shared transcribe/retry/offline path.
      await processAndTranscribe(audioBlob, mimeType)
    } catch (error) {
      console.error('[Web] Failed to process recording:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      onError?.(`Failed to process recording: ${message}`)
      setIsProcessing(false)
    } finally {
      chunksRef.current = []
    }
  }

  /**
   * Start recording (platform-agnostic)
   * Memoized to ensure stable reference for useEffect dependencies
   */
  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) {
      console.log('[MediaRecorder] Already recording or processing, skipping start')
      return
    }
    if (isNative()) {
      await startNativeRecording()
    } else {
      await startWebRecording()
    }
  }, [isRecording, isProcessing])

  /**
   * Stop recording (platform-agnostic)
   */
  const stopRecording = useCallback(async () => {
    if (isNative()) {
      await stopNativeRecording()
    } else {
      await stopWebRecording()
    }
  }, [])

  /**
   * Toggle recording
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  const clearError = useCallback(() => {
    setError(null)
    setCanRetry(false)
    lastBlobRef.current = null
  }, [])

  return {
    isRecording,
    transcript,
    timeLeft,
    hasPermission,
    isProcessing,
    isSupported,
    error,
    canRetry,
    retry,
    clearError,
    startRecording,
    stopRecording,
    toggleRecording
  }
}
