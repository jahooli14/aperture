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
import { Plus, ArrowUp, ArrowLeft, Loader2 } from 'lucide-react'
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

  // ── Form state ────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    title: initialTitle || '',
    description: initialDescription || '',
    end_goal: '',
    project_mode: 'completion' as 'completion' | 'recurring',
    first_step: '',
    type: 'Creative',
  })

  // Sync initial values when dialog opens with pre-filled data
  useEffect(() => {
    if (open && (initialTitle || initialDescription)) {
      setFormData(prev => ({
        ...prev,
        title: initialTitle || prev.title,
        description: initialDescription || prev.description,
      }))
      setMode('commit')
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
    setQuickAddMode(false)
    setQuickTitle('')
    setQuickDesc('')
    setFormData({
      title: initialTitle || '',
      description: initialDescription || '',
      end_goal: '',
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
        end_goal: data.end_goal || '',
        project_mode: data.project_mode === 'recurring' ? 'recurring' : 'completion',
        first_step: data.first_step || '',
        type: ((PROJECT_TYPES as readonly string[]).includes(data.type)
          ? data.type
          : 'Creative'),
      })
      setGenesisDraft(data.genesisDraft || '')
      setMode('commit')
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
      await createProject({
        title: quickTitle.trim(),
        description: quickDesc.trim() || '',
        status: 'active',
        type: 'Creative',
        metadata: {
          tasks: [],
          progress: 0,
          is_shaped: false,
        },
      })
      addToast({
        title: 'Project saved',
        description: `"${quickTitle.trim()}" added — shape it to unlock Power Hour.`,
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
        description: error instanceof Error ? error.message : 'An error occurred',
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
      const tasks = formData.first_step
        ? [{ id: crypto.randomUUID(), text: formData.first_step, done: false, created_at: new Date().toISOString(), order: 0 }]
        : []

      const titleAtCreation = formData.title

      await createProject({
        title: formData.title,
        description: formData.description || '',
        status: 'active',
        type: formData.type,
        metadata: {
          tasks,
          progress: 0,
          end_goal: formData.project_mode === 'completion' ? (formData.end_goal || undefined) : undefined,
          project_mode: formData.project_mode,
          studio_draft: genesisDraft || undefined,
          is_shaped: true,
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
        description: error instanceof Error ? error.message : 'An error occurred',
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
          className="h-10 w-10 rounded-xl flex items-center justify-center border transition-all hover:bg-[var(--glass-surface)]"
          style={{ borderColor: 'rgba(30, 42, 88, 0.2)', color: 'var(--brand-text-secondary)' }}
          title="New Project"
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
                            className="text-[15px] leading-relaxed"
                            style={{ color: 'var(--brand-text-secondary)', opacity: 0.75 }}
                          >
                            {msg.content}
                          </p>
                          {/* Echoes */}
                          {msg.echoes && msg.echoes.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {msg.echoes.map((echo, j) => (
                                <span
                                  key={j}
                                  className="text-[10px] px-2 py-0.5 rounded-full"
                                  style={{
                                    background: 'rgba(255,255,255,0.04)',
                                    color: 'var(--brand-text-secondary)',
                                    opacity: 0.5,
                                    border: '1px solid rgba(255,255,255,0.07)',
                                  }}
                                  title={echo.snippet}
                                >
                                  ◈ {echo.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pl-8 flex justify-end">
                          <p
                            className="text-[15px] leading-relaxed text-right"
                            style={{ color: 'var(--brand-text-primary)', opacity: 0.9 }}
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

                {/* Input row */}
                <div
                  className="pt-3 mt-2"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="tell me more…"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onFocus={handleInputFocus}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      autoComplete="off"
                      className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
                      style={{
                        color: 'var(--brand-text-primary)',
                        fontSize: '15px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSend}
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
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
                  style={{ color: 'var(--brand-text-primary)', fontSize: '22px', fontWeight: 700, lineHeight: '1.3' }}
                />

                {/* Description */}
                <input
                  placeholder="What is this about?"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2"
                  style={{ color: 'var(--brand-text-secondary)', fontSize: '15px', opacity: formData.description ? 0.7 : 0.4 }}
                />

                {/* End goal (completion only) */}
                {formData.project_mode === 'completion' && (
                  <input
                    placeholder="What does done look like?"
                    value={formData.end_goal}
                    onChange={e => setFormData({ ...formData, end_goal: e.target.value })}
                    onFocus={handleInputFocus}
                    autoComplete="off"
                    className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2"
                    style={{ color: 'var(--brand-text-secondary)', fontSize: '13px', opacity: 0.5 }}
                  />
                )}

                {/* First step */}
                <input
                  placeholder="One thing you'd do this week?"
                  value={formData.first_step}
                  onChange={e => setFormData({ ...formData, first_step: e.target.value })}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2 mb-4"
                  style={{ color: 'var(--brand-text-secondary)', fontSize: '13px', opacity: 0.5 }}
                />

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
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all touch-manipulation disabled:opacity-25 ml-1"
                    style={{
                      background: isFormValid ? 'var(--brand-primary, rgb(var(--brand-primary-rgb)))' : 'rgba(255,255,255,0.1)',
                      color: isFormValid ? '#000' : 'var(--brand-text-secondary)',
                    }}
                    title={loading ? 'Creating…' : 'Create project'}
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
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
                  className="flex items-center gap-1 text-[11px] mb-3 self-start transition-all"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
                >
                  <ArrowLeft className="h-3 w-3" /> back to conversation
                </button>

                <input
                  placeholder="Project name…"
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  onFocus={handleInputFocus}
                  autoComplete="off"
                  autoFocus
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none"
                  style={{ color: 'var(--brand-text-primary)', fontSize: '22px', fontWeight: 700, lineHeight: '1.3' }}
                />

                <input
                  placeholder="One sentence about it (optional)"
                  value={quickDesc}
                  onChange={e => setQuickDesc(e.target.value)}
                  onFocus={handleInputFocus}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickAdd() } }}
                  autoComplete="off"
                  className="w-full border-0 focus:outline-none focus:ring-0 bg-transparent appearance-none mt-2 mb-4"
                  style={{ color: 'var(--brand-text-secondary)', fontSize: '15px', opacity: quickDesc ? 0.7 : 0.4 }}
                />

                <p className="text-[10px] mb-3" style={{ color: 'rgba(245,158,11,0.6)' }}>
                  Quick-added projects need shaping before they can get Power Hour plans.
                </p>

                <button
                  onClick={handleQuickAdd}
                  disabled={loading || !quickTitle.trim()}
                  className="w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-25"
                  style={{
                    background: quickTitle.trim() ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: 'var(--brand-text-primary)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save for later'}
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
