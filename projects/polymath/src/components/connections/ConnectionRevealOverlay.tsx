/**
 * ConnectionRevealOverlay
 * The magic: a typewriter-style narrative that traces the path between two ideas,
 * with stepping stone animations as the report populates.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Layers, Brain, BookOpen } from 'lucide-react'
import type { ConnectionSourceType } from '../../types'

interface PathNode {
  id: string
  type: string
  title: string
  snippet: string
}

interface ConnectionRevealOverlayProps {
  open: boolean
  onClose: () => void
  sourceId: string
  sourceType: ConnectionSourceType
  targetId: string
  targetType: string
  targetTitle: string
  sourceTitle: string
}

const TYPE_ICONS: Record<string, typeof Layers> = {
  project: Layers,
  thought: Brain,
  memory: Brain,
  article: BookOpen,
}

const TYPE_COLORS: Record<string, string> = {
  project: 'rgb(var(--brand-primary-rgb))',
  thought: 'rgb(var(--brand-primary-rgb))',
  memory: 'rgb(var(--brand-primary-rgb))',
  article: 'rgb(var(--brand-primary-rgb))',
}

type Phase = 'tracing' | 'revealing' | 'complete'

export function ConnectionRevealOverlay({
  open,
  onClose,
  sourceId,
  sourceType,
  targetId,
  targetType,
  targetTitle,
  sourceTitle,
}: ConnectionRevealOverlayProps) {
  const [phase, setPhase] = useState<Phase>('tracing')
  const [path, setPath] = useState<PathNode[]>([])
  const [narrative, setNarrative] = useState('')
  const [displayedText, setDisplayedText] = useState('')
  const [activeNodeIndex, setActiveNodeIndex] = useState(-1)
  const [error, setError] = useState<string | null>(null)
  const narrativeRef = useRef<HTMLDivElement>(null)
  const typewriterRef = useRef<number | null>(null)

  // Fetch the path when overlay opens
  useEffect(() => {
    if (!open) {
      // Reset state when closed
      setPhase('tracing')
      setPath([])
      setNarrative('')
      setDisplayedText('')
      setActiveNodeIndex(-1)
      setError(null)
      if (typewriterRef.current) cancelAnimationFrame(typewriterRef.current)
      return
    }

    const findPath = async () => {
      setPhase('tracing')

      try {
        const response = await fetch('/api/connections?action=find-path', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId,
            sourceType,
            targetId,
            targetType,
          }),
        })

        if (!response.ok) throw new Error('Failed to trace connection')

        const data = await response.json()
        setPath(data.path || [])
        setNarrative(data.narrative || '')
        setPhase('revealing')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setPhase('complete')
      }
    }

    findPath()
  }, [open, sourceId, sourceType, targetId, targetType])

  // Typewriter effect with stepping stone detection
  useEffect(() => {
    if (phase !== 'revealing' || !narrative) return

    // Parse step markers from narrative
    const stepPattern = /\{\{STEP:(\d+)\}\}/g
    const cleanNarrative = narrative.replace(stepPattern, '')
    const stepPositions: Array<{ charIndex: number; nodeIndex: number }> = []

    let match
    let offset = 0
    const rawNarrative = narrative
    while ((match = stepPattern.exec(rawNarrative)) !== null) {
      const markerLength = match[0].length
      const charPosition = match.index - offset
      stepPositions.push({ charIndex: charPosition, nodeIndex: parseInt(match[1]) })
      offset += markerLength
    }

    // Light up first node immediately
    setActiveNodeIndex(0)

    let charIndex = 0
    const CHAR_DELAY = 18 // ms per character
    let lastTime = 0

    const tick = (time: number) => {
      if (!lastTime) lastTime = time

      if (time - lastTime >= CHAR_DELAY) {
        lastTime = time
        charIndex++
        setDisplayedText(cleanNarrative.slice(0, charIndex))

        // Check if we've hit a stepping stone
        for (const step of stepPositions) {
          if (charIndex >= step.charIndex && charIndex < step.charIndex + 3) {
            setActiveNodeIndex(step.nodeIndex)
          }
        }

        // Auto-scroll
        if (narrativeRef.current) {
          narrativeRef.current.scrollTop = narrativeRef.current.scrollHeight
        }

        if (charIndex >= cleanNarrative.length) {
          setPhase('complete')
          // Light up final node
          setActiveNodeIndex(path.length - 1)
          return
        }
      }

      typewriterRef.current = requestAnimationFrame(tick)
    }

    typewriterRef.current = requestAnimationFrame(tick)

    return () => {
      if (typewriterRef.current) cancelAnimationFrame(typewriterRef.current)
    }
  }, [phase, narrative, path.length])

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Overlay content */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="relative w-full max-w-2xl max-h-[85vh] mx-4 rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 14, 26, 0.99) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-primary" />
              <span className="text-sm font-semibold text-[var(--brand-text-secondary)]">Connection Path</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4 text-[var(--brand-text-muted)]" />
            </button>
          </div>

          {/* Path visualization — stepping stones */}
          <div className="px-6 py-5 border-b border-white/5">
            <div className="flex items-center justify-between relative">
              {/* Connecting line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-white/10 mx-6" />

              {path.length > 0 ? (
                path.map((node, i) => {
                  const Icon = TYPE_ICONS[node.type] || Layers
                  const color = TYPE_COLORS[node.type] || 'rgb(var(--brand-primary-rgb))'
                  const isActive = i <= activeNodeIndex
                  const isCurrentStep = i === activeNodeIndex

                  return (
                    <div key={node.id} className="relative flex flex-col items-center z-10" style={{ flex: 1 }}>
                      {/* Node dot */}
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{
                          scale: isActive ? 1 : 0.6,
                          opacity: isActive ? 1 : 0.3,
                        }}
                        transition={{ type: 'spring', damping: 15, stiffness: 200, delay: i * 0.1 }}
                        className="relative"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500"
                          style={{
                            backgroundColor: isActive ? `${color}20` : 'rgba(255,255,255,0.05)',
                            border: `2px solid ${isActive ? color : 'rgba(255,255,255,0.1)'}`,
                            boxShadow: isCurrentStep ? `0 0 20px ${color}40` : 'none',
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: isActive ? color : 'rgba(255,255,255,0.2)' }} />
                        </div>

                        {/* Pulse on active step */}
                        {isCurrentStep && phase === 'revealing' && (
                          <motion.div
                            initial={{ scale: 1, opacity: 0.5 }}
                            animate={{ scale: 1.8, opacity: 0 }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 rounded-full"
                            style={{ border: `1px solid ${color}` }}
                          />
                        )}
                      </motion.div>

                      {/* Title below node */}
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isActive ? 1 : 0.3 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-[10px] font-medium mt-2 text-center leading-tight max-w-[80px] truncate"
                        style={{ color: isActive ? 'var(--brand-text-secondary)' : 'var(--brand-text-muted)' }}
                        title={node.title}
                      >
                        {node.title}
                      </motion.p>
                    </div>
                  )
                })
              ) : (
                // Placeholder dots while tracing
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="relative flex flex-col items-center z-10" style={{ flex: 1 }}>
                    <div className="w-10 h-10 rounded-full bg-white/5 border-2 border-white/10 animate-pulse" />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Narrative body */}
          <div
            ref={narrativeRef}
            className="flex-1 overflow-y-auto px-8 py-6"
            style={{ minHeight: '200px' }}
          >
            {phase === 'tracing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-full gap-4 py-12"
              >
                <div className="relative">
                  <div className="h-8 w-8 border-2 border-brand-primary/30 border-t-brand-primary animate-spin rounded-full" />
                </div>
                <p className="text-sm text-[var(--brand-text-muted)] text-center">
                  Tracing the path between your ideas...
                </p>
              </motion.div>
            )}

            {error && (
              <div className="text-sm text-red-400 text-center py-8">
                {error}
              </div>
            )}

            {(phase === 'revealing' || phase === 'complete') && (
              <div className="space-y-4">
                {displayedText.split('\n\n').map((paragraph, i) => (
                  <p
                    key={i}
                    className="text-[15px] leading-relaxed"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    {paragraph}
                    {/* Blinking cursor on last paragraph while typing */}
                    {phase === 'revealing' && i === displayedText.split('\n\n').length - 1 && (
                      <span className="inline-block w-[2px] h-[1em] bg-brand-primary ml-0.5 animate-pulse align-text-bottom" />
                    )}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {phase === 'complete' && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-6 py-4 border-t border-white/5 flex items-center justify-between"
            >
              <p className="text-xs text-[var(--brand-text-muted)]">
                {Math.max(0, path.length - 2)} stepping stone{path.length - 2 !== 1 ? 's' : ''} between these ideas
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-brand-primary/10 text-brand-primary text-sm font-medium border border-brand-primary/20 hover:bg-brand-primary/20 transition-all"
              >
                Done
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
