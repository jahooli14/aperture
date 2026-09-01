/**
 * Create Project Dialog
 *
 * Opens as a brainstorm conversation. The user thinks out loud;
 * the AI surfaces connections from the knowledge lake and asks one
 * pointed question. When ready, "Make this a project" extracts a
 * structured definition from the exchange and pre-fills the form.
 *
 * Based on the insight: the court lines don't restrict the game —
 * they make the game possible. The conversation IS the work;
 * the form is just the receipt.
 */

import { useState, useEffect, useRef } from 'react'
import { Plus, ArrowUp, ArrowLeft, Loader2, X, Mic, Keyboard } from 'lucide-react'
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
import { useAutoSuggestion } from '../../contexts/AutoSuggestionContext'
import { SuggestionToast } from '../SuggestionToast'
import { PROJECT_TYPES } from '../../lib/projectTheme'
import { api } from '../../lib/apiClient'
import { VoiceInput } from '../VoiceInput'

interface ConversationMessage {
  role: 'user' | 'model'
  content: string
  echoes?: EchoItem[]
}

interface DraftTask {
  id: string
  text: string
}

interface EchoItem {
  title: string
  type: 'memory' | 'article' | 'project'
  snippet: string
}

type DialogMode = 'chat' | 'extracting' | 'commit'

