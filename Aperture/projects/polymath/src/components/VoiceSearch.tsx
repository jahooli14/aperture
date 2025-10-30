/**
 * Voice Search Component
 * Enables voice-based search across all content types
 * Uses Web Speech API for speech recognition
 */

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Search, X, Loader2 } from 'lucide-react'
import { haptic } from '../utils/haptics'
import { useToast } from './ui/toast'

interface VoiceSearchProps {
  onSearch: (query: string) => void
  onClose?: () => void
  placeholder?: string
  autoStart?: boolean
}

export function VoiceSearch({
  onSearch,
  onClose,
  placeholder = "Say something to search...",
  autoStart = false
}: VoiceSearchProps) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef<any>(null)
  const { addToast } = useToast()

  useEffect(() => {
    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      addToast({
        title: 'Not supported',
        description: 'Voice search is not supported in this browser',
        variant: 'destructive'
      })
      return
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
      haptic.light()
    }

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript + ' '
        } else {
          interim += transcript
        }
      }

      if (final) {
        setTranscript((prev) => prev + final)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)

      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        addToast({
          title: 'Voice search error',
          description: `Failed to recognize speech: ${event.error}`,
          variant: 'destructive'
        })
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition

    // Auto-start if requested
    if (autoStart) {
      startListening()
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [autoStart])

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start()
        haptic.light()
      } catch (error) {
        console.error('Failed to start recognition:', error)
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      haptic.light()
    }
  }

  const handleSearch = () => {
    const query = transcript.trim()
    if (query) {
      onSearch(query)
      haptic.success()
    }
  }

  const handleClear = () => {
    setTranscript('')
    setInterimTranscript('')
    haptic.light()
  }

  const handleClose = () => {
    stopListening()
    handleClear()
    onClose?.()
  }

  const displayText = transcript + (interimTranscript ? ` ${interimTranscript}` : '')

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="premium-glass-strong border rounded-2xl p-6 shadow-2xl"
      style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5" style={{ color: 'var(--premium-blue)' }} />
          <h3 className="text-lg font-semibold" style={{ color: 'var(--premium-text-primary)' }}>
            Voice Search
          </h3>
        </div>
        {onClose && (
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--premium-text-tertiary)' }}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Transcript Display */}
      <div
        className="min-h-[100px] p-4 rounded-xl mb-4 border"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }}
      >
        {displayText ? (
          <p className="text-base leading-relaxed" style={{ color: 'var(--premium-text-primary)' }}>
            {displayText}
            {interimTranscript && (
              <span style={{ color: 'var(--premium-text-tertiary)', fontStyle: 'italic' }}>
                {' '}{interimTranscript}
              </span>
            )}
          </p>
        ) : (
          <p className="text-center" style={{ color: 'var(--premium-text-tertiary)' }}>
            {placeholder}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Microphone Button */}
        <button
          onClick={isListening ? stopListening : startListening}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${
            isListening ? 'animate-pulse' : ''
          }`}
          style={{
            background: isListening
              ? 'linear-gradient(135deg, #ef4444, #dc2626)'
              : 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
            boxShadow: isListening
              ? '0 0 20px rgba(239, 68, 68, 0.5)'
              : '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}
        >
          {isListening ? (
            <MicOff className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Clear Button */}
        {displayText && (
          <button
            onClick={handleClear}
            className="px-4 py-2 rounded-lg border transition-colors"
            style={{
              borderColor: 'rgba(255, 255, 255, 0.1)',
              color: 'var(--premium-text-secondary)'
            }}
          >
            Clear
          </button>
        )}

        {/* Search Button */}
        {transcript && (
          <button
            onClick={handleSearch}
            className="px-6 py-2 rounded-lg font-medium transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
              color: 'white',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            Search
          </button>
        )}
      </div>

      {/* Status */}
      <div className="mt-4 text-center text-sm" style={{ color: 'var(--premium-text-tertiary)' }}>
        {isListening ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Listening...
          </span>
        ) : transcript ? (
          'Tap microphone to continue or search'
        ) : (
          'Tap microphone to start'
        )}
      </div>
    </motion.div>
  )
}
