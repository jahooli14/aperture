/**
 * Voice Input Component
 * Records audio and transcribes using Web Speech API
 */

import { useState, useEffect, useRef } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { Button } from './ui/button'

interface VoiceInputProps {
  onTranscript: (text: string) => void
  maxDuration?: number // seconds
  autoSubmit?: boolean
}

export function VoiceInput({ onTranscript, maxDuration = 30, autoSubmit = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [timeLeft, setTimeLeft] = useState(maxDuration)
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: any) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        setTranscript(finalTranscript + interimTranscript)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        stopRecording()
      }

      recognition.onend = () => {
        if (isRecording) {
          // Restart if we're still supposed to be recording
          recognition.start()
        }
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (isRecording) {
      // Start timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      setTimeLeft(maxDuration)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isRecording, maxDuration])

  const startRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    setTranscript('')
    setIsRecording(true)
    try {
      recognitionRef.current.start()
    } catch (error) {
      console.error('Error starting recognition:', error)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (transcript.trim()) {
      onTranscript(transcript.trim())
      if (autoSubmit) {
        setTranscript('')
      }
    }
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        onClick={toggleRecording}
        className={`w-full py-4 rounded-lg border-2 flex items-center justify-center gap-3 transition-smooth ${
          isRecording
            ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
            : 'border-neutral-300 bg-white text-neutral-700 hover:border-orange-500 hover:bg-orange-50'
        }`}
      >
        {isRecording ? (
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

      {transcript && (
        <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
          <p className="text-sm text-neutral-700">
            {transcript}
          </p>
        </div>
      )}
    </div>
  )
}
