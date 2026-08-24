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
import { parsePortfolioAction, parsePortfolioTaskOp, parsePortfolioNewProject, type PortfolioProjectSummary, type Message } from '../components/home/focusChatOps'
import { useMemoryStore } from './useMemoryStore'
import { useProjectIdeasStore } from './useProjectIdeasStore'

/** What the chat is given about the user beyond the project list.
 *
 *  Without this the model could only see project titles and completion
 *  percentages, so the only observation available to it was "you're at
 *  90%, want to start?" — which is why every reply sounded the same and
 *  none of them sounded like it knew anything. */
function buildCorpus(rejectedNewProjectTitles: Set<string>) {
  const memories = useMemoryStore.getState().memories ?? []
  const pendingIdeas = (useProjectIdeasStore.getState().ideas ?? [])
    .filter(i => !rejectedNewProjectTitles.has(i.title.trim().toLowerCase()))

  return {
    // Recent captures, newest first. Title + a short excerpt is enough for
    // the model to notice a recurring pull without shipping the whole
    // corpus on every turn.
    recentCaptures: memories.slice(0, 12).map(m => ({
      title: m.title,
      date: m.created_at,
      excerpt: (m.body || '').slice(0, 180),
      themes: m.themes ?? undefined,
    })),
    // Already evidence-backed new-project material, generated from the
    // full corpus by the ideas pipeline. Gives "something new" a real,
    // grounded answer instead of forcing a reach for an existing project.
    pendingIdeas: pendingIdeas.map(i => ({
      id: i.id,
      title: i.title,
      pitch: i.pitch,
      whyNow: i.why_now,
    })),
  }
}

interface FocusChatState {
  expanded: boolean
  messages: Message[]
  thinking: boolean
  // Applied (not just proposed) project ids this session — sent to the
  // backend so a long "Keep going" sweep doesn't re-recommend something
  // already settled, regardless of the capped history sent per turn.
  discussedProjectIds: Set<string>
  // Turned DOWN this session. Separate from discussed because the failure
  // mode is different: re-proposing something the user just rejected (and
  // the live transcript showed it doing exactly that, twice, after
  // apologising) reads as not listening at all.
  rejectedProjectIds: Set<string>
  // Same idea, for `newProject` proposals — which have no portfolio id to
  // put in rejectedProjectIds since the project doesn't exist yet. Without
  // this a dismissed new-project card had zero effect on the next turn:
  // dismissing isn't a chat message, so the model had no way to see it was
  // turned down and could propose the identical idea again immediately.
  // Keyed by lowercased title (works for both a waiting idea and one the
  // model invented fresh, which has no id at all).
  rejectedNewProjectTitles: Set<string>

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
  markGuideFlag: (
    index: number,
    key: 'taskOpResolved' | 'taskOpDismissed' | 'actionResolved' | 'actionDismissed' | 'newProjectResolved' | 'newProjectDismissed',
    opts?: { discussedProjectId?: string; rejectedProjectId?: string; rejectedNewProjectTitle?: string },
  ) => void
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
  rejectedProjectIds: Set<string>,
  rejectedNewProjectTitles: Set<string>,
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
        rejectedProjectIds: Array.from(rejectedProjectIds),
        rejectedNewProjectTitles: Array.from(rejectedNewProjectTitles),
        corpus: buildCorpus(rejectedNewProjectTitles),
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
    const newProject = parsePortfolioNewProject(data.newProject)

    return {
      kind: 'guide' as const,
      content: (data.reply as string) || 'Lost my train of thought there — try that again?',
      // One proposal per turn: if the model somehow returns both, the new
      // project wins — it's the move that only exists when the user has
      // explicitly asked for something that isn't already in the list.
      action: newProject ? null : action,
      actionResolved: false,
      actionDismissed: false,
      taskOp,
      taskOpResolved: false,
      taskOpDismissed: false,
      newProject,
      newProjectResolved: false,
      newProjectDismissed: false,
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
  rejectedProjectIds: new Set(),
  rejectedNewProjectTitles: new Set(),

  // Seeds the thread with the given opening line only if it's still empty —
  // repeat calls (e.g. re-opening after closing) never stomp a live
  // conversation.
  open: (openingLine) => {
    set(s => ({ expanded: true, messages: s.messages.length === 0 ? [{ kind: 'guide', content: openingLine }] : s.messages }))
  },

  close: () => set({ expanded: false }),

  reset: () => set({ expanded: false, messages: [], thinking: false, discussedProjectIds: new Set(), rejectedProjectIds: new Set(), rejectedNewProjectTitles: new Set() }),

  sendMessage: async (message, summaries, feeling) => {
    if (!message || get().thinking) return
    const nextMessages: Message[] = [...get().messages, { kind: 'you', content: message }]
    set({ messages: nextMessages, expanded: true, thinking: true })
    const reply = await runTurn(message, nextMessages, summaries, feeling, get().discussedProjectIds, get().rejectedProjectIds, get().rejectedNewProjectTitles)
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
    const reply = await runTurn(priorUserMsg.content, historyBase, summaries, feeling, get().discussedProjectIds, get().rejectedProjectIds, get().rejectedNewProjectTitles)
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

  markGuideFlag: (index, key, opts) => {
    if (opts?.discussedProjectId) get().discussedProjectIds.add(opts.discussedProjectId)
    if (opts?.rejectedProjectId) get().rejectedProjectIds.add(opts.rejectedProjectId)
    if (opts?.rejectedNewProjectTitle) get().rejectedNewProjectTitles.add(opts.rejectedNewProjectTitle.trim().toLowerCase())
    set(s => ({ messages: s.messages.map((m, idx) => (idx === index && m.kind === 'guide') ? { ...m, [key]: true } : m) }))
  },
}))
