/**
 * Voice Commands Hook
 * Natural language voice navigation throughout the app
 */

import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback, useRef } from 'react'

export interface VoiceCommand {
  pattern: RegExp
  action: (match: RegExpMatchArray, navigate: any) => void
  description: string
  examples: string[]
}

interface VoiceCommandsState {
  isListening: boolean
  transcript: string
  error: string | null
  lastCommand: string | null
}

// Define all available voice commands
const createCommands = (navigate: any): VoiceCommand[] => [
  // Navigation commands
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:home|homepage|dashboard)/i,
    action: () => navigate('/'),
    description: 'Navigate to home',
    examples: ['go to home', 'open dashboard', 'take me to homepage']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:memories|thoughts)/i,
    action: () => navigate('/memories'),
    description: 'Navigate to memories',
    examples: ['go to memories', 'show thoughts', 'open memories']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:projects?|active projects)/i,
    action: () => navigate('/projects'),
    description: 'Navigate to projects',
    examples: ['go to projects', 'show projects', 'open active projects']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:reading|articles|reading queue)/i,
    action: () => navigate('/reading'),
    description: 'Navigate to reading',
    examples: ['go to reading', 'show articles', 'open reading queue']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:suggestions?|ideas)/i,
    action: () => navigate('/suggestions'),
    description: 'Navigate to suggestions',
    examples: ['go to suggestions', 'show ideas', 'open suggestions']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:today|daily queue|focus)/i,
    action: () => navigate('/today'),
    description: 'Navigate to today',
    examples: ['go to today', 'show daily queue', "show today's focus"]
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:timeline|history)/i,
    action: () => navigate('/timeline'),
    description: 'Navigate to timeline',
    examples: ['go to timeline', 'show history', 'open timeline']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:constellation|graph|connections|network)/i,
    action: () => navigate('/constellation'),
    description: 'Navigate to constellation',
    examples: ['go to constellation', 'show graph', 'open connections']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:insights?|analytics)/i,
    action: () => navigate('/insights'),
    description: 'Navigate to insights',
    examples: ['go to insights', 'show analytics', 'open insights']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:settings?|preferences)/i,
    action: () => navigate('/settings'),
    description: 'Navigate to settings',
    examples: ['go to settings', 'show preferences', 'open settings']
  },
  {
    pattern: /(?:go to|open|show|navigate to|take me to)\s+(?:the\s+)?(?:rss|feeds)/i,
    action: () => navigate('/rss'),
    description: 'Navigate to RSS feeds',
    examples: ['go to rss', 'show feeds', 'open rss']
  },

  // Search commands
  {
    pattern: /(?:search|find|look for)\s+(.+)/i,
    action: (match) => navigate(`/search?q=${encodeURIComponent(match[1])}`),
    description: 'Search for content',
    examples: ['search productivity', 'find project ideas', 'look for AI articles']
  },

  // Action commands
  {
    pattern: /(?:create|new|add|capture)\s+(?:a\s+)?(?:memory|thought|note)/i,
    action: () => navigate('/memories?action=create'),
    description: 'Create new memory',
    examples: ['create memory', 'capture thought', 'add note', 'new memory']
  },
  {
    pattern: /(?:create|new|add)\s+(?:a\s+)?(?:project)/i,
    action: () => navigate('/projects?action=create'),
    description: 'Create new project',
    examples: ['create project', 'new project', 'add project']
  },

  // System commands
  {
    pattern: /(?:go )?back/i,
    action: (_, nav) => nav(-1),
    description: 'Go back',
    examples: ['go back', 'back']
  },
  {
    pattern: /(?:go )?forward/i,
    action: (_, nav) => nav(1),
    description: 'Go forward',
    examples: ['go forward', 'forward']
  }
]

/**
 * Hook for voice command recognition and execution
 */
export function useVoiceCommands() {
  const navigate = useNavigate()
  const [state, setState] = useState<VoiceCommandsState>({
    isListening: false,
    transcript: '',
    error: null,
    lastCommand: null
  })

  const recognitionRef = useRef<any>(null)
  const commandsRef = useRef<VoiceCommand[]>(createCommands(navigate))

  // Update commands ref when navigate changes
  useEffect(() => {
    commandsRef.current = createCommands(navigate)
  }, [navigate])

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setState(prev => ({
        ...prev,
        error: 'Voice commands not supported in this browser'
      }))
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      console.log('[VoiceCommands] Recognized:', transcript)

      setState(prev => ({ ...prev, transcript }))

      // Try to match and execute command
      const executed = executeCommand(transcript)

      if (executed) {
        setState(prev => ({
          ...prev,
          lastCommand: transcript,
          isListening: false,
          transcript: ''
        }))
      } else {
        setState(prev => ({
          ...prev,
          error: `Command not recognized: "${transcript}"`,
          isListening: false
        }))
      }
    }

    recognition.onerror = (event: any) => {
      console.error('[VoiceCommands] Error:', event.error)
      setState(prev => ({
        ...prev,
        error: `Voice recognition error: ${event.error}`,
        isListening: false
      }))
    }

    recognition.onend = () => {
      setState(prev => ({ ...prev, isListening: false }))
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const executeCommand = (transcript: string): boolean => {
    for (const command of commandsRef.current) {
      const match = transcript.match(command.pattern)
      if (match) {
        console.log('[VoiceCommands] Executing:', command.description)
        command.action(match, navigate)
        return true
      }
    }
    return false
  }

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setState(prev => ({
        ...prev,
        error: 'Voice commands not supported'
      }))
      return
    }

    try {
      recognitionRef.current.start()
      setState(prev => ({
        ...prev,
        isListening: true,
        error: null,
        transcript: ''
      }))
    } catch (error) {
      console.error('[VoiceCommands] Failed to start:', error)
      setState(prev => ({
        ...prev,
        error: 'Failed to start voice recognition'
      }))
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setState(prev => ({ ...prev, isListening: false }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    startListening,
    stopListening,
    clearError,
    commands: commandsRef.current
  }
}
