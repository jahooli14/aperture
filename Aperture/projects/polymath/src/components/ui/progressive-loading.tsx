/**
 * Progressive Loading Component
 * Shows cycling messages for long operations to keep users engaged
 */

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingMessage {
  time: number // milliseconds from start
  message: string
  icon?: string
}

interface ProgressiveLoadingProps {
  messages: LoadingMessage[]
  duration?: number // Expected total duration in ms
  className?: string
}

export function ProgressiveLoading({ messages, duration, className = '' }: ProgressiveLoadingProps) {
  const [currentMessage, setCurrentMessage] = useState(messages[0]?.message || 'Loading...')
  const [currentIcon, setCurrentIcon] = useState(messages[0]?.icon)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const timers: NodeJS.Timeout[] = []

    // Schedule message changes
    messages.forEach((msg, index) => {
      if (index === 0) return // First message shown immediately

      const timer = setTimeout(() => {
        setCurrentMessage(msg.message)
        setCurrentIcon(msg.icon)
      }, msg.time)

      timers.push(timer)
    })

    // Update progress bar if duration provided
    let progressTimer: NodeJS.Timeout | null = null
    if (duration) {
      progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        const newProgress = Math.min((elapsed / duration) * 100, 95) // Cap at 95%
        setProgress(newProgress)
      }, 100)
    }

    return () => {
      timers.forEach(clearTimeout)
      if (progressTimer) clearInterval(progressTimer)
    }
  }, [messages, duration])

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--premium-blue)' }} />
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color: 'var(--premium-text-primary)' }}>
          {currentIcon && <span className="mr-2">{currentIcon}</span>}
          {currentMessage}
        </p>
        {duration && (
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
            <div
              className="h-full transition-all duration-200"
              style={{
                width: `${progress}%`,
                backgroundColor: 'var(--premium-blue)'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// Preset message sequences for common operations
export const LoadingPresets = {
  synthesis: [
    { time: 0, message: 'Analyzing your knowledge graph...', icon: '🧠' },
    { time: 5000, message: 'Finding cross-domain patterns...', icon: '🔍' },
    { time: 12000, message: 'Generating project ideas...', icon: '✨' },
    { time: 20000, message: 'Evaluating feasibility...', icon: '⚡' },
    { time: 28000, message: 'Almost ready...', icon: '🎯' },
  ],

  voiceProcessing: [
    { time: 0, message: 'Voice note saved ✓', icon: '🎤' },
    { time: 3000, message: 'Transcribing audio...', icon: '📝' },
    { time: 10000, message: 'Analyzing content...', icon: '🧠' },
    { time: 18000, message: 'Extracting insights...', icon: '✨' },
    { time: 25000, message: 'Finding connections...', icon: '🔗' },
  ],

  articleExtraction: [
    { time: 0, message: 'Fetching article...', icon: '📰' },
    { time: 2000, message: 'Extracting content...', icon: '📄' },
    { time: 5000, message: 'Cleaning formatting...', icon: '✨' },
    { time: 8000, message: 'Almost done...', icon: '⏳' },
  ],

  rssSync: [
    { time: 0, message: 'Connecting to feeds...', icon: '📡' },
    { time: 3000, message: 'Fetching new items...', icon: '📥' },
    { time: 7000, message: 'Processing updates...', icon: '⚙️' },
  ],
}
