/**
 * Media Recorder Voice Hook - Reliable voice recording for web and Android
 * Uses MediaRecorder API instead of unreliable Web Speech API
 * Transcription happens via Gemini API (could be swapped for Deepgram/AssemblyAI)
 */

import { useState, useRef, useCallback } from 'react'
import { VoiceRecorder } from 'capacitor-voice-recorder'
import { isNative, base64ToBlob } from '../lib/platform'

interface UseMediaRecorderVoiceOptions {
  onTranscript: (text: string) => void
  maxDuration?: number // seconds
  autoSubmit?: boolean
}

export function useMediaRecorderVoice({
  onTranscript,
  maxDuration = 30,
  autoSubmit = false
}: UseMediaRecorderVoiceOptions) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [timeLeft, setTimeLeft] = useState(maxDuration)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

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

    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty - no audio was recorded')
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

      throw new Error(errorMessage)
    }

    const result = await response.json()
    console.log('[Transcribe] API response:', result)

    if (!result.text || result.text.trim().length === 0) {
      throw new Error('No transcription returned from API')
    }

    console.log('[Transcribe] Success:', result.text)
    return result.text
  }

  /**
   * Start recording - Native platform
   */
  const startNativeRecording = async () => {
    try {
      const result = await VoiceRecorder.hasAudioRecordingPermission()
      if (!result.value) {
        const permResult = await VoiceRecorder.requestAudioRecordingPermission()
        if (!permResult.value) {
          alert('Microphone permission is required for voice recording')
          return
        }
      }

      await VoiceRecorder.startRecording()
      setHasPermission(true)
      setIsRecording(true)
      startTimer()
      console.log('[Native] Recording started')
    } catch (error) {
      console.error('[Native] Failed to start recording:', error)
      alert('Failed to start recording. Please try again.')
    }
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
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log('[Web] Chunk received:', event.data.size, 'bytes')
        }
      }

      // Handle recording errors
      mediaRecorder.onerror = (error) => {
        console.error('[Web] MediaRecorder error:', error)
        alert('Recording error occurred. Please try again.')
        stopWebRecording()
      }

      // Start recording with 1 second chunks
      mediaRecorder.start(1000)
      setIsRecording(true)
      startTimer()

      console.log('[Web] Recording started with format:', mimeType)
    } catch (error: any) {
      console.error('[Web] Failed to start recording:', error)

      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.')
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.')
      } else {
        alert(`Failed to start recording: ${error.message}`)
      }
    }
  }

  /**
   * Stop recording - Native platform
   */
  const stopNativeRecording = async () => {
    setIsRecording(false)
    stopTimer()

    try {
      setIsProcessing(true)
      const result = await VoiceRecorder.stopRecording()

      if (!result.value || !result.value.recordDataBase64) {
        throw new Error('No audio data recorded')
      }

      console.log('[Native] Recording stopped, transcribing...')

      // Convert to blob
      const audioBlob = base64ToBlob(result.value.recordDataBase64, 'audio/aac')

      // Transcribe
      const text = await transcribeAudio(audioBlob)

      setTranscript(text)
      onTranscript(text)

      if (autoSubmit) {
        setTranscript('')
      }
    } catch (error) {
      console.error('[Native] Failed to process recording:', error)
      alert('Failed to process recording. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Stop recording - Web platform
   */
  const stopWebRecording = async () => {
    setIsRecording(false)
    stopTimer()

    // Stop MediaRecorder and wait for final chunks
    const waitForStop = new Promise<void>((resolve) => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.onstop = () => {
          console.log('[Web] MediaRecorder stopped')
          resolve()
        }
        mediaRecorderRef.current.stop()
      } else {
        resolve()
      }
    })

    try {
      // Wait for recording to fully stop
      await waitForStop

      // Wait a bit more for any pending chunks
      await new Promise(resolve => setTimeout(resolve, 200))

      // Release microphone
      streamRef.current?.getTracks().forEach(track => track.stop())

      console.log('[Web] Chunks collected:', chunksRef.current.length)

      if (chunksRef.current.length === 0) {
        console.error('[Web] No audio chunks recorded')
        alert('No audio was recorded. Please try again and make sure to speak.')
        return
      }

      setIsProcessing(true)

      // Combine chunks into single blob
      const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
      const audioBlob = new Blob(chunksRef.current, { type: mimeType })

      console.log('[Web] Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type)

      if (audioBlob.size === 0) {
        throw new Error('Audio blob is empty')
      }

      // Transcribe
      const text = await transcribeAudio(audioBlob)

      setTranscript(text)
      onTranscript(text)

      if (autoSubmit) {
        setTranscript('')
      }
    } catch (error) {
      console.error('[Web] Failed to process recording:', error)
      const message = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to process recording: ${message}`)
    } finally {
      setIsProcessing(false)
      chunksRef.current = []
    }
  }

  /**
   * Start recording (platform-agnostic)
   */
  const startRecording = useCallback(async () => {
    if (isNative()) {
      await startNativeRecording()
    } else {
      await startWebRecording()
    }
  }, [])

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

  /**
   * Start countdown timer
   */
  const startTimer = () => {
    setTimeLeft(maxDuration)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
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

  return {
    isRecording,
    transcript,
    timeLeft,
    hasPermission,
    isProcessing,
    startRecording,
    stopRecording,
    toggleRecording
  }
}
