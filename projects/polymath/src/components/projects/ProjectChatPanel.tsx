/**
 * Project Chat Panel
 *
 * Contextual AI chat for an active project. Lives inside the project detail
 * page as a slide-up sheet. It knows the project's task list, recent
 * completions, and power hour suggestions — so the conversation is grounded
 * in where the project actually is right now, not a blank slate.
 *
 * Cohesion loop:
 *  - Task completions appear as inline system events in the thread
 *  - Power hour suggestions are surfaced on open so you can discuss them
 *  - AI-suggested tasks can be added directly to the task list
 *  - Adding a task here triggers the same debounced enrichment that
 *    regenerates the power hour plan, closing the loop
 */

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, Plus, Check, Zap, Flag, ListTodo, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { handleInputFocus } from '../../utils/keyboard'
import { supabase } from '../../lib/supabase'
import type { Project } from '../../types'
import type { Task } from './TaskList'
import { useJourneyStore } from '../../stores/useJourneyStore'
import { useProjectStore } from '../../stores/useProjectStore'
import type { ChatTurn } from '../../types'

// Cap persisted chat history to avoid unbounded metadata growth.
const MAX_PERSISTED_TURNS = 40

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

interface SuggestedTask {
  text: string
  task_type: 'ignition' | 'core' | 'shutdown'
  estimated_minutes?: number
  reasoning?: string
}

type ChatMessage =
  | { kind: 'user'; content: string }
  | { kind: 'model'; content: string; suggestedTasks?: SuggestedTask[]; echoes?: EchoItem[] }
  | { kind: 'system'; content: string }

interface PowerHourSuggestion {
  task_title: string
  task_description?: string
}

interface TaskOp {
  action: 'complete' | 'uncomplete' | 'delete' | 'edit'
  taskId: string
  newText?: string
}

interface ProjectChatPanelProps {
  isOpen: boolean
  onClose: () => void
  project: Project
  recentCompletions: string[]
  onAddTask: (task: {
    text: string
    task_type?: 'ignition' | 'core' | 'shutdown'
    estimated_minutes?: number
    reasoning?: string
  }) => void
  onUpdateTasks?: (tasks: Task[]) => Promise<void>
  onRefinePlan?: () => Promise<void>
  /** Auto-send this message when the panel opens (e.g. from post-onboarding) */
  autoMessage?: string | null
}

const TASK_TYPE_LABELS: Record<string, string> = {
  ignition: 'ignition',
  core: 'core',
  shutdown: 'shutdown',
}

function buildOpeningMessage(
  project: Project,
  recentCompletions: string[],
  powerHourSuggestions: PowerHourSuggestion[],
  onboardingProfile?: { themes: string[]; capabilities: string[] } | null
): ChatMessage[] {
  const messages: ChatMessage[] = []

  // Surface recent completions as system events
  for (const text of recentCompletions) {
    messages.push({ kind: 'system', content: `Completed: ${text}` })
  }

  // Surface power hour suggestions as an AI message
  if (powerHourSuggestions.length > 0) {
    const taskLines = powerHourSuggestions
      .map(s => `• ${s.task_title}${s.task_description ? ` — ${s.task_description}` : ''}`)
      .join('\n')

    // Weave in onboarding context if available
    const profileContext = onboardingProfile?.themes?.length
      ? ` Given your interest in ${onboardingProfile.themes.slice(0, 2).join(' and ')}, I'd especially focus on the ones that play to those strengths.`
      : ''

    messages.push({
      kind: 'model',
      content: `Based on where ${project.title} is right now, here's what I'd suggest for your next session:\n\n${taskLines}\n\nWant to add any of these, talk through the approach, or go a different direction?${profileContext}`,
      suggestedTasks: powerHourSuggestions.map(s => ({
        text: s.task_title,
        task_type: 'core' as const,
        reasoning: s.task_description,
      })),
    })
  }

  return messages
}

const QUICK_PROMPTS = [
  { label: 'What direction should I take this?', icon: '→' },
  { label: 'Suggest tasks for my next session', icon: '+' },
  { label: 'What am I avoiding?', icon: '?' },
]

