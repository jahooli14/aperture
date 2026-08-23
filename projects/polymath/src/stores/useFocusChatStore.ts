/**
 * Focus chat state, lifted out of FocusChat.tsx so it can be driven from
 * outside the component — specifically, TodaysAnswerCard's "or steer it"
 * field and its corpus-signal chips both open this same thread instead of
 * running a second, parallel conversation surface. One thread, multiple
 * doors into it.
 *
 * FocusChat.tsx stays the only thing that renders the thread; this store
 * only holds state + the network call.
 */

import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { parsePortfolioAction, parsePortfolioTaskOp, type PortfolioProjectSummary, type Message } from '../components/home/focusChatOps'

interface FocusChatState {
  expanded: boolean
  messages: Message[]
  thinking: boolean
  // Applied (not just proposed) project ids this session — sent to the
  // backend so a long "Keep going" sweep doesn't re-recommend something
  // already settled, regardless of the capped history sent per turn.
  discussedProjectIds: Set<string>

  open: (openingLine: string) => void
  close: () => void
  // Actually ends the conversation — unlike close (which just hides it,
  // resumable later), this clears the transcript so "or steer it" opens
  // back to fresh corpus-signal chips instead of the old thread. Without
  // this, one conversation permanently replaces the chips for the rest of
  // the session with no way back short of reloading the page.
  reset: () => void
  sendMessage: (message: string, summaries: PortfolioProjectSummary[], feeling: string | null) => Promise<void>
  regenerate: (summaries: PortfolioProjectSummary[], feeling: string | null) => Promise<void>
  editMessage: (index: number) => string | null
  markGuideFlag: (index: number, key: 'taskOpResolved' | 'taskOpDismissed' | 'actionResolved' | 'actionDismissed', discussedProjectId?: string) => void
}

const MAX_HISTORY_TURNS = 16
const getApiHistory = (messages: Message[]) =>
  messages.slice(-MAX_HISTORY_TURNS).map(m => ({ role: m.kind === 'you' ? 'user' as const : 'model' as const, content: m.content }))

async function runTurn(
  message: string,
  historyBase: Message[],
  summaries: PortfolioProjectSummary[],
  feeling: string | null,
  discussedProjectIds: Set<string>,
) {
  const knownProjectIds = new Set(summaries.map(p => p.id))
  const knownProjectsById = new Map(summaries.map(p => [p.id, p]))

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
        projects: summaries,
        alreadyDiscussed: Array.from(discussedProjectIds),
      }),
    })

    let data: Record<string, unknown>
    try { data = await res.json() } catch {
      return { kind: 'guide' as const, content: 'Lost my train of thought there — try that again?' }
    }
    if (!res.ok) {
      console.error('[useFocusChatStore] request failed:', res.status, (data as any)?.error)
      return { kind: 'guide' as const, content: "Couldn't reach you there — try again?" }
    }

    const rawActions = Array.isArray(data.actions) ? data.actions : []
    const action = parsePortfolioAction(rawActions[0], knownProjectIds)
    const taskOp = parsePortfolioTaskOp(data.taskOp, knownProjectsById)

    return {
      kind: 'guide' as const,
      content: (data.reply as string) || 'Lost my train of thought there — try that again?',
      action,
      actionResolved: false,
      actionDismissed: false,
      taskOp,
      taskOpResolved: false,
      taskOpDismissed: false,
    }
  } catch (err) {
    console.error('[useFocusChatStore] network error:', err)
    return { kind: 'guide' as const, content: "Couldn't reach you there — try again?" }
  }
}

export const useFocusChatStore = create<FocusChatState>((set, get) => ({
  expanded: false,
  messages: [],
  thinking: false,
  discussedProjectIds: new Set(),

  // Seeds the thread with the given opening line only if it's still empty —
  // repeat calls (e.g. re-opening after closing) never stomp a live
  // conversation.
  open: (openingLine) => {
    set(s => ({ expanded: true, messages: s.messages.length === 0 ? [{ kind: 'guide', content: openingLine }] : s.messages }))
  },

  close: () => set({ expanded: false }),

  reset: () => set({ expanded: false, messages: [], thinking: false, discussedProjectIds: new Set() }),

  sendMessage: async (message, summaries, feeling) => {
    if (!message || get().thinking) return
    const nextMessages: Message[] = [...get().messages, { kind: 'you', content: message }]
    set({ messages: nextMessages, expanded: true, thinking: true })
    const reply = await runTurn(message, nextMessages, summaries, feeling, get().discussedProjectIds)
    set(s => ({ messages: [...s.messages, reply], thinking: false }))
  },

  regenerate: async (summaries, feeling) => {
    const { messages, thinking } = get()
    if (thinking || messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last.kind !== 'guide') return
    const priorUserMsg = [...messages].reverse().find(m => m.kind === 'you')
    if (!priorUserMsg) return
    const historyBase = messages.slice(0, -1)
    set({ messages: historyBase, thinking: true })
    const reply = await runTurn(priorUserMsg.content, historyBase, summaries, feeling, get().discussedProjectIds)
    set(s => ({ messages: [...s.messages, reply], thinking: false }))
  },

  // Returns the message text to load back into the input, and drops it (and
  // the guide's reply to it) from the thread. Caller owns the input field.
  editMessage: (index) => {
    const { messages, thinking } = get()
    const msg = messages[index]
    if (!msg || msg.kind !== 'you' || thinking) return null
    set({ messages: messages.slice(0, index) })
    return msg.content
  },

  markGuideFlag: (index, key, discussedProjectId) => {
    if (discussedProjectId) get().discussedProjectIds.add(discussedProjectId)
    set(s => ({ messages: s.messages.map((m, idx) => (idx === index && m.kind === 'guide') ? { ...m, [key]: true } : m) }))
  },
}))