export interface CreateProjectDialogProps {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
  trigger?: React.ReactNode
  initialTitle?: string
  initialDescription?: string
  onCreated?: (projectId: string) => void
  /** Pre-loaded conversation for seeding brainstorm from onboarding suggestions */
  seedConversation?: ConversationMessage[]
}

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
  const [loading, setLoading] = useState(false)
  const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
  const { createProject } = useProjectStore()
  const { addToast } = useToast()
  const { fetchSuggestions } = useAutoSuggestion()

  const open = isOpen !== undefined ? isOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  // ── Brainstorm state ──────────────────────────────────────────────
  const hasPrefill = !!(initialTitle && initialDescription)
  const defaultHistory: ConversationMessage[] = seedConversation || [{ role: 'model', content: "What's next?" }]
  const [mode, setMode] = useState<DialogMode>(hasPrefill ? 'commit' : 'chat')
  const [history, setHistory] = useState<ConversationMessage[]>(defaultHistory)
  const [chatInput, setChatInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [genesisDraft, setGenesisDraft] = useState('')
  const threadRef = useRef<HTMLDivElement>(null)

  // Each new turn defaults to voice, listening automatically -- typing is
  // the thing you opt into, not the other way round. Reset after every
  // reply so the next turn offers voice again regardless of what the last
  // one was.
  const [voiceTurn, setVoiceTurn] = useState(true)

  // ── Form state ────────────────────────────────────────────────────
  // No end_goal / finish line: an ongoing project (DJing, producing music)
  // has no "done" to plan backwards from, and a project that does have one
  // ("finish this EP") gets there through the tasks themselves, not a
  // second field that immediately goes stale the moment it's written.
  const [formData, setFormData] = useState({
    title: initialTitle || '',
    description: initialDescription || '',
    project_mode: 'completion' as 'completion' | 'recurring',
    first_step: '',
    type: 'Creative',
  })

  // ── Starter tasks: 3 broad first moves, generated from the description,
  //    editable before the project is ever saved. ─────────────────────
  const [draftTasks, setDraftTasks] = useState<DraftTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)

  const generateDraftTasks = async (title: string, description: string, firstStep: string, said: string[]) => {
    const desc = description.trim()
    if (!desc) { setDraftTasks([]); return }
    setTasksLoading(true)
    try {
      const evidence = [firstStep, ...said].map(s => s.trim()).filter(Boolean)
      const data = await api.post('utilities?resource=first-cut-tasks', {
        title: title.trim() || 'Untitled',
        description: desc,
        said: evidence,
      }) as { tasks: { id: string; text: string }[] }
      setDraftTasks((data.tasks || []).map(t => ({ id: t.id, text: t.text })))
    } catch (err) {
      console.warn('[CreateProjectDialog] first-cut generation failed:', err)
      setDraftTasks([])
    } finally {
      setTasksLoading(false)
    }
  }

  const updateDraftTask = (index: number, text: string) => {
    setDraftTasks(prev => prev.map((t, i) => (i === index ? { ...t, text } : t)))
  }
  const removeDraftTask = (index: number) => {
    setDraftTasks(prev => prev.filter((_, i) => i !== index))
  }
  const addDraftTask = () => {
    setDraftTasks(prev => [...prev, { id: crypto.randomUUID(), text: '' }])
  }

  // Sync initial values when dialog opens with pre-filled data
  useEffect(() => {
    if (open && (initialTitle || initialDescription)) {
      setFormData(prev => ({
        ...prev,
        title: initialTitle || prev.title,
        description: initialDescription || prev.description,
      }))
      setMode('commit')
      void generateDraftTasks(initialTitle || '', initialDescription || '', '', [])
    }
  }, [open, initialTitle, initialDescription])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [history, thinking])

  const isFormValid = formData.title.length > 2 && formData.description.length > 10
  const hasExchange = history.length > 1 // more than just the opening message

  // Sync seed conversation when it changes (e.g. opening from onboarding)
  useEffect(() => {
    if (open && seedConversation && seedConversation.length > 0) {
      setHistory(seedConversation)
      setMode('chat')
    }
  }, [open, seedConversation])

  const resetAll = () => {
    setMode(hasPrefill ? 'commit' : 'chat')
    setHistory(defaultHistory)
    setChatInput('')
    setThinking(false)
    setIsReady(false)
    setGenesisDraft('')
    setVoiceTurn(true)
    setDraftTasks([])
    setTasksLoading(false)
    setQuickAddMode(false)
    setQuickTitle('')
    setQuickDesc('')
    setFormData({
      title: initialTitle || '',
      description: initialDescription || '',
      project_mode: 'completion',
      first_step: '',
      type: 'Creative',
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetAll()
    setOpen(next)
  }

  // ── Chat: send a message ──────────────────────────────────────────
  // Takes an optional override so a voice transcript can send itself
  // straight through, rather than round-tripping via the text field state.
  const handleSend = async (overrideText?: string) => {
    const message = (overrideText ?? chatInput).trim()
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
      // The next turn defaults back to voice, whatever this one was.
      setVoiceTurn(true)
    }
  }

  // ── Extract: conversation → structured form ───────────────────────
  const handleExtract = async () => {
    setMode('extracting')
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
      setFormData({
        title: data.title || '',
        description: data.description || '',
        project_mode: data.project_mode === 'recurring' ? 'recurring' : 'completion',
        first_step: data.first_step || '',
        type: ((PROJECT_TYPES as readonly string[]).includes(data.type)
          ? data.type
          : 'Creative'),
      })
      setGenesisDraft(data.genesisDraft || '')
      setMode('commit')
      void generateDraftTasks(
        data.title || '',
        data.description || '',
        data.first_step || '',
        history.filter(m => m.role === 'user').map(m => m.content),
      )
    } catch {
      setMode('chat')
      addToast({ title: 'Extraction failed', description: 'Try again.', variant: 'destructive' })
    }
  }

  // ── Submit ────────────────────────────────────────────────────────
  // ── Quick-add: title + description, marked as unshaped ────────────
  const [quickAddMode, setQuickAddMode] = useState(false)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickDesc, setQuickDesc] = useState('')

  const handleQuickAdd = async () => {
    if (!quickTitle.trim()) return
    setLoading(true)
    try {
      // Quick add is deliberately one field, so anything the user typed in
      // the description is all the evidence there is — shape from it rather
      // than storing an empty project that then hides itself.
      let shaped: { end_goal?: string | null; tags?: string[]; tasks?: any[] } = {}
      if (quickDesc.trim()) {
        try {
          shaped = await api.post('utilities?resource=shape-project', {
            dump: `${quickTitle.trim()}\n${quickDesc.trim()}`,
            title: quickTitle.trim(),
          }) as typeof shaped
        } catch (err) {
          console.warn('[CreateProjectDialog] shaping failed:', err)
        }
      }
      const tasks = Array.isArray(shaped.tasks) ? shaped.tasks : []

      await createProject({
        title: quickTitle.trim(),
        description: quickDesc.trim() || '',
        status: 'active',
        type: 'Creative',
        metadata: {
          tasks,
          progress: 0,
          is_shaped: tasks.length > 0,
          ...(shaped.end_goal ? { end_goal: shaped.end_goal, end_goal_source: 'guide' } : {}),
          ...(shaped.tags?.length ? { tags: shaped.tags } : {}),
        },
      })
      addToast({
        title: tasks.length > 0 ? `Saved with ${tasks.length} steps` : 'Project saved',
        description: tasks.length > 0
          ? `"${quickTitle.trim()}" is ready to work on.`
          : `"${quickTitle.trim()}" added — say what done looks like and it'll plan the steps.`,
        variant: 'success',
      })
      setQuickTitle('')
      setQuickDesc('')
      setQuickAddMode(false)
      resetAll()
      setOpen(false)
    } catch (error) {
      addToast({
        title: 'Failed to save project',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Submit (full shaped project) ─────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const now = new Date().toISOString()
      const tasks = draftTasks
        .map(t => t.text.trim())
        .filter(Boolean)
        .map((text, order) => ({
          id: crypto.randomUUID(), text, done: false, created_at: now, order, origin: 'spine' as const,
        }))

      const titleAtCreation = formData.title

      await createProject({
        title: formData.title,
        description: formData.description || '',
        status: 'active',
        type: formData.type,
        metadata: {
          tasks,
          progress: 0,
          project_mode: formData.project_mode,
          studio_draft: genesisDraft || undefined,
          is_shaped: tasks.length > 0,
        },
      })

      if (onCreated) {
        const newProj = useProjectStore.getState().allProjects.find(p => p.title === titleAtCreation)
        if (newProj) onCreated(newProj.id)
      }

      addToast({
        title: 'Project created',
        description: `"${formData.title}" is live.`,
        variant: 'success',
      })

      resetAll()
      setOpen(false)
    } catch (error) {
      addToast({
        title: 'Failed to create project',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

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
            {/* ── Chat mode ─────────────────────────────────────────── */}
            {(mode === 'chat' || mode === 'extracting') && !quickAddMode && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col"
                style={{ minHeight: '280px', maxHeight: '70vh' }}
              >
                {/* Conversation thread */}
                <div
                  ref={threadRef}
                  className="flex-1 overflow-y-auto space-y-4 pb-2 scroll-minimal"
                  style={{ maxHeight: '340px' }}
                >
                  {history.map((msg, i) => (
                    <div key={i}>
                      {msg.role === 'model' ? (
                        <div className="pr-8">
                          <p
                            className="text-[15px] leading-relaxed text-[var(--brand-text-secondary)]"
                          >
                            {msg.content}
                          </p>
                          {/* Echoes */}
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
                          <p
                            className="text-[15px] leading-relaxed text-right text-[var(--brand-text-primary)]"
                          >
                            {msg.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Thinking indicator */}
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

                {/* Input row — voice on by default, listening automatically
                    the moment it's your turn; typing is a deliberate switch
                    away from that, not the default. */}
                <div
                  className="pt-3 mt-2"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
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
                        onClick={() => setVoiceTurn(false)}
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
                        onClick={() => setVoiceTurn(true)}
                        aria-label="Switch to voice"
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
                        style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
                      >
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                      <input
                        placeholder="tell me more…"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onFocus={handleInputFocus}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                        autoComplete="off"
                        autoFocus
                        className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-base"
                        style={{
                          color: 'var(--brand-text-primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleSend()}
                        disabled={!chatInput.trim() || thinking}
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
                        style={{
                          background: chatInput.trim() ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: 'var(--brand-text-secondary)',
                        }}
                      >
                        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  )}

                  {/* Actions row */}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      type="button"
                      onClick={() => setQuickAddMode(true)}
                      className="text-[11px] transition-all"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.3 }}
                    >
                      Just quick-add →
                    </button>

                    <motion.button
                      type="button"
                      onClick={handleExtract}
                      disabled={!hasExchange || mode === 'extracting'}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-all disabled:opacity-25"
                      animate={isReady ? { opacity: [0.7, 1, 0.7] } : {}}
                      transition={isReady ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
                      style={{
                        background: isReady
                          ? 'rgba(255,255,255,0.14)'
                          : hasExchange ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: 'var(--brand-text-primary)',
                        border: isReady
                          ? '1px solid rgba(255,255,255,0.22)'
                          : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {mode === 'extracting'
                        ? <><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</>
                        : 'Make this a project →'
                      }
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Commit mode ───────────────────────────────────────── */}
            {mode === 'commit' && !quickAddMode && (
              <motion.form
                key="commit"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                onSubmit={handleSubmit}
                className="flex flex-col pt-1"
              >
                {/* Back link (only when there was a brainstorm) */}
                {!hasPrefill && (
                  <button
                    type="button"
                    onClick={() => setMode('chat')}
                    className="flex items-center gap-1 text-[11px] mb-3 self-start transition-all"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                  >
                    <ArrowLeft className="h-3 w-3" /> back to conversation
                  </button>
                )}

                {/* Title */}
                <input
                  placeholder="Project name…"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  autoFocus
                  required
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-2xl"
                  style={{ color: 'var(--brand-text-primary)', fontWeight: 700, lineHeight: '1.3' }}
                />

                {/* Description */}
                <input
                  placeholder="What is this about?"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2 text-base"
                  style={{ color: 'var(--brand-text-secondary)', opacity: formData.description ? 0.7 : 0.4 }}
                />

                {/* Anything specific to start with -- folded into the tasks
                    below rather than stored as its own field. */}
                <input
                  placeholder="One thing you'd do this week? (optional)"
                  value={formData.first_step}
                  onChange={e => setFormData({ ...formData, first_step: e.target.value })}
                  onFocus={handleInputFocus}
                  onBlur={() => {
                    if (formData.first_step.trim()) {
                      void generateDraftTasks(
                        formData.title, formData.description, formData.first_step,
                        history.filter(m => m.role === 'user').map(m => m.content),
                      )
                    }
                  }}
                  autoComplete="off"
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2 mb-3 text-sm"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                />

                {/* Starter tasks -- 3 broad first moves, generated from the
                    description. No finish line: these are what get you
                    going, not steps toward a "done" nobody's named yet. */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
                      First things to do
                    </p>
                    {!tasksLoading && formData.description.trim().length > 0 && (
                      <button
                        type="button"
                        onClick={() => void generateDraftTasks(
                          formData.title, formData.description, formData.first_step,
                          history.filter(m => m.role === 'user').map(m => m.content),
                        )}
                        className="text-[11px]"
                        style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
                      >
                        redo
                      </button>
                    )}
                  </div>
                  {tasksLoading ? (
                    <p className="text-xs" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                      Working out a first move…
                    </p>
                  ) : draftTasks.length === 0 ? (
                    <button
                      type="button"
                      onClick={addDraftTask}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                    >
                      <Plus className="h-3 w-3" /> add one by hand
                    </button>
                  ) : (
                    <div className="space-y-1">
                      {draftTasks.map((t, i) => (
                        <div key={t.id} className="flex items-center gap-1.5">
                          <span className="text-[11px] tabular-nums flex-shrink-0" style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}>
                            {i + 1}
                          </span>
                          <input
                            value={t.text}
                            onChange={e => updateDraftTask(i, e.target.value)}
                            onFocus={handleInputFocus}
                            autoComplete="off"
                            className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-sm"
                            style={{ color: 'var(--brand-text-secondary)' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeDraftTask(i)}
                            aria-label="Remove"
                            className="flex-shrink-0 opacity-30 hover:opacity-70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      {draftTasks.length < 3 && (
                        <button
                          type="button"
                          onClick={addDraftTask}
                          className="flex items-center gap-1.5 text-[11px] mt-1"
                          style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
                        >
                          <Plus className="h-3 w-3" /> add one
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-1 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Type pills */}
                  <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0">
                    {PROJECT_TYPES.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: cat })}
                        className="flex-shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all"
                        style={{
                          background: formData.type === cat ? 'rgba(255,255,255,0.1)' : 'transparent',
                          color: 'var(--brand-text-secondary)',
                          opacity: formData.type === cat ? 1 : 0.35,
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Mode toggle */}
                  <div
                    className="flex items-center flex-shrink-0 rounded-full overflow-hidden ml-1"
                    style={{ background: 'rgba(255,255,255,0.05)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' }}
                  >
                    {([{ value: 'completion', label: 'Finish' }, { value: 'recurring', label: 'Habit' }] as const).map(m => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, project_mode: m.value })}
                        className="px-2.5 py-1 text-[11px] font-medium transition-all"
                        style={{
                          background: formData.project_mode === m.value ? 'rgba(255,255,255,0.12)' : 'transparent',
                          color: 'var(--brand-text-secondary)',
                          opacity: formData.project_mode === m.value ? 1 : 0.4,
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all touch-manipulation disabled:opacity-30 ml-1"
                    style={{
                      background: isFormValid ? 'var(--brand-primary, rgb(var(--brand-primary-rgb)))' : 'rgba(255,255,255,0.1)',
                      color: isFormValid ? '#000' : 'var(--brand-text-secondary)',
                      boxShadow: isFormValid ? '0 0 16px rgba(var(--brand-primary-rgb),0.4)' : 'none',
                    }}
                    title={loading ? 'Creating…' : 'Create project'}
                  >
                    {loading
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                    }
                  </button>
                </div>
              </motion.form>
            )}
            {/* ── Quick-add mode ──────────────────────────────────── */}
            {quickAddMode && (
              <motion.div
                key="quick-add"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col pt-1"
              >
                <button
                  type="button"
                  onClick={() => setQuickAddMode(false)}
                  className="flex items-center gap-1.5 text-[12px] mb-3 self-start transition-all min-h-[36px] -ml-1 px-2 rounded-md hover:bg-white/5 text-[var(--brand-text-secondary)]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> back to conversation
                </button>

                <input
                  placeholder="Project name…"
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  autoFocus
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none text-2xl"
                  style={{ color: 'var(--brand-text-primary)', fontWeight: 700, lineHeight: '1.3' }}
                />

                <input
                  placeholder="One sentence about it (optional)"
                  value={quickDesc}
                  onChange={e => setQuickDesc(e.target.value)}
                  onFocus={handleInputFocus}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickAdd() } }}
                  autoComplete="off"
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2 mb-4 text-base"
                  style={{ color: 'var(--brand-text-secondary)', opacity: quickDesc ? 0.7 : 0.4 }}
                />

                <p className="text-[12px] mb-3 leading-relaxed" style={{ color: 'rgba(251,191,36,0.85)' }}>
                  Quick-added projects need shaping before they can get Power Hour plans.
                </p>

                <button
                  onClick={handleQuickAdd}
                  disabled={loading || !quickTitle.trim()}
                  className="w-full h-12 rounded-xl font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                  style={{
                    background: quickTitle.trim() ? 'rgba(var(--brand-primary-rgb),0.15)' : 'rgba(255,255,255,0.05)',
                    color: quickTitle.trim() ? 'var(--brand-primary)' : 'var(--brand-text-muted)',
                    border: `1px solid ${quickTitle.trim() ? 'rgba(var(--brand-primary-rgb),0.4)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save for later'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </BottomSheetContent>
      </BottomSheet>

      {lastCreatedId && (
        <SuggestionToast
          itemId={lastCreatedId}
          itemType="project"
          itemTitle={formData.title}
        />
      )}
    </>
  )
}
