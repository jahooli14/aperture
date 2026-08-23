/**
 * Focus Chat — the message thread only.
 *
 * Portfolio-level triage — "what should I work on, across everything I've
 * got going" — as distinct from the per-project Guide (InlineGuide.tsx),
 * which only helps once you've already opened a specific project. Its main
 * job is picking which project, and helping you start it — not curating a
 * project's full task list. The one exception: it can fix a single stale
 * next step when the user corrects it in conversation (see taskOp below),
 * so a recommendation isn't working off out-of-date data after time away.
 *
 * No card chrome, no header, no input of its own — those used to live here
 * and produced a second glass card stacked directly under TodaysAnswerCard,
 * complete with its own "Focus" label, its own Close button, and a second
 * text field duplicating the card's own "or steer it" input right above it.
 * TodaysAnswerCard's SteerPanel now owns all of that and renders this
 * component inline as the conversation itself, once one exists — one card,
 * one input, one thread.
 *
 * State lives in useFocusChatStore so the card's chips and free-text field
 * can open and send into it from outside.
 */

import { useRef, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSessionContextStore } from '../../stores/useSessionContextStore'
import { useFocusChatStore } from '../../stores/useFocusChatStore'
import { toPortfolioSummaries } from './focusChatOps'
import { FocusChatActionCard } from './FocusChatActionCard'
import { FocusChatTaskOpCard } from './FocusChatTaskOpCard'
import { UserBubble, RegenerateRow } from '../chat/ChatPrimitives'
import { ThinkingIndicator } from '../chat/ThinkingIndicator'

export function FocusChat({ onEditMessage }: { onEditMessage: (content: string) => void }) {
  const allProjects = useProjectStore(s => s.allProjects)
  const feeling = useSessionContextStore(s => s.feeling)
  const messages = useFocusChatStore(s => s.messages)
  const thinking = useFocusChatStore(s => s.thinking)
  const markGuideFlag = useFocusChatStore(s => s.markGuideFlag)
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  const sendMessage = (message: string) => useFocusChatStore.getState().sendMessage(message, portfolioSummaries, feeling)
  const regenerate = () => useFocusChatStore.getState().regenerate(portfolioSummaries, feeling)

  const lastUserIndex = messages.reduce((acc, m, i) => (m.kind === 'you' ? i : acc), -1)

  // Drops the message (and the guide's reply to it) from the thread and
  // hands the text back to the parent's own input — the only escape from a
  // misunderstood message used to be dismissing its cards and retyping the
  // whole thing from scratch.
  const editMessage = (index: number) => {
    const content = useFocusChatStore.getState().editMessage(index)
    if (content !== null) onEditMessage(content)
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

  if (messages.length === 0) return null

  return (
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

      {canKeepGoing && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => sendMessage("What else needs attention?")}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-medium transition-colors hover:bg-white/[0.04]"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.6, border: '1px dashed rgba(255,255,255,0.1)' }}
        >
          Keep going <ChevronRight className="h-3.5 w-3.5" />
        </motion.button>
      )}
    </div>
  )
}
