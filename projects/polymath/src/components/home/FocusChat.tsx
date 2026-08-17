/**
 * Focus Chat
 *
 * Portfolio-level triage — "what should I work on, across everything I've
 * got going" — as distinct from the per-project Guide (InlineGuide.tsx),
 * which only helps once you've already opened a specific project. This
 * never touches task-level detail inside a project; its only job is
 * picking which project, and helping you start it.
 *
 * Collapsed to a pill by default. The opening line is computed locally
 * from data already in the project store — no network call just to open
 * it. The AI only runs once the user actually sends a message.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowUp, Sparkles, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSessionContextStore } from '../../stores/useSessionContextStore'
import { handleInputFocus } from '../../utils/keyboard'
import { type PortfolioAction, toPortfolioSummaries, buildOpeningLine, parsePortfolioAction } from './focusChatOps'
import { FocusChatActionCard } from './FocusChatActionCard'

type Message =
  | { kind: 'guide'; content: string; action?: PortfolioAction | null; resolved?: boolean; dismissed?: boolean }
  | { kind: 'you'; content: string }

export function FocusChat() {
  const allProjects = useProjectStore(s => s.allProjects)
  const feeling = useSessionContextStore(s => s.feeling)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  const summaries = useMemo(() => {
    // Excludes unshaped drafts (metadata.is_shaped === false) — same bar
    // usePriorityProject/isActiveShaped hold elsewhere, so this can't
    // propose set_priority on a draft KeepGoingCard would then ignore
    // (which would silently demote the real priority for nothing).
    // Deliberately broader than isActiveShaped on status though — dormant/
    // on-hold projects are exactly the "you left this unfinished, pick it
    // back up" candidates this feature exists to surface.
    const live = allProjects.filter(p =>
      p.status !== 'completed' && p.status !== 'graveyard' && p.metadata?.is_shaped !== false
    )
    return toPortfolioSummaries(live)
  }, [allProjects])

  const openingLine = useMemo(() => buildOpeningLine(summaries), [summaries])

  // Seed the thread on first expand, not on mount — the pill can render
  // before the project store finishes its initial fetch, and a mount-time
  // effect would freeze a "0 things going" opening line in place forever
  // (it only seeds once). Expanding happens after the user has already
  // seen the live pill text, so summaries/openingLine are correct by then.
  const openChat = () => {
    if (messages.length === 0) setMessages([{ kind: 'guide', content: openingLine }])
    setExpanded(true)
  }

  useEffect(() => {
    if (threadRef.current && expanded) threadRef.current.scrollTop = threadRef.current.scrollHeight
  }, [messages, thinking, expanded])

  const getApiHistory = () =>
    messages.map(m => ({ role: m.kind === 'you' ? 'user' as const : 'model' as const, content: m.content }))

  const handleSend = async () => {
    const message = input.trim()
    if (!message || thinking) return

    const nextMessages: Message[] = [...messages, { kind: 'you', content: message }]
    setMessages(nextMessages)
    setInput('')
    setThinking(true)

    // Snapshot what's actually being sent, so the response can only
    // propose an action against a project the model was told about —
    // not something hallucinated or gone stale by the time it replies.
    const sentSummaries = summaries
    const knownProjectIds = new Set(sentSummaries.map(p => p.id))

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/brainstorm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          step: 'portfolio-chat',
          message,
          history: getApiHistory(),
          feeling,
          projects: sentSummaries,
        }),
      })

      let data: Record<string, unknown>
      try { data = await res.json() } catch {
        setMessages(prev => [...prev, { kind: 'guide', content: 'Lost my train of thought there — try that again?' }])
        return
      }
      if (!res.ok) {
        setMessages(prev => [...prev, { kind: 'guide', content: `Error: ${(data as any)?.error || res.status}` }])
        return
      }

      const rawActions = Array.isArray(data.actions) ? data.actions : []
      const action = parsePortfolioAction(rawActions[0], knownProjectIds)

      setMessages(prev => [...prev, {
        kind: 'guide',
        content: (data.reply as string) || 'Lost my train of thought there — try that again?',
        action,
        resolved: false,
        dismissed: false,
      }])
    } catch (err) {
      setMessages(prev => [...prev, { kind: 'guide', content: `Network error — ${err instanceof Error ? err.message : 'try again.'}` }])
    } finally {
      setThinking(false)
    }
  }

  // Only gate the collapsed pill on live count — once the user has opened
  // the panel, a confirmed action (e.g. burying a project) can legitimately
  // drop the count below 2 mid-conversation, and yanking the whole panel
  // out from under them would lose the transcript and the "Done" state of
  // the action they just confirmed.
  if (!expanded && summaries.length < 2) return null

  if (!expanded) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        onClick={openChat}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.99] text-left mb-6"
        style={{ background: 'rgba(var(--brand-primary-rgb),0.05)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}
      >
        <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--brand-primary-rgb),0.12)' }}>
          <Sparkles className="h-4 w-4" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
        </div>
        <p className="flex-1 min-w-0 text-[13px] leading-snug truncate" style={{ color: 'var(--brand-text-secondary)' }}>{openingLine}</p>
        <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-40" style={{ color: 'var(--brand-text-secondary)' }} />
      </motion.button>
    )
  }

  return (
    <div className="glass-card-strong rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.75 }}>Focus</span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <button onClick={() => setExpanded(false)} className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Close</button>
      </div>

      <div ref={threadRef} className="space-y-4 max-h-[50vh] overflow-y-auto scroll-minimal">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {msg.kind === 'guide' ? (
                <div className="space-y-3">
                  <p className="text-[15px] leading-[1.65] whitespace-pre-wrap text-[var(--brand-text-secondary)]">{msg.content}</p>
                  {msg.action && (
                    <FocusChatActionCard
                      action={msg.action}
                      resolved={msg.resolved}
                      dismissed={msg.dismissed}
                      onResolve={() => setMessages(prev => prev.map((m, idx) => idx === i && m.kind === 'guide' ? { ...m, resolved: true } : m))}
                      onDismiss={() => setMessages(prev => prev.map((m, idx) => idx === i && m.kind === 'guide' ? { ...m, dismissed: true } : m))}
                    />
                  )}
                </div>
              ) : (
                <div className="flex justify-end">
                  <p className="text-[15px] leading-[1.65] px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]" style={{ background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.1)', color: 'var(--brand-text-primary)', opacity: 0.85 }}>
                    {msg.content}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <div className="flex gap-1 pt-1 px-1">
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--brand-text-secondary)', opacity: 0.2 }} animate={{ opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <input
          placeholder="How are you feeling, how much time do you have?"
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={handleInputFocus}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          autoComplete="off"
          className="flex-1 px-4 py-3 rounded-xl text-[15px] focus:outline-none focus:ring-0"
          style={{ color: 'var(--brand-text-primary)', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
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
    </div>
  )
}
