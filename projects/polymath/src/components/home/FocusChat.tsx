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
 * State lives in useFocusChatStore, not local component state — the "or
 * steer it" field on TodaysAnswerCard opens and sends into this same
 * thread, so this component just renders whatever the store holds. Only
 * ever mounted when the thread is open; the card owns the collapsed entry
 * point.
 */

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSessionContextStore } from '../../stores/useSessionContextStore'
import { useFocusChatStore } from '../../stores/useFocusChatStore'
import { handleInputFocus } from '../../utils/keyboard'
import { toPortfolioSummaries } from './focusChatOps'
import { FocusChatActionCard } from './FocusChatActionCard'
import { FocusChatTaskOpCard } from './FocusChatTaskOpCard'
import { UserBubble, RegenerateRow } from '../chat/ChatPrimitives'
import { ThinkingIndicator } from '../chat/ThinkingIndicator'

export function FocusChat() {
  const allProjects = useProjectStore(s => s.allProjects)
  const feeling = useSessionContextStore(s => s.feeling)
  const expanded = useFocusChatStore(s => s.expanded)
  const messages = useFocusChatStore(s => s.messages)
  const thinking = useFocusChatStore(s => s.thinking)
  const close = useFocusChatStore(s => s.close)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Excludes unshaped drafts (metadata.is_shaped === false) — same bar
  // usePriorityProject/isActiveShaped hold elsewhere, so this can't
  // propose set_priority on a draft TodaysAnswerCard would then ignore
  // (which would silently demote the real priority for nothing).
  // Deliberately broader than isActiveShaped on status though — dormant/
  // on-hold projects are exactly the "you left this unfinished, pick it
  // back up" candidates this feature exists to surface.
  const summaries = allProjects
    .filter(p => p.status !== 'completed' && p.status !== 'graveyard' && p.metadata?.is_shaped !== false)
  const portfolioSummaries = toPortfolioSummaries(summaries)

  // Scrolls the newest message into view within the page, rather than
  // capping the thread at a fixed height with its own internal scrollbar —
  // a nested scroll region inside a scrolling page is a classic mobile
  // trap (the wrong region grabs the touch, especially with the keyboard
  // up). The whole card just grows with the conversation instead.
  useEffect(() => {
    if (expanded) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking, expanded])

  const sendMessage = (message: string) => useFocusChatStore.getState().sendMessage(message, portfolioSummaries, feeling)

  const handleSend = () => {
    const message = input.trim()
    if (!message || thinking) return
    setInput('')
    sendMessage(message)
  }

  const regenerate = () => useFocusChatStore.getState().regenerate(portfolioSummaries, feeling)

  // Loads a previously-sent message back into the input for editing, and
  // drops it (and whatever the guide said in response) from the thread —
  // the only escape from a misunderstood message used to be dismissing its
  // cards and typing the whole thing again from scratch.
  const editMessage = (index: number) => {
    const content = useFocusChatStore.getState().editMessage(index)
    if (content !== null) setInput(content)
  }

  const lastUserIndex = messages.reduce((acc, m, i) => (m.kind === 'you' ? i : acc), -1)

  const markGuideFlag = useFocusChatStore(s => s.markGuideFlag)

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

  // Nothing to render when the thread isn't open — TodaysAnswerCard is the
  // only entry point now (its "today's answer" line, chips, and "or steer
  // it" field all call useFocusChatStore directly).
  if (!expanded) return null

  return (
    <div className="glass-card-strong rounded-2xl p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--brand-primary-rgb))', opacity: 0.75 }}>Focus</span>
        <div className="h-px flex-grow" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <button onClick={close} className="text-[11px] font-medium" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>Close</button>
      </div>

      <div className="space-y-4">
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
