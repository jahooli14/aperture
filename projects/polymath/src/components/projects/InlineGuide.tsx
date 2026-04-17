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
import { ArrowUp, Plus, Check, X, Target, Trash2, Pencil, RotateCcw } from 'lucide-react'
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

interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit' | 'add'
  taskId?: string
  newText?: string
  task_type?: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

interface GoalUpdate {
  newGoal: string
  reasoning?: string
}

type Message =
  | {
      kind: 'guide'
      content: string
      suggestedTasks?: SuggestedTask[]
      echoes?: EchoItem[]
      pendingOps?: TaskOp[]
      pendingGoal?: GoalUpdate | null
      resolvedOpIds?: string[]
      resolvedGoal?: boolean
    }
  | { kind: 'you'; content: string }

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
  onUpdateGoal?: (newGoal: string) => Promise<void>
}

function opKey(op: TaskOp, i: number): string {
  return `${op.action}:${op.taskId ?? op.newText ?? ''}:${i}`
}

export function InlineGuide({
  project,
  recentCompletions,
  onAddTask,
  onUpdateTasks,
  onUpdateGoal,
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

  const getApiHistory = useCallback(() => {
    return messages
      .map(m => ({
        role: m.kind === 'you' ? 'user' as const : 'model' as const,
        content: m.content,
      }))
  }, [messages])

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
          `${import.meta.env.VITE_API_URL || ''}/api/utilities?resource=session-brief&projectId=${project.id}`,
          { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } }
        )
        if (!res.ok) throw new Error(`${res.status}`)
        const data: SessionBrief = await res.json()
        if (cancelled) return

        setBrief(data)
        const opening = data.greeting + (data.proactiveQuestion ? `\n\n${data.proactiveQuestion}` : '')
        setMessages([{ kind: 'guide', content: opening }])
      } catch {
        if (!cancelled) {
          setMessages([{ kind: 'guide', content: 'What are you thinking about for this project?' }])
        }
      } finally {
        if (!cancelled) setBriefLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [project.id])

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
            id: t.id, text: t.text, done: t.done,
            is_ai_suggested: t.is_ai_suggested, task_type: t.task_type,
          })),
          message,
          history: getApiHistory(),
        }),
      })

      let data: Record<string, unknown>
      try { data = await res.json() } catch {
        setMessages(prev => [...prev, { kind: 'guide', content: "Something went wrong — try again." }])
        return
      }

      if (!res.ok) {
        setMessages(prev => [...prev, { kind: 'guide', content: `Error: ${(data as any)?.error || res.status}` }])
        return
      }

      // Capture task operations and goal update as pending proposals
      const rawOps = (Array.isArray(data.taskOps) ? data.taskOps : []) as TaskOp[]
      const pendingOps = rawOps.filter(op => {
        if (op.action === 'add') return !!op.newText
        return !!op.taskId
      })
      const rawGoal = data.goalUpdate as GoalUpdate | null | undefined
      const pendingGoal: GoalUpdate | null =
        rawGoal && typeof rawGoal.newGoal === 'string' && rawGoal.newGoal.trim()
          ? { newGoal: rawGoal.newGoal.trim(), reasoning: rawGoal.reasoning }
          : null

      setMessages(prev => {
        const next: Message[] = [
          ...prev,
          {
            kind: 'guide',
            content: (data.reply as string) || "Couldn't reach the server.",
            suggestedTasks: (data.suggestedTasks as SuggestedTask[]) || [],
            echoes: (data.echoes as EchoItem[]) || [],
            pendingOps,
            pendingGoal,
            resolvedOpIds: [],
            resolvedGoal: false,
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

  const markOpResolved = (msgIndex: number, key: string) => {
    setMessages(prev => prev.map((m, i) => {
      if (i !== msgIndex || m.kind !== 'guide') return m
      return { ...m, resolvedOpIds: [...(m.resolvedOpIds || []), key] }
    }))
  }

  const applyTaskOp = async (msgIndex: number, op: TaskOp, key: string) => {
    const currentTasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
    if (op.action === 'add') {
      if (!op.newText) return
      onAddTask({
        text: op.newText,
        task_type: op.task_type,
        estimated_minutes: op.estimated_minutes,
        reasoning: op.reasoning,
      })
      markOpResolved(msgIndex, key)
      return
    }
    if (!op.taskId || !onUpdateTasks) return
    let updated = [...currentTasks]
    if (op.action === 'complete') {
      updated = updated.map(t => t.id === op.taskId ? { ...t, done: true, completed_at: new Date().toISOString() } : t)
    } else if (op.action === 'uncomplete') {
      updated = updated.map(t => t.id === op.taskId ? { ...t, done: false, completed_at: undefined } : t)
    } else if (op.action === 'delete') {
      updated = updated.filter(t => t.id !== op.taskId)
    } else if (op.action === 'edit' && op.newText) {
      updated = updated.map(t => t.id === op.taskId ? { ...t, text: op.newText! } : t)
    } else {
      return
    }
    await onUpdateTasks(updated)
    markOpResolved(msgIndex, key)
  }

  const applyGoalUpdate = async (msgIndex: number, goal: GoalUpdate) => {
    if (!onUpdateGoal) return
    await onUpdateGoal(goal.newGoal)
    setMessages(prev => prev.map((m, i) => (i === msgIndex && m.kind === 'guide') ? { ...m, resolvedGoal: true } : m))
  }

  const dismissGoalUpdate = (msgIndex: number) => {
    setMessages(prev => prev.map((m, i) => (i === msgIndex && m.kind === 'guide') ? { ...m, resolvedGoal: true } : m))
  }

  const describeOp = (op: TaskOp): { label: string; preview: string; icon: typeof Plus; destructive: boolean } => {
    const tasks = (project.metadata?.tasks as Task[] | undefined) || []
    const referenced = op.taskId ? tasks.find(t => t.id === op.taskId) : undefined
    const existingText = referenced?.text ?? '(unknown task)'
    switch (op.action) {
      case 'add':
        return { label: 'Add task', preview: op.newText || '', icon: Plus, destructive: false }
      case 'complete':
        return { label: 'Mark done', preview: existingText, icon: Check, destructive: false }
      case 'uncomplete':
        return { label: 'Reopen', preview: existingText, icon: RotateCcw, destructive: false }
      case 'delete':
        return { label: 'Delete task', preview: existingText, icon: Trash2, destructive: true }
      case 'edit':
        return { label: 'Edit task', preview: `"${existingText}" → "${op.newText || ''}"`, icon: Pencil, destructive: false }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}>
          Guide
        </span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.04)' }} />
      </div>

      {/* Loading state */}
      {briefLoading && (
        <div className="space-y-3 animate-pulse px-1">
          <div className="h-4 w-3/4 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="h-4 w-1/2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }} />
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
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i === 0 ? 0.15 : 0 }}
              >
                {msg.kind === 'guide' ? (
                  <div className="space-y-3">
                    <p className="text-[15px] leading-[1.65] whitespace-pre-wrap" style={{ color: 'var(--brand-text-primary)', opacity: 0.6 }}>
                      {msg.content}
                    </p>

                    {/* Knowledge echoes */}
                    {msg.echoes && msg.echoes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.echoes.map((echo, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-2 py-0.5 rounded-lg"
                            style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--brand-text-secondary)', opacity: 0.35, border: '1px solid rgba(255,255,255,0.04)' }}
                            title={echo.snippet}
                          >
                            {echo.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Pending task operations (need user confirmation) */}
                    {msg.pendingOps && msg.pendingOps.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {msg.pendingOps.map((op, j) => {
                          const key = opKey(op, j)
                          const resolved = (msg.resolvedOpIds || []).includes(key)
                          const { label, preview, icon: OpIcon, destructive } = describeOp(op)
                          return (
                            <div
                              key={key}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                              style={{
                                background: destructive ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${destructive ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)'}`,
                              }}
                            >
                              <OpIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: destructive ? 'rgb(239,68,68)' : 'var(--brand-text-secondary)', opacity: 0.6 }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: destructive ? 'rgb(239,68,68)' : 'var(--brand-text-secondary)', opacity: 0.55 }}>
                                  {label}
                                </p>
                                <p className="text-[13px] leading-snug truncate" style={{ color: 'var(--brand-text-primary)', opacity: 0.7 }}>
                                  {preview}
                                </p>
                              </div>
                              {resolved ? (
                                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                                  <Check className="h-3 w-3" /> Applied
                                </span>
                              ) : (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => markOpResolved(i, key)}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.05]"
                                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                                    aria-label="Dismiss"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => applyTaskOp(i, op, key)}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium"
                                    style={{
                                      background: destructive ? 'rgba(239,68,68,0.1)' : 'rgba(var(--brand-primary-rgb),0.1)',
                                      color: destructive ? 'rgb(239,68,68)' : 'rgb(var(--brand-primary-rgb))',
                                      opacity: 0.85,
                                    }}
                                  >
                                    <Check className="h-3 w-3" /> {destructive ? 'Delete' : 'Apply'}
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Pending goal / finish line update */}
                    {msg.pendingGoal && (
                      <div
                        className="px-3 py-3 rounded-xl space-y-2"
                        style={{
                          background: 'rgba(var(--brand-primary-rgb),0.04)',
                          border: '1px solid rgba(var(--brand-primary-rgb),0.1)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }} />
                          <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.65 }}>
                            Update finish line
                          </p>
                        </div>
                        <p className="text-[13px] italic leading-snug font-serif" style={{ color: 'var(--brand-text-primary)', opacity: 0.75 }}>
                          "{msg.pendingGoal.newGoal}"
                        </p>
                        {msg.resolvedGoal ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                            <Check className="h-3 w-3" /> Updated
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => dismissGoalUpdate(i)}
                              className="px-2.5 py-1 text-[11px] font-medium rounded-lg hover:bg-white/[0.05] transition-colors"
                              style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                            >
                              Dismiss
                            </button>
                            <button
                              onClick={() => msg.pendingGoal && applyGoalUpdate(i, msg.pendingGoal)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium"
                              style={{
                                background: 'rgba(var(--brand-primary-rgb),0.1)',
                                color: 'rgb(var(--brand-primary-rgb))',
                                opacity: 0.85,
                              }}
                            >
                              <Check className="h-3 w-3" /> Apply
                            </button>
                          </div>
                        )}
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
                              className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                            >
                              <p className="text-[13px] leading-snug flex-1" style={{ color: 'var(--brand-text-primary)', opacity: 0.6 }}>
                                {task.text}
                              </p>
                              <button
                                onClick={() => handleAddTask(task)}
                                disabled={added}
                                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium"
                                style={{
                                  background: added ? 'rgba(255,255,255,0.03)' : 'rgba(var(--brand-primary-rgb),0.08)',
                                  color: added ? 'var(--brand-text-secondary)' : 'rgb(var(--brand-primary-rgb))',
                                  opacity: added ? 0.4 : 0.7,
                                }}
                              >
                                {added ? <><Check className="h-3 w-3" /> Added</> : <><Plus className="h-3 w-3" /> Add</>}
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
                      className="text-[15px] leading-[1.65] px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]"
                      style={{ background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.1)', color: 'var(--brand-text-primary)', opacity: 0.85 }}
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
            <div className="flex gap-1 pt-1 px-1">
              {[0, 1, 2].map(i => (
                <motion.span
                  key={i}
                  className="block w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--brand-text-secondary)', opacity: 0.2 }}
                  animate={{ opacity: [0.1, 0.4, 0.1] }}
                  transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Knowledge nudge */}
      {brief?.knowledgeNudge && messages.length <= 1 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: 'var(--brand-text-secondary)', opacity: 0.25 }} />
          <span className="text-[12px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}>
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
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            autoComplete="off"
            className="flex-1 px-4 py-3 rounded-xl text-[15px] focus:outline-none focus:ring-0"
            style={{
              color: 'var(--brand-text-primary)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || thinking}
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-10"
            style={{
              background: input.trim() ? 'rgba(var(--brand-primary-rgb),0.1)' : 'transparent',
              border: `1px solid ${input.trim() ? 'rgba(var(--brand-primary-rgb),0.15)' : 'rgba(255,255,255,0.04)'}`,
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
