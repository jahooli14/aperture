/**
 * Making a project: say it, then confirm what came back.
 *
 * Two screens, not three. The old flow was a six-topic interview, then an
 * extraction, then a form with six fields (title, description, finish
 * line, first step, type, finish-or-habit) and a separately-generated
 * task list -- and a "quick add" escape hatch beside it because the main
 * path was too long to face. Most of those fields changed nothing about
 * the first session; the type pills labelled nothing (`type` is legacy,
 * labels are the grouping axis); and the finish-line question was asked
 * of people describing an ongoing craft that has no "done".
 *
 * Now:
 *   1. SAY IT — voice by default, listening on open. The assistant asks
 *      at most one question, and only when it genuinely can't plan a
 *      step from what's been said. Two turns is a normal project.
 *   2. HERE IT IS — one call comes back with the title, what it is, the
 *      labels, and the first steps in the order they'd be done. Every
 *      part is editable in place. One button.
 *
 * The whole conversation is saved onto the project, so every later
 * session cites what was actually said here rather than asking again.
 */

import { useState, useEffect, useRef } from 'react'
import { Plus, ArrowUp, ArrowLeft, Loader2, X, Mic, Keyboard, GripVertical } from 'lucide-react'
import { handleInputFocus } from '../../utils/keyboard'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'
import { motion, AnimatePresence } from 'framer-motion'
import { useToast } from '../ui/toast'
import { useProjectStore } from '../../stores/useProjectStore'
import { api } from '../../lib/apiClient'
import { VoiceInput } from '../VoiceInput'
import { useVoicePreference } from '../../stores/useVoicePreference'
import type { ChatTurn } from '../../types'

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
  echoes?: EchoItem[]
}

interface DraftTask {
  id: string
  text: string
  estimated_minutes?: number
  estimate_set?: boolean
  source?: string | null
}

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

interface ShapedProject {
  title: string
  summary: string
  end_goal: string | null
  tags: string[]
  tasks: DraftTask[]
  question: string | null
}

type DialogMode = 'chat' | 'shaping' | 'commit'

export interface CreateProjectDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  trigger?: React.ReactNode
  initialTitle?: string
  initialDescription?: string
  onCreated?: (projectId: string) => void
  /** Pre-loaded conversation for seeding from onboarding suggestions */
  seedConversation?: ConversationMessage[]
}

const OPENER = "What do you want to make?"

