/**
 * ShapingModal — Deep conversation to shape an existing unshaped project.
 *
 * Reuses the brainstorm shaping flow but operates on an existing project:
 * instead of creating a new project, it updates the existing one with
 * structured data and marks it as shaped.
 */

import { useState, useEffect, useRef } from 'react'
import { ArrowUp, Loader2, X } from 'lucide-react'
import { handleInputFocus } from '../../utils/keyboard'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'
import type { Project } from '../../types'

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
  echoes?: EchoItem[]
}

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

interface ShapingModalProps {
  project: Project
  isOpen: boolean
  onClose: () => void
}

export function ShapingModal({ project, isOpen, onClose }: ShapingModalProps) {
  const { updateProject } = useProjectStore()
  const { addToast } = useToast()

  const [history, setHistory] = useState<ConversationMessage[]>([
    {
      role: 'model',
      content: `Let's shape "${project.title}".${project.description ? ` You said: "${project.description}".` : ''} Tell me more — what's the real idea here?`,
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [history, thinking])

  // Reset when project changes
  useEffect(() => {
    if (isOpen) {
      setHistory([
        {
          role: 'model',
          content: `Let's shape "${project.title}".${project.description ? ` You said: "${project.description}".` : ''} Tell me more — what's the real idea here?`,
        },
      ])
      setChatInput('')
      setThinking(false)
      setIsReady(false)
      setExtracting(false)
    }
  }, [isOpen, project.id])

  const handleSend = async () => {
    const message = chatInput.trim()
    if (!message || thinking) return

    const userMsg: ConversationMessage = { role: 'user', content: message }
    const newHistory = [...history, userMsg]
    setHistory(newHistory)
    setChatInput('')
    setThinking(true)

    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'shaping',
          message,
          history: history.map(m => ({ role: m.role, content: m.content })),
          projectTitle: project.title,
          projectDescription: project.description,
        }),
      })
      const data = await res.json()
      setHistory([
        ...newHistory,
        { role: 'model', content: data.reply, echoes: data.echoes || [] },
      ])
      if (data.readyToExtract) setIsReady(true)
    } catch {
      setHistory([
        ...newHistory,
        { role: 'model', content: "Couldn't reach the server — try again." },
      ])
    } finally {
      setThinking(false)
    }
  }

  const handleExtractAndShape = async () => {
    setExtracting(true)
    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'extract',
          history: history.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()

      // Update the existing project with shaped data
      await updateProject(project.id, {
        title: data.title || project.title,
        description: data.description || project.description,
        type: data.type || project.type,
        metadata: {
          ...project.metadata,
          is_shaped: true,
          end_goal: data.end_goal || project.metadata?.end_goal,
          project_mode: data.project_mode || project.metadata?.project_mode || 'completion',
          studio_draft: data.genesisDraft || project.metadata?.studio_draft,
          tasks: data.first_step
            ? [
                { id: crypto.randomUUID(), text: data.first_step, done: false, created_at: new Date().toISOString(), order: 0 },
                ...(project.metadata?.tasks || []),
              ]
            : project.metadata?.tasks || [],
        },
      })

      addToast({
        title: 'Project shaped',
        description: `"${data.title || project.title}" is ready for Power Hour.`,
        variant: 'success',
      })
      onClose()
    } catch {
      addToast({
        title: 'Shaping failed',
        description: 'Try again.',
        variant: 'destructive',
      })
    } finally {
      setExtracting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="relative w-full max-w-lg mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden"
        style={{
          background: 'var(--brand-bg, #0a0a0f)',
          border: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-sm font-bold text-[var(--brand-text-primary)] aperture-header">Shape this project</h2>
            <p className="text-[11px] text-[var(--brand-text-secondary)] opacity-50">{project.title}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--glass-surface)] transition-colors">
            <X className="h-4 w-4 text-[var(--brand-text-secondary)]" />
          </button>
        </div>

        {/* Conversation */}
        <div
          ref={threadRef}
          className="overflow-y-auto p-4 space-y-4 scroll-minimal"
          style={{ maxHeight: '50vh' }}
        >
          {history.map((msg, i) => (
            <div key={i}>
              {msg.role === 'model' ? (
                <div className="pr-8">
                  <p className="text-[15px] leading-relaxed" style={{ color: 'var(--brand-text-secondary)', opacity: 0.75 }}>
                    {msg.content}
                  </p>
                  {msg.echoes && msg.echoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.echoes.map((echo, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--brand-text-secondary)', opacity: 0.5, border: '1px solid rgba(255,255,255,0.07)' }}
                          title={echo.snippet}
                        >
                          {echo.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="pl-8 flex justify-end">
                  <p className="text-[15px] leading-relaxed text-right" style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}>
                    {msg.content}
                  </p>
                </div>
              )}
            </div>
          ))}

          {thinking && (
            <div className="pr-8">
              <div className="flex gap-1 pt-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="block w-1 h-1 rounded-full"
                    style={{ background: 'var(--brand-text-secondary)', opacity: 0.4 }}
                    animate={{ opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <input
              placeholder="tell me more…"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              autoComplete="off"
              autoFocus
              className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
              style={{ color: 'var(--brand-text-primary)', fontSize: '15px' }}
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim() || thinking}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
              style={{ background: chatInput.trim() ? 'rgba(255,255,255,0.12)' : 'transparent', color: 'var(--brand-text-secondary)' }}
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Extract button */}
          <div className="flex justify-end mt-3">
            <motion.button
              onClick={handleExtractAndShape}
              disabled={history.length < 3 || extracting}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-all disabled:opacity-25"
              animate={isReady ? { opacity: [0.7, 1, 0.7] } : {}}
              transition={isReady ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
              style={{
                background: isReady ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)',
                color: 'var(--brand-text-primary)',
                border: isReady ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {extracting
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Shaping…</>
                : 'Shape it →'
              }
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