export function ProjectChatPanel({
  isOpen,
  onClose,
  project,
  recentCompletions,
  onAddTask,
  onUpdateTasks,
  onRefinePlan,
  autoMessage,
}: ProjectChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set())
  const [isRefining, setIsRefining] = useState(false)
  const [contextTab, setContextTab] = useState<'goal' | 'steps'>('goal')
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoMessageSentRef = useRef(false)

  // Build conversation history for the API (only user/model messages)
  const apiHistory = messages
    .filter((m): m is Extract<ChatMessage, { kind: 'user' | 'model' }> =>
      m.kind === 'user' || m.kind === 'model'
    )
    .map(m => ({ role: m.kind as 'user' | 'model', content: m.content }))

  // Get onboarding profile for personalization
  const onboardingProfile = useJourneyStore(state => state.onboardingProfile)

  // Project store for persisting conversation back to project metadata.
  const updateProjectMeta = useProjectStore(state => state.updateProject)

  // Persist current chat turns to project.metadata.conversation.
  // Debounced per message write by the updateProject API itself; we keep this
  // best-effort — failures are logged but never surface to the user.
  const persistConversation = (nextMessages: ChatMessage[]) => {
    try {
      const turns: ChatTurn[] = nextMessages
        .filter((m): m is Extract<ChatMessage, { kind: 'user' | 'model' }> =>
          m.kind === 'user' || m.kind === 'model'
        )
        .slice(-MAX_PERSISTED_TURNS)
        .map(m => ({
          role: m.kind === 'model' ? 'assistant' : 'user',
          content: m.content,
          at: new Date().toISOString(),
        }))

      if (turns.length === 0) return

      void updateProjectMeta(project.id, {
        metadata: {
          ...(project.metadata || {}),
          conversation: turns,
        },
      }).catch(e => console.warn('[ProjectChat] persist conversation failed:', e))
    } catch (e) {
      console.warn('[ProjectChat] persist conversation error:', e)
    }
  }

  // Reset and initialise when panel opens
  useEffect(() => {
    if (!isOpen) return

    const powerHourSuggestions: PowerHourSuggestion[] =
      (project.metadata?.suggested_power_hour_tasks as PowerHourSuggestion[] | undefined) || []

    const opening = buildOpeningMessage(project, recentCompletions, powerHourSuggestions, onboardingProfile)

    // Hydrate persisted chat turns from project metadata so the panel has memory
    // across sessions. The opening (system context) is always fresh; persisted
    // user/assistant turns come after it.
    const persisted = (project.metadata?.conversation as ChatTurn[] | undefined) || []
    const persistedMessages: ChatMessage[] = persisted.map(t => ({
      kind: t.role === 'assistant' ? 'model' : 'user',
      content: t.content,
    }))

    setMessages([...opening, ...persistedMessages])
    setAddedTasks(new Set())
    setInput('')
    setContextTab('goal')
    // setShowCouncil(false) — council feature removed

    // Focus input after animation settles
    setTimeout(() => inputRef.current?.focus(), 350)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-send a seeded message when arriving from post-onboarding
  useEffect(() => {
    if (!isOpen || !autoMessage || autoMessageSentRef.current) return
    autoMessageSentRef.current = true

    // Delay slightly so the panel renders first
    const timer = setTimeout(async () => {
      const msg = autoMessage
      setMessages(prev => [...prev, { kind: 'user', content: msg }])
      setThinking(true)

      try {
        const tasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
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
            tasks: tasks.map(t => ({ id: t.id, text: t.text, done: t.done })),
            message: msg,
            history: [],
          }),
        })
        const data = await res.json()
        if (res.ok && data.reply) {
          setMessages(prev => {
            const next: ChatMessage[] = [
              ...prev,
              {
                kind: 'model',
                content: data.reply,
                suggestedTasks: data.suggestedTasks || [],
                echoes: data.echoes || [],
              },
            ]
            persistConversation(next)
            return next
          })
        }
      } catch {
        // Silent — they can still type normally
      } finally {
        setThinking(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [isOpen, autoMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Append new completion events when they arrive while panel is open
  useEffect(() => {
    if (!isOpen || recentCompletions.length === 0) return
    const lastCompletion = recentCompletions[recentCompletions.length - 1]
    setMessages(prev => {
      // Don't duplicate if it's already in there
      const alreadyShown = prev.some(
        m => m.kind === 'system' && m.content === `Completed: ${lastCompletion}`
      )
      if (alreadyShown) return prev
      return [...prev, { kind: 'system', content: `Completed: ${lastCompletion}` }]
    })
  }, [recentCompletions, isOpen])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!threadRef.current) return
    threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages, thinking])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || thinking) return

    const tasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
    const powerHourSuggestions: PowerHourSuggestion[] =
      (project.metadata?.suggested_power_hour_tasks as PowerHourSuggestion[] | undefined) || []

    setMessages(prev => [...prev, { kind: 'user', content: message }])
    setInput('')
    setThinking(true)

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
          powerHourSuggestions,
          message,
          history: apiHistory,
        }),
      })

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        console.error('[ProjectChat] Failed to parse response — server may have timed out')
        setMessages(prev => [
          ...prev,
          { kind: 'model', content: "Something went wrong on my end — try again in a moment." },
        ])
        return
      }

      if (!res.ok) {
        const errorMsg = (data as { error?: string })?.error || `Server error ${res.status}`
        console.error('[ProjectChat] Server error:', errorMsg)
        setMessages(prev => [
          ...prev,
          { kind: 'model', content: `Error: ${errorMsg}` },
        ])
        return
      }

      // Apply task operations returned by AI
      if ((data as Record<string, unknown>).taskOps && Array.isArray((data as Record<string, unknown>).taskOps) && onUpdateTasks) {
        const currentTasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
        let updatedTasks = [...currentTasks]
        const opSummaries: string[] = []

        for (const op of data.taskOps as TaskOp[]) {
          if (op.action === 'complete') {
            updatedTasks = updatedTasks.map(t =>
              t.id === op.taskId ? { ...t, done: true, completed_at: new Date().toISOString() } : t
            )
            const task = currentTasks.find(t => t.id === op.taskId)
            if (task) opSummaries.push(`Done: "${task.text}"`)
          } else if (op.action === 'uncomplete') {
            updatedTasks = updatedTasks.map(t =>
              t.id === op.taskId ? { ...t, done: false, completed_at: undefined } : t
            )
            const task = currentTasks.find(t => t.id === op.taskId)
            if (task) opSummaries.push(`Reopened: "${task.text}"`)
          } else if (op.action === 'delete') {
            const task = currentTasks.find(t => t.id === op.taskId)
            updatedTasks = updatedTasks.filter(t => t.id !== op.taskId)
            if (task) opSummaries.push(`Deleted: "${task.text}"`)
          } else if (op.action === 'edit' && op.newText) {
            const task = currentTasks.find(t => t.id === op.taskId)
            updatedTasks = updatedTasks.map(t =>
              t.id === op.taskId ? { ...t, text: op.newText! } : t
            )
            if (task) opSummaries.push(`Updated: "${task.text}" → "${op.newText}"`)
          }
        }

        await onUpdateTasks(updatedTasks)

        // Inject system messages for each operation
        for (const summary of opSummaries) {
          setMessages(prev => [...prev, { kind: 'system', content: summary }])
        }
      }

      setMessages(prev => {
        const next: ChatMessage[] = [
          ...prev,
          {
            kind: 'model',
            content: (data.reply as string) || "Couldn't reach the server — try again.",
            suggestedTasks: (data.suggestedTasks as SuggestedTask[]) || [],
            echoes: (data.echoes as EchoItem[]) || [],
          },
        ]
        persistConversation(next)
        return next
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Network error'
      console.error('[ProjectChat] Fetch error:', errMsg)
      setMessages(prev => [
        ...prev,
        { kind: 'model', content: `Couldn't reach the server — ${errMsg}` },
      ])
    } finally {
      setThinking(false)
    }
  }

  const handleAddTask = (task: SuggestedTask) => {
    const key = task.text
    if (addedTasks.has(key)) return
    onAddTask(task)
    setAddedTasks(prev => new Set(prev).add(key))
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    setTimeout(() => {
      setInput('')
      const message = prompt
      const tasks: Task[] = (project.metadata?.tasks as Task[] | undefined) || []
      const powerHourSuggestions: PowerHourSuggestion[] =
        (project.metadata?.suggested_power_hour_tasks as PowerHourSuggestion[] | undefined) || []

      setMessages(prev => [...prev, { kind: 'user', content: message }])
      setThinking(true)

      supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token
        fetch(`${import.meta.env.VITE_API_URL || ''}/api/brainstorm`, {
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
            powerHourSuggestions,
            message,
            history: [],
          }),
        })
          .then(async res => {
            let data: Record<string, unknown>
            try {
              data = await res.json()
            } catch {
              console.error('[ProjectChat] Failed to parse response — server may have timed out')
              setMessages(prev => [
                ...prev,
                { kind: 'model', content: "Something went wrong on my end — try again in a moment." },
              ])
              return
            }
            if (!res.ok) {
              const errorMsg = (data as { error?: string })?.error || `Server error ${res.status}`
              console.error('[ProjectChat] Server error:', errorMsg)
              setMessages(prev => [
                ...prev,
                { kind: 'model', content: `Error: ${errorMsg}` },
              ])
              return
            }
            setMessages(prev => {
              const next: ChatMessage[] = [
                ...prev,
                {
                  kind: 'model',
                  content: (data.reply as string) || "Couldn't reach the server — try again.",
                  suggestedTasks: (data.suggestedTasks as SuggestedTask[]) || [],
                  echoes: (data.echoes as EchoItem[]) || [],
                },
              ]
              persistConversation(next)
              return next
            })
          })
          .catch((err: unknown) => {
            const errMsg = err instanceof Error ? err.message : 'Network error'
            console.error('[ProjectChat] Fetch error:', errMsg)
            setMessages(prev => [
              ...prev,
              { kind: 'model', content: `Couldn't reach the server — ${errMsg}` },
            ])
          })
          .finally(() => setThinking(false))
      })
    }, 0)
  }

  const handleRefinePlan = async () => {
    if (!onRefinePlan || isRefining) return
    setIsRefining(true)
    setMessages(prev => [...prev, { kind: 'system', content: 'Refreshing task plan…' }])
    try {
      await onRefinePlan()
      setMessages(prev => [...prev, {
        kind: 'model',
        content: `I've refreshed the task suggestions for ${project.title}. Open the task list to see the new ideas — or ask me anything about the direction.`,
      }])
    } catch {
      setMessages(prev => [...prev, { kind: 'model', content: "Couldn't refresh the plan right now." }])
    } finally {
      setIsRefining(false)
    }
  }

  return (
    <BottomSheet open={isOpen} onOpenChange={open => { if (!open) onClose() }}>
      <BottomSheetContent className="flex flex-col max-h-[85vh]">
        <BottomSheetHeader className="sr-only">
          <BottomSheetTitle>Brainstorm — {project.title}</BottomSheetTitle>
        </BottomSheetHeader>

        {/* Header label */}
        <div className="px-6 pb-2 flex-shrink-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            {project.title}
          </p>
        </div>

        {/* Chat thread */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-6 space-y-5 pb-4 scroll-minimal"
          style={{ minHeight: 0 }}
        >
          {/* Context card — zooms in on open, toggles between goal and next steps */}
          {(() => {
            const incompleteTasks = ((project.metadata?.tasks as Task[] | undefined) || [])
              .filter(t => !t.done)
              .slice(0, 5)

            return (
              <motion.div
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl px-4 pt-3 pb-4 mb-1"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Toggle */}
                <div
                  className="flex gap-1 mb-3 p-0.5 rounded-lg self-start w-fit"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {([
                    { id: 'goal', icon: Flag, label: 'Goal' },
                    { id: 'steps', icon: ListTodo, label: 'Steps' },
                  ] as const).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      onClick={() => setContextTab(id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all"
                      style={{
                        background: contextTab === id ? 'rgba(255,255,255,0.09)' : 'transparent',
                        color: contextTab === id ? 'var(--brand-text-primary)' : 'var(--brand-text-secondary)',
                        opacity: contextTab === id ? 1 : 0.4,
                      }}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="text-[11px] font-medium">{label}</span>
                    </button>
                  ))}
                </div>

                {/* Goal view */}
                {contextTab === 'goal' && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="goal"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                    >
                      {project.metadata?.end_goal ? (
                        <p
                          className="text-[16px] leading-snug font-medium"
                          style={{ color: 'var(--brand-text-primary)', opacity: 0.85 }}
                        >
                          {project.metadata.end_goal}
                        </p>
                      ) : (
                        <p
                          className="text-[14px] leading-snug italic"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                        >
                          No finish line set yet — what does done look like?
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Steps view */}
                {contextTab === 'steps' && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key="steps"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-2"
                    >
                      {incompleteTasks.length > 0 ? (
                        incompleteTasks.map((task, i) => (
                          <div key={task.id} className="flex items-start gap-2.5">
                            <span
                              className="text-[11px] tabular-nums mt-0.5 flex-shrink-0"
                              style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
                            >
                              {i + 1}
                            </span>
                            <p
                              className="text-[14px] leading-snug"
                              style={{ color: 'var(--brand-text-primary)', opacity: 0.8 }}
                            >
                              {task.text}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p
                          className="text-[14px] leading-snug italic"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                        >
                          No tasks yet — ask me to suggest some.
                        </p>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </motion.div>
            )
          })()}

          {messages.length === 0 && (
            <div className="pt-2 space-y-4">
              <p
                className="text-[15px]"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
              >
                What are you thinking about?
              </p>
              <div className="flex flex-col gap-2">
                {QUICK_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickPrompt(p.label)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'var(--brand-text-secondary)',
                    }}
                  >
                    <span style={{ opacity: 0.4, fontSize: '11px' }}>{p.icon}</span>
                    <span className="text-[13px]" style={{ opacity: 0.6 }}>{p.label}</span>
                  </button>
                ))}
                {onRefinePlan && (
                  <button
                    onClick={handleRefinePlan}
                    disabled={isRefining}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all disabled:opacity-40"
                    style={{
                      background: 'rgba(var(--brand-primary-rgb),0.05)',
                      border: '1px solid rgba(var(--brand-primary-rgb),0.15)',
                      color: 'var(--brand-text-secondary)',
                    }}
                  >
                    <span style={{ opacity: 0.4, fontSize: '11px' }}><Zap className="h-3 w-3 inline" /></span>
                    <span className="text-[13px]" style={{ opacity: 0.6 }}>
                      {isRefining ? 'Refreshing…' : 'Refresh my task plan'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                {msg.kind === 'system' ? (
                  /* Task completion event */
                  <div className="flex justify-center">
                    <span
                      className="text-[11px] px-3 py-1 rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        color: 'var(--brand-text-secondary)',
                        opacity: 0.45,
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {msg.content}
                    </span>
                  </div>
                ) : msg.kind === 'model' ? (
                  /* AI message */
                  <div className="pr-10">
                    <p
                      className="text-[15px] leading-relaxed whitespace-pre-wrap"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.8 }}
                    >
                      {msg.content}
                    </p>

                    {/* Knowledge lake echoes */}
                    {msg.echoes && msg.echoes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.echoes.map((echo, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{
                              background: 'rgba(255,255,255,0.04)',
                              color: 'var(--brand-text-secondary)',
                              opacity: 0.45,
                              border: '1px solid rgba(255,255,255,0.07)',
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
                      <div className="mt-3 space-y-2">
                        {msg.suggestedTasks.map((task, j) => {
                          const added = addedTasks.has(task.text)
                          return (
                            <motion.div
                              key={j}
                              className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                              style={{
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-[13px] leading-snug"
                                  style={{ color: 'var(--brand-text-primary)', opacity: 0.85 }}
                                >
                                  {task.text}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {task.task_type && (
                                    <span
                                      className="text-[9px] font-bold uppercase tracking-wider"
                                      style={{ color: 'var(--brand-primary)', opacity: 0.6 }}
                                    >
                                      {TASK_TYPE_LABELS[task.task_type]}
                                    </span>
                                  )}
                                  {task.estimated_minutes && (
                                    <span
                                      className="text-[9px]"
                                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                                    >
                                      ~{task.estimated_minutes}m
                                    </span>
                                  )}
                                </div>
                                {task.reasoning && (
                                  <p
                                    className="text-[11px] mt-1 leading-snug"
                                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                                  >
                                    {task.reasoning}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleAddTask(task)}
                                disabled={added}
                                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50"
                                style={{
                                  background: added ? 'rgba(255,255,255,0.06)' : 'rgba(var(--brand-primary-rgb),0.15)',
                                  border: '1px solid rgba(var(--brand-primary-rgb),0.25)',
                                  color: added ? 'var(--brand-text-secondary)' : 'var(--brand-primary)',
                                }}
                              >
                                {added
                                  ? <><Check className="h-3 w-3" /><span className="text-[10px] font-medium">Added</span></>
                                  : <><Plus className="h-3 w-3" /><span className="text-[10px] font-medium">Add</span></>
                                }
                              </button>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* User message */
                  <div className="pl-10 flex justify-end">
                    <p
                      className="text-[15px] leading-relaxed text-right"
                      style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
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
            <div className="pr-10">
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

        {/* Council panel — on-demand AI perspectives */}

        {/* Input row */}
        <div
          className="px-6 pt-3 pb-6 flex-shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <Zap
              className="h-3.5 w-3.5 flex-shrink-0"
              style={{ color: 'var(--brand-primary)', opacity: 0.4 }}
            />
            <input
              ref={inputRef}
              placeholder="what are you thinking about…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={handleInputFocus}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              autoComplete="off"
              className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
              style={{ color: 'var(--brand-text-primary)', fontSize: '15px' }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || thinking}
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
              style={{
                background: input.trim() ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: 'var(--brand-text-secondary)',
              }}
            >
              <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