export function CreateProjectDialog({
  isOpen,
  onOpenChange,
  hideTrigger = false,
  trigger,
  initialTitle,
  initialDescription,
  onCreated,
  seedConversation,
}: CreateProjectDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const { createProject } = useProjectStore()
  const { addToast } = useToast()

  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  // ── The conversation ──────────────────────────────────────────────
  const hasPrefill = !!(initialTitle || initialDescription)
  const defaultHistory: ConversationMessage[] = seedConversation || [{ role: 'model', content: OPENER }]
  const [mode, setMode] = useState<DialogMode>('chat')
  const [history, setHistory] = useState<ConversationMessage[]>(defaultHistory)
  const [chatInput, setChatInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  // Voice by default, listening automatically -- typing is what you opt
  // into. Remembered across creation, session planning and the debrief so
  // the choice is made once, not re-fought every phase.
  const prefersText = useVoicePreference(s => s.prefersText)
  const setPrefersText = useVoicePreference(s => s.setPrefersText)
  const voiceTurn = !prefersText

  // ── What came back ────────────────────────────────────────────────
  const [shaped, setShaped] = useState<ShapedProject | null>(null)
  const [title, setTitle] = useState('')
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([])
  const [dragId, setDragId] = useState<string | null>(null)

  // Everything the user has said, which is the project brief.
  const saidByUser = () => history.filter(m => m.role === 'user').map(m => m.content.trim()).filter(Boolean)

  const dumpFor = (extra: string[] = []) =>
    [initialTitle, initialDescription, ...saidByUser(), ...extra].filter(Boolean).join('\n')

  // ── Shape it: one call ────────────────────────────────────────────
  const shapeIt = async (extra: string[] = []) => {
    const dump = dumpFor(extra)
    if (!dump.trim()) return
    setMode('shaping')
    try {
      const data = await api.post('utilities?resource=shape-project', {
        dump,
        ...(initialTitle ? { title: initialTitle } : {}),
      }) as ShapedProject
      setShaped(data)
      setTitle(data.title || initialTitle || '')
      setDraftTasks(data.tasks || [])
      setMode('commit')
    } catch (err) {
      console.warn('[CreateProjectDialog] shaping failed:', err)
      addToast({
        title: "Couldn't shape that",
        description: 'Say a bit more and try again.',
        variant: 'destructive',
      })
      setMode('chat')
    }
  }

  // A prefilled open (from a memory, a theme cluster) already has its
  // dump -- shape it straight away rather than opening an empty chat
  // about something the user has already described.
  const shapedPrefillRef = useRef(false)
  useEffect(() => {
    if (!open || !hasPrefill || shapedPrefillRef.current) return
    shapedPrefillRef.current = true
    void shapeIt()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasPrefill])

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [history, thinking])

  useEffect(() => {
    if (open && seedConversation && seedConversation.length > 0) {
      setHistory(seedConversation)
      setMode('chat')
    }
  }, [open, seedConversation])

  const resetAll = () => {
    setMode('chat')
    setHistory(defaultHistory)
    setChatInput('')
    setThinking(false)
    setShaped(null)
    setTitle('')
    setDraftTasks([])
    setSaving(false)
    shapedPrefillRef.current = false
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetAll()
    setOpen(next)
  }

  // ── A turn ────────────────────────────────────────────────────────
  // The assistant asks at most one thing, and only when it can't plan
  // from what's been said. Anything else and it says what it's got and
  // gets out of the way.
  const handleSend = async (overrideText?: string) => {
    const message = (overrideText ?? chatInput).trim()
    if (!message || thinking) return

    const newHistory: ConversationMessage[] = [...history, { role: 'user', content: message }]
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
        }),
      })
      const data = await res.json()
      // Ready means there's enough to plan a first step. Go straight
      // there -- making the user tap "make this a project" after the
      // assistant has just said it has what it needs is a step that only
      // ever means "yes".
      if (data.readyToExtract) {
        setHistory([...newHistory, { role: 'model', content: data.reply, echoes: data.echoes || [] }])
        await shapeIt()
        return
      }
      setHistory([...newHistory, { role: 'model', content: data.reply, echoes: data.echoes || [] }])
    } catch {
      setHistory([...newHistory, { role: 'model', content: "Couldn't reach the server — try again." }])
    } finally {
      setThinking(false)
    }
  }

  // ── The steps, editable before anything is saved ───────────────────
  const updateTask = (id: string, text: string) =>
    setDraftTasks(prev => prev.map(t => (t.id === id ? { ...t, text } : t)))
  const removeTask = (id: string) => setDraftTasks(prev => prev.filter(t => t.id !== id))
  const addTask = () =>
    setDraftTasks(prev => [...prev, { id: crypto.randomUUID(), text: '' }])

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    setDraftTasks(prev => {
      const from = prev.findIndex(t => t.id === fromId)
      const to = prev.findIndex(t => t.id === toId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }

  // ── Save ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    const now = new Date().toISOString()

    try {
      const tasks = draftTasks
        .map(t => ({ ...t, text: t.text.trim() }))
        .filter(t => t.text)
        .map((t, order) => ({
          id: t.id || crypto.randomUUID(),
          text: t.text,
          done: false,
          created_at: now,
          order,
          origin: 'spine' as const,
          ...(t.source ? { source: t.source } : {}),
          ...(t.estimate_set && t.estimated_minutes
            ? { estimated_minutes: t.estimated_minutes, estimate_set: true }
            : {}),
        }))

      const created = await createProject({
        title: title.trim(),
        description: shaped?.summary || initialDescription || '',
        status: 'active',
        metadata: {
          tasks,
          progress: 0,
          is_shaped: true,
          // Kept only when the user actually said what done looks like.
          // Never asked for: an ongoing craft has no finish line, and
          // forcing one means rewriting it forever.
          ...(shaped?.end_goal ? { end_goal: shaped.end_goal, end_goal_source: 'guide' as const } : {}),
          project_mode: shaped?.end_goal ? ('completion' as const) : ('recurring' as const),
          ...(shaped?.tags?.length ? { tags: shaped.tags } : {}),
          // The conversation IS the brief. Every later session cites it
          // rather than asking the same things again.
          ...(history.length > 1
            ? {
                conversation: history.map(m => ({
                  role: (m.role === 'user' ? 'user' : 'assistant') as ChatTurn['role'],
                  content: m.content,
                  at: now,
                })),
              }
            : {}),
        },
      })

      addToast({
        title: tasks.length > 0 ? `Ready — ${tasks.length} step${tasks.length === 1 ? '' : 's'}` : 'Project saved',
        description: tasks.length > 0
          ? `"${title.trim()}" is ready to work on.`
          : `"${title.trim()}" saved. Say more and it'll plan the steps.`,
        variant: 'success',
      })

      if (onCreated && created?.id) onCreated(created.id)
      resetAll()
      setOpen(false)
    } catch (error) {
      addToast({
        title: 'Failed to create project',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
      setSaving(false)
    }
  }

  const canSend = chatInput.trim().length > 0 && !thinking
  const hasSaidSomething = saidByUser().length > 0

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      {!hideTrigger && (trigger || (
        <button
          onClick={() => setOpen(true)}
          className="masthead-action press-spring"
          aria-label="New project"
          title="New project"
        >
          <Plus className="h-5 w-5" />
        </button>
      ))}

      <BottomSheet open={open} onOpenChange={handleOpenChange}>
        <BottomSheetContent>
          <BottomSheetHeader className="sr-only">
            <BottomSheetTitle>New project</BottomSheetTitle>
          </BottomSheetHeader>

          <AnimatePresence mode="wait">
            {/* ── 1. Say it ──────────────────────────────────────── */}
            {mode === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col"
                style={{ minHeight: '260px', maxHeight: '70vh' }}
              >
                <div
                  ref={threadRef}
                  className="flex-1 overflow-y-auto space-y-4 pb-2 scroll-minimal"
                  style={{ maxHeight: '340px' }}
                >
                  {history.map((msg, i) => (
                    <div key={i}>
                      {msg.role === 'model' ? (
                        <div className="pr-8">
                          <p className="text-[15px] leading-relaxed text-[var(--brand-text-secondary)]">
                            {msg.content}
                          </p>
                          {msg.echoes && msg.echoes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {msg.echoes.map((echo, j) => (
                                <span
                                  key={j}
                                  className="text-[11px] px-2 py-1 rounded-full text-[var(--brand-text-muted)]"
                                  style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                  }}
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
                          <p className="text-[15px] leading-relaxed text-right text-[var(--brand-text-primary)]">
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

                {/* Voice on by default, listening the moment it's your turn. */}
                <div className="pt-3 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {voiceTurn && !thinking ? (
                    <div className="space-y-2">
                      <VoiceInput
                        onTranscript={t => { void handleSend(t) }}
                        autoStart
                        autoSubmit
                        maxDuration={45}
                      />
                      <button
                        type="button"
                        onClick={() => setPrefersText(true)}
                        className="flex items-center gap-1 text-[11px] mx-auto transition-all"
                        style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                      >
                        <Keyboard className="h-3 w-3" /> type instead
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPrefersText(false)}
                        aria-label="Switch to voice"
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
                        style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                      <input
                        placeholder="tell me about it…"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onFocus={handleInputFocus}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
                        autoComplete="off"
                        autoFocus
                        className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-base"
                        style={{ color: 'var(--brand-text-primary)' }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleSend()}
                        disabled={!canSend}
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
                        style={{
                          background: canSend ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: 'var(--brand-text-secondary)',
                        }}
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}

                  {/* One quiet way forward, and only once there's something
                      to work with. The assistant usually gets here itself. */}
                  {hasSaidSomething && !thinking && (
                    <button
                      type="button"
                      onClick={() => void shapeIt()}
                      className="mt-3 text-[12px] font-medium mx-auto block transition-all"
                      style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.8 }}
                    >
                      That's enough — plan it →
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Shaping ─────────────────────────────────────────── */}
            {mode === 'shaping' && (
              <motion.div
                key="shaping"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-3 py-14"
              >
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
                <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
                  Working out the first steps…
                </p>
              </motion.div>
            )}

            {/* ── 2. Here it is ───────────────────────────────────── */}
            {mode === 'commit' && (
              <motion.div
                key="commit"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col pt-1"
                style={{ maxHeight: '78vh' }}
              >
                {!hasPrefill && (
                  <button
                    type="button"
                    onClick={() => setMode('chat')}
                    className="flex items-center gap-1 text-[11px] mb-3 self-start transition-all"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                  >
                    <ArrowLeft className="h-3 w-3" /> say more
                  </button>
                )}

                <div className="flex-1 overflow-y-auto scroll-minimal">
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onFocus={handleInputFocus}
                    placeholder="Project name…"
                    autoComplete="off"
                    className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-2xl"
                    style={{ color: 'var(--brand-text-primary)', fontWeight: 700, lineHeight: '1.3' }}
                  />

                  {shaped?.summary && (
                    <p className="mt-1.5 text-[14px] leading-snug" style={{ color: 'var(--brand-text-secondary)', opacity: 0.65 }}>
                      {shaped.summary}
                    </p>
                  )}

                  {/* What done looks like, only when they said it. Shown as
                      a fact, not a field: it's already been captured. */}
                  {shaped?.end_goal && (
                    <p className="mt-2 text-[13px] italic leading-snug" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                      Done when: {shaped.end_goal}
                    </p>
                  )}

                  {shaped?.tags && shaped.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {shaped.tags.map(tag => (
                        <span
                          key={tag}
                          className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(var(--brand-primary-rgb),0.08)',
                            color: 'rgb(var(--brand-primary-rgb))',
                            opacity: 0.75,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* The steps, in order. Drag to reorder -- the order is
                      the plan, and the session takes them off the top. */}
                  <div className="mt-5 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                        {draftTasks.length > 0 ? 'The first steps, in order' : 'Steps'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void shapeIt()}
                        className="text-[11px]"
                        style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.7 }}
                      >
                        redo
                      </button>
                    </div>

                    {shaped?.question && draftTasks.length === 0 ? (
                      <div
                        className="rounded-xl px-3.5 py-3 space-y-1"
                        style={{
                          background: 'rgba(var(--brand-primary-rgb),0.06)',
                          border: '1px solid rgba(var(--brand-primary-rgb),0.2)',
                        }}
                      >
                        <p className="text-[14px] leading-snug">{shaped.question}</p>
                        <button
                          type="button"
                          onClick={() => setMode('chat')}
                          className="text-[12px] font-medium"
                          style={{ color: 'rgb(var(--brand-primary-rgb))' }}
                        >
                          Answer it →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {draftTasks.map((t, i) => (
                          <div
                            key={t.id}
                            draggable
                            onDragStart={() => setDragId(t.id)}
                            onDragOver={e => { e.preventDefault(); if (dragId) reorder(dragId, t.id) }}
                            onDragEnd={() => setDragId(null)}
                            className="flex items-center gap-1.5 group"
                            style={{ opacity: dragId === t.id ? 0.4 : 1 }}
                          >
                            <GripVertical
                              className="h-3 w-3 flex-shrink-0 cursor-grab active:cursor-grabbing opacity-20 group-hover:opacity-50"
                              style={{ color: 'var(--brand-text-secondary)' }}
                            />
                            <span className="text-[11px] tabular-nums flex-shrink-0 w-3" style={{ color: 'rgba(var(--brand-primary-rgb),0.7)' }}>
                              {i + 1}
                            </span>
                            <input
                              value={t.text}
                              onChange={e => updateTask(t.id, e.target.value)}
                              onFocus={handleInputFocus}
                              autoComplete="off"
                              className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-sm py-1"
                              style={{ color: 'var(--brand-text-secondary)' }}
                            />
                            {t.estimate_set && t.estimated_minutes && (
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}>
                                {t.estimated_minutes}m
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeTask(t.id)}
                              aria-label="Remove"
                              className="flex-shrink-0 opacity-25 hover:opacity-70 p-1"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addTask}
                          className="flex items-center gap-1.5 text-[11px] mt-1.5 pl-[26px]"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                        >
                          <Plus className="h-3 w-3" /> add a step
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={saving || !title.trim()}
                  className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 flex-shrink-0"
                  style={{
                    background: 'rgba(var(--brand-primary-rgb),0.14)',
                    border: '1px solid rgba(var(--brand-primary-rgb),0.35)',
                    color: 'rgb(var(--brand-primary-rgb))',
                  }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? 'Saving…' : 'Start this project'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </BottomSheetContent>
      </BottomSheet>
    </>
  )
}
