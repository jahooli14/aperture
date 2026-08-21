/**
 * Focus Chat
 *
 * Portfolio-level triage — "what should I work on, across everything I've
 * got going" — as distinct from the per-project Guide (InlineGuide.tsx),
 * which only helps once you've already opened a specific project. Its main
 * job is picking which project, and helping you start it — not curating a
 * project's full task list. The one exception: it can fix a single stale
 * next step when the user corrects it in conversation (see taskOp below),
 * so a recommendation isn't working off out-of-date data after time away.
 *
 * Collapsed to a pill by default. The opening line is computed locally
 * from data already in the project store — no network call just to open
 * it. The AI only runs once the user actually sends a message.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { ArrowUp, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSessionContextStore } from '../../stores/useSessionContextStore'
import { handleInputFocus } from '../../utils/keyboard'
import {
  type Message,
  toPortfolioSummaries,
  buildOpeningLine,
  parsePortfolioAction,
  parsePortfolioTaskOp,
} from './focusChatOps'
import { FocusChatActionCard } from './FocusChatActionCard'
import { FocusChatTaskOpCard } from './FocusChatTaskOpCard'
import { FocusChatPill } from './FocusChatPill'
import { UserBubble, RegenerateRow } from '../chat/ChatPrimitives'
import { ThinkingIndicator } from '../chat/ThinkingIndicator'

export function FocusChat() {
  const allProjects = useProjectStore(s => s.allProjects)
  const feeling = useSessionContextStore(s => s.feeling)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Project ids actually applied (not just proposed — dismissed should
  // still resurface) this session — sent to the backend so a long "Keep
  // going" sweep doesn't re-recommend something already settled, correctly
  // regardless of the capped history below.
  const discussedProjectIdsRef = useRef<Set<string>>(new Set())

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

  // Scrolls the newest message into view within the page, rather than
  // capping the thread at a fixed height with its own internal scrollbar —
  // a nested scroll region inside a scrolling page is a classic mobile
  // trap (the wrong region grabs the touch, especially with the keyboard
  // up). The whole card just grows with the conversation instead.
  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking, expanded])

  // Capped so a long "Keep going" sweep doesn't make every round-trip
  // slower/pricier by resending the whole transcript — safe because
  // discussedProjectIdsRef (not history) is what keeps a long sweep from
  // re-recommending something already settled.
  const MAX_HISTORY_TURNS = 16
  const getApiHistory = (fromMessages: Message[]) =>
    fromMessages
      .slice(-MAX_HISTORY_TURNS)
      .map(m => ({ role: m.kind === 'you' ? 'user' as const : 'model' as const, content: m.content }))

  // Runs one turn against the API and appends the guide's reply. Takes the
  // conversation to send explicitly (rather than reading `messages`) so
  // regenerate can re-run the same user turn against history that no
  // longer includes the reply being replaced.
  const runTurn = async (message: string, historyBase: Message[]) => {
    setThinking(true)

    // Snapshot what's sent, so the response can only propose an action
    // against a project the model was actually told about.
    const sentSummaries = summaries
    const knownProjectIds = new Set(sentSummaries.map(p => p.id))
    const knownProjectsById = new Map(sentSummaries.map(p => [p.id, p]))

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/brainstorm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          step: 'portfolio-chat',
          message,
          history: getApiHistory(historyBase),
          feeling,
          projects: sentSummaries,
          alreadyDiscussed: Array.from(discussedProjectIdsRef.current),
        }),
      })

      let data: Record<string, unknown>
      try { data = await res.json() } catch {
        setMessages(prev => [...prev, { kind: 'guide', content: 'Lost my train of thought there — try that again?' }])
        return
      }
      if (!res.ok) {
        console.error('[FocusChat] request failed:', res.status, (data as any)?.error)
        setMessages(prev => [...prev, { kind: 'guide', content: "Couldn't reach you there — try again?" }])
        return
      }

      const rawActions = Array.isArray(data.actions) ? data.actions : []
      const action = parsePortfolioAction(rawActions[0], knownProjectIds)
      const taskOp = parsePortfolioTaskOp(data.taskOp, knownProjectsById)
      // Marked "discussed" only once the user actually applies the
      // proposal (see the onResolve handlers below) — not here on mere
      // receipt, so a dismissed suggestion can still resurface later.

      setMessages(prev => [...prev, {
        kind: 'guide',
        content: (data.reply as string) || 'Lost my train of thought there — try that again?',
        action,
        actionResolved: false,
        actionDismissed: false,
        taskOp,
        taskOpResolved: false,
        taskOpDismissed: false,
      }])
    } catch (err) {
      console.error('[FocusChat] network error:', err)
      setMessages(prev => [...prev, { kind: 'guide', content: "Couldn't reach you there — try again?" }])
    } finally {
      setThinking(false)
    }
  }

  // Takes an explicit message so both the typed-input send and the
  // one-tap "Keep going" chip (below) share the same request/parse path —
  // the chip exists so clearing a backlog of several stale projects is a
  // string of taps, not re-typing "what else" after every single one.
  const sendMessage = async (message: string) => {
    if (!message || thinking) return
    const nextMessages: Message[] = [...messages, { kind: 'you', content: message }]
    setMessages(nextMessages)
    await runTurn(message, nextMessages)
  }

  const handleSend = () => {
    const message = input.trim()
    if (!message || thinking) return
    setInput('')
    sendMessage(message)
  }

  // Redo the last exchange — drops the guide's last reply and re-asks with
  // the same user message, so a reply that missed the mark doesn't force
  // dismissing every card and retyping the whole thing.
  const regenerate = () => {
    if (thinking || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.kind !== 'guide') return
    const priorUserMsg = [...messages].reverse().find(m => m.kind === 'you')
    if (!priorUserMsg) return
    const historyBase = messages.slice(0, -1)
    setMessages(historyBase)
    runTurn(priorUserMsg.content, historyBase)
  }

  // Loads a previously-sent message back into the input for editing, and
  // drops it (and whatever the guide said in response) from the thread —
  // the only escape from a misunderstood message used to be dismissing its
  // cards and typing the whole thing again from scratch.
  const editMessage = (index: number) => {
    const msg = messages[index]
    if (msg.kind !== 'you' || thinking) return
    setInput(msg.content)
    setMessages(messages.slice(0, index))
  }

  const lastUserIndex = messages.reduce((acc, m, i) => (m.kind === 'you' ? i : acc), -1)

  // Flips one flag on a guide message. discussedProjectId (only passed by
  // the action card) is a real decision made about the project — a taskOp
  // resolving is just a data fix, so it must not suppress recommending
  // that project again.
  const markGuideFlag = (index: number, key: 'taskOpResolved' | 'taskOpDismissed' | 'actionResolved' | 'actionDismissed', discussedProjectId?: string) => {
    if (discussedProjectId) discussedProjectIdsRef.current.add(discussedProjectId)
    setMessages(prev => prev.map((m, idx) => (idx === index && m.kind === 'guide') ? { ...m, [key]: true } : m))
  }

  // Blocks start_session on an unresolved same-project taskOp from ANY
  // turn, not just this message — the fix and the "start it" request can
  // land in separate turns.
  const hasPendingTaskOpFor = (projectId: string) =>
    messages.some(m => m.kind === 'guide' && m.taskOp?.projectId === projectId && !m.taskOpResolved && !m.taskOpDismissed)

  // Once the last turn's cards are all handled, offer a one-tap way to
  // keep sweeping the backlog instead of making the user re-type "what
  // else" after every single project — the point of this whole feature is
  // clearing several stale projects quickly, not one slow exchange at a time.
  const lastMessage = messages[messages.length - 1]
  const lastTurnSettled = !!lastMessage && lastMessage.kind === 'guide' &&
    (!lastMessage.action || lastMessage.actionResolved || lastMessage.actionDismissed) &&
    (!lastMessage.taskOp || lastMessage.taskOpResolved || lastMessage.taskOpDismissed)
  const canKeepGoing = !thinking && messages.length > 1 && lastTurnSettled
  // Regenerating after a real mutation already landed (action/taskOp
  // resolved, not just dismissed) would only replace the text underneath
  // an applied change, not undo it — confusing, so it's withheld exactly
  // then. A merely-dismissed proposal is fair game to redo.
  const canRegenerate = !thinking && lastMessage?.kind === 'guide' &&
    !(lastMessage.action && lastMessage.actionResolved) &&
    !(lastMessage.taskOp && lastMessage.taskOpResolved)

  // Only gate the collapsed pill on live count — once the user has opened
  // the panel, a confirmed action (e.g. burying a project) can legitimately
  // drop the count below 2 mid-conversation, and yanking the whole panel
  // out from under them would lose the transcript and the "Done" state of
  // the action they just confirmed.
  if (!expanded && summaries.length < 2) return null

  if (!expanded) {
    return <FocusChatPill openingLine={openingLine} onOpen={openChat} />
  }

  return (
    <div className="glass-card-strong rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.75 }}>Focus</span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <button onClick={() => setExpanded(false)} className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Close</button>
      </div>

      <div ref={threadRef} className="space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              {msg.kind === 'guide' ? (
                <div className="space-y-3">
                  <p className="text-[15px] leading-[1.65] whitespace-pre-wrap text-[var(--brand-text-secondary)]">{msg.content}</p>
                  {msg.taskOp && (
                    <FocusChatTaskOpCard
                      taskOp={msg.taskOp}
                      resolved={msg.taskOpResolved}
                      dismissed={msg.taskOpDismissed}
                      onResolve={() => markGuideFlag(i, 'taskOpResolved')}
                      onDismiss={() => markGuideFlag(i, 'taskOpDismissed')}
                    />
                  )}
                  {msg.action && (
                    <FocusChatActionCard
                      action={msg.action}
                      resolved={msg.actionResolved}
                      dismissed={msg.actionDismissed}
                      blockedByPendingTaskOp={hasPendingTaskOpFor(msg.action.projectId)}
                      onResolve={() => markGuideFlag(i, 'actionResolved', msg.action?.projectId)}
                      onDismiss={() => markGuideFlag(i, 'actionDismissed')}
                    />
                  )}
                  {i === messages.length - 1 && canRegenerate && (
                    <RegenerateRow onRegenerate={regenerate} />
                  )}
                </div>
              ) : (
                <UserBubble content={msg.content} onEdit={i === lastUserIndex ? () => editMessage(i) : undefined} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>

      {canKeepGoing && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => sendMessage("What else needs attention?")}
          className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.6, border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          Keep going <ChevronRight className="h-3.5 w-3.5" />
        </motion.button>
      )}

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
