/**
 * Inline Guide
 *
 * The project's AI guide, rendered inline on the page — not a modal,
 * not a bottom sheet. It's a conversation thread woven into the project
 * view. The AI opens with a contextual greeting and a proactive question
 * about what the project is missing. You respond, it responds, and the
 * project evolves.
 *
 * Loads the session brief on mount, then uses the brainstorm API for
 * ongoing conversation.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowUp, Plus, Check, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types'
import type { Task } from './TaskList'
import { useProjectStore } from '../../stores/useProjectStore'
import type { ChatTurn } from '../../types'

const MAX_PERSISTED_TURNS = 40

interface SuggestedTask {
  text: string
  task_type: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

type Phase = 'shaping' | 'building' | 'closing' | 'stale' | 'fresh'

interface SessionBrief {
  greeting: string
  phase: Phase
  phaseLabel: string
  focusSuggestion: string
  proactiveQuestion: string
  knowledgeNudge: string | null
  momentum: 'rising' | 'steady' | 'fading' | 'cold'
  completedSinceLastVisit: string[]
  stats: {
    totalTasks: number
    completedTasks: number
    daysSinceActive: number
    progressPercent: number
  }
}

type Message =
  | { kind: 'guide'; content: string; suggestedTasks?: SuggestedTask[]; echoes?: EchoItem[] }
  | { kind: 'you'; content: string }

interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit'
  taskId: string
  newText?: string
}

interface InlineGuideProps {
  project: Project
  recentCompletions: string[]
  onAddTask: (task: {
    text: string
    task_type?: 'ignition' | 'core' | 'shutdown'
    estimated_minutes?: number
    reasoning?: string
  }) => void
  onUpdateTasks?: (tasks: Task[]) => Promise<void>
}

export function InlineGuide({
  project,
  recentCompletions,
  onAddTask,
  onUpdateTasks,
}: InlineGuideProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set())
  const [brief, setBrief] = useState<SessionBrief | null>(null)
  const [briefLoading, setBriefLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateProjectMeta = useProjectStore(state => state.updateProject)

  // Build conversation history for API
  const getApiHistory = useCallback(() => {
    return messages
      .map(m => ({
        role: m.kind === 'you' ? 'user' as const : 'model' as const,
        content: m.content,
      }))
  }, [messages])

  // Persist conversation to project metadata
  const persistConversation = useCallback((msgs: Message[]) => {
    try {
      const turns: ChatTurn[] = msgs
        .slice(-MAX_PERSISTED_TURNS)
        .map(m => ({
          role: m.kind === 'guide' ? 'assistant' as const : 'user' as const,
          content: m.content,
          at: new Date().toISOString(),
        }))
      if (turns.length === 0) return
      void updateProjectMeta(project.id, {
        metadata: { ...(project.metadata || {}), conversation: turns },
      }).catch(e => console.warn('[InlineGuide] persist failed:', e))
    } catch {}
  }, [project.id, project.metadata, updateProjectMeta])

  // Load session brief on mount
  useEffect(() => {
    let cancelled = false

    async function load() {
      setBriefLoading(true)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token
        const res = await fetch(
          `${import.meta.env.VITE_API_URL || ''}/api/session-brief?projectId=${project.id}`,
          { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
        )
        if (!res.ok) throw new Error(`${res.status}`)
        const data: SessionBrief = await res.json()
        if (cancelled) return

        setBrief(data)

        // Build the opening message: greeting + proactive question
        const opening = data.greeting + (data.proactiveQuestion ? `\n\n${data.proactiveQuestion}` : '')
        setMessages([{ kind: 'guide', content: opening }])
      } catch {
        if (!cancelled) {
          // Fallback opening
          setMessages([{
            kind: 'guide',
            content: 'What are you thinking about for this project?',
          }])
        }
      } finally {
        if (!cancelled) setBriefLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [project.id])

  // Auto-scroll thread
  useEffect(() => {
    if (threadRef.current && expanded) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages, thinking, expanded])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || thinking) return

    const tasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []

    const nextMessages: Message[] = [...messages, { kind: 'you', content: message }]
    setMessages(nextMessages)
    setInput('')
    setThinking(true)
    setExpanded(true)

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/brainstorm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          step: 'project-chat',
          projectId: project.id,
          projectTitle: project.title,
          projectDescription: project.description,
          projectMotivation: project.metadata?.motivation,
          projectGoal: project.metadata?.end_goal,
          tasks: tasks.map(t => ({
            id: t.id,
            text: t.text,
            done: t.done,
            is_ai_suggested: t.is_ai_suggested,
            task_type: t.task_type,
          })),
          message,
          history: getApiHistory(),
        }),
      })

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        setMessages(prev => [...prev, { kind: 'guide', content: "Something went wrong — try again." }])
        return
      }

      if (!res.ok) {
        setMessages(prev => [...prev, { kind: 'guide', content: `Error: ${(data as any)?.error || res.status}` }])
        return
      }

      // Apply task operations
      if (data.taskOps && Array.isArray(data.taskOps) && onUpdateTasks) {
        const currentTasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
        let updatedTasks = [...currentTasks]
        for (const op of data.taskOps as TaskOp[]) {
          if (op.action === 'complete') {
            updatedTasks = updatedTasks.map(t =>
              t.id === op.taskId ? { ...t, done: true, completed_at: new Date().toISOString() } : t
            )
          } else if (op.action === 'uncomplete') {
            updatedTasks = updatedTasks.map(t =>
              t.id === op.taskId ? { ...t, done: false, completed_at: undefined } : t
            )
          } else if (op.action === 'delete') {
            updatedTasks = updatedTasks.filter(t => t.id !== op.taskId)
          } else if (op.action === 'edit' && op.newText) {
            updatedTasks = updatedTasks.map(t =>
              t.id === op.taskId ? { ...t, text: op.newText! } : t
            )
          }
        }
        await onUpdateTasks(updatedTasks)
      }

      setMessages(prev => {
        const next: Message[] = [
          ...prev,
          {
            kind: 'guide',
            content: (data.reply as string) || "Couldn't reach the server.",
            suggestedTasks: (data.suggestedTasks as SuggestedTask[]) || [],
            echoes: (data.echoes as EchoItem[]) || [],
          },
        ]
        persistConversation(next)
        return next
      })
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { kind: 'guide', content: `Network error — ${err instanceof Error ? err.message : 'try again.'}` },
      ])
    } finally {
      setThinking(false)
    }
  }

  const handleAddTask = (task: SuggestedTask) => {
    if (addedTasks.has(task.text)) return
    onAddTask(task)
    setAddedTasks(prev => new Set(prev).add(task.text))
  }

  // The guide section
  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 opacity-50">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--brand-text-primary)]/50">
          Guide
        </span>
        <div className="h-px bg-white/20 flex-grow" />
      </div>

      {/* Loading state */}
      {briefLoading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-3/4 rounded bg-white/5" />
          <div className="h-4 w-1/2 rounded bg-white/4" />
        </div>
      )}

      {/* Thread */}
      {!briefLoading && (
        <div
          ref={threadRef}
          className={`space-y-4 ${expanded ? 'max-h-[50vh] overflow-y-auto scroll-minimal' : ''}`}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i === 0 ? 0.15 : 0 }}
              >
                {msg.kind === 'guide' ? (
                  <div className="space-y-2">
                    <p
                      className="text-[15px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.75 }}
                    >
                      {msg.content}
                    </p>

                    {/* Knowledge echoes */}
                    {msg.echoes && msg.echoes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.echoes.map((echo, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              color: 'var(--brand-text-secondary)',
                              opacity: 0.4,
                              border: '1px solid rgba(255,255,255,0.06)',
                            }}
                            title={echo.snippet}
                          >
                            {echo.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested tasks */}
                    {msg.suggestedTasks && msg.suggestedTasks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {msg.suggestedTasks.map((task, j) => {
                          const added = addedTasks.has(task.text)
                          return (
                            <div
                              key={j}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                              style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                              }}
                            >
                              <p
                                className="text-[13px] leading-snug flex-1"
                                style={{ color: 'var(--brand-text-primary)', opacity: 0.7 }}
                              >
                                {task.text}
                              </p>
                              <button
                                onClick={() => handleAddTask(task)}
                                disabled={added}
                                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg transition-all disabled:opacity-40"
                                style={{
                                  background: added ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.12)',
                                  border: `1px solid ${added ? 'rgba(255,255,255,0.06)' : 'rgba(59,130,246,0.2)'}`,
                                  color: added ? 'var(--brand-text-secondary)' : 'var(--brand-primary)',
                                }}
                              >
                                {added
                                  ? <><Check className="h-3 w-3" /><span className="text-[10px]">Added</span></>
                                  : <><Plus className="h-3 w-3" /><span className="text-[10px]">Add</span></>
                                }
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* User message */
                  <div className="flex justify-end">
                    <p
                      className="text-[15px] leading-relaxed px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]"
                      style={{
                        background: 'rgba(59,130,246,0.1)',
                        border: '1px solid rgba(59,130,246,0.15)',
                        color: 'var(--brand-text-primary)',
                        opacity: 0.9,
                      }}
                    >
                      {msg.content}
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Thinking indicator */}
          {thinking && (
            <div className="flex gap-1 pt-1">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="block w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--brand-text-secondary)', opacity: 0.3 }}
                  animate={{ opacity: [0.15, 0.5, 0.15] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Knowledge nudge pill */}
      {brief?.knowledgeNudge && messages.length <= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <Sparkles className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }} />
          <span className="text-[12px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
            {brief.knowledgeNudge}
          </span>
        </motion.div>
      )}

      {/* Input */}
      {!briefLoading && (
        <div className="mt-4 flex items-center gap-2">
          <input
            ref={inputRef}
            placeholder="Reply..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => setExpanded(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            autoComplete="off"
            className="flex-1 px-4 py-3 rounded-xl border-0 focus:outline-none focus:ring-0 bg-white/[0.04] text-[15px]"
            style={{
              color: 'var(--brand-text-primary)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-15"
            style={{
              background: input.trim() ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: `1px solid ${input.trim() ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)'}`,
              color: 'var(--brand-text-primary)',
            }}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  )
}
