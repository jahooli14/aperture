/**
 * OnboardingChatPage — Aperture's contextual onboarding chat
 *
 * Voice transport: gemini-3.1-flash-live-preview runs the conversation
 * directly (Option C hybrid). The Live model's system prompt contains the
 * entire onboarding design (anchor question, 6 coverage slots, reframe
 * style, stopping criteria). After each turn completes, this page calls
 * the server-side observe planner to update the coverage grid — which
 * feeds the dots animation and the final reveal analysis.
 *
 * See docs/ONBOARDING_CHAT_SPEC.md.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Type, Mic, Loader2, Lock } from 'lucide-react'
import { LiveVoiceCapture, type LiveVoiceCaptureHandle, type LiveVoiceStatus } from '../components/onboarding/LiveVoiceCapture'
import { CoverageDots } from '../components/onboarding/CoverageDots'
import { BookshelfStep } from '../components/onboarding/BookshelfStep'
import { RevealSequence } from '../components/onboarding/RevealSequence'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useListStore } from '../stores/useListStore'
import { useProjectStore } from '../stores/useProjectStore'
import { useAuthContext } from '../contexts/AuthContext'
import type {
  CoverageGrid,
  CoverageSlotId,
  OnboardingAnalysis,
  BookSearchResult,
  ListType,
} from '../types'

/** Named entity the observer surfaced during the voice chat — e.g. a film
 *  they mentioned, a book, a place. We pre-populate the bookshelf with
 *  books, and save the rest straight to the matching list when the
 *  onboarding completes. */
interface CapturedItem {
  type: ListType
  name: string
  raw_phrase: string
}

/** A project the observer caught the user mentioning mid-chat. Two
 *  flavours, routed to different surfaces:
 *   - status: 'idea' — they want to make this. Saved as a
 *     project_suggestion (status pending) so it appears in Home's
 *     "Try Something New" carousel alongside the AI-derived intersections.
 *   - status: 'in_progress' — they're already doing this. Saved as a
 *     real Project (status 'active') so it shows up in the Projects
 *     pillar from day one. */
interface CapturedProject {
  title: string
  description: string
  status: 'idea' | 'in_progress'
  raw_phrase: string
}

type Phase =
  | 'welcome'
  | 'bootstrap'
  | 'turn'
  | 'completing'
  | 'books'
  | 'analyzing'
  | 'reveal'

export function OnboardingChatPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthContext()
  const { createMemory } = useMemoryStore()
  const { createList, addListItem, lists } = useListStore()
  const createProject = useProjectStore(s => s.createProject)

  const [phase, setPhase] = useState<Phase>('welcome')
  const [grid, setGrid] = useState<CoverageGrid | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [userPartial, setUserPartial] = useState<string>('')
  const [justFilled, setJustFilled] = useState<CoverageSlotId[]>([])
  const [typingMode, setTypingMode] = useState(false)
  const [typingDraft, setTypingDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The voice component auto-starts the conversation on connection — no
  // begin() trigger needed from the parent. We track `liveReady` purely
  // for visual state (show the mic, hide the "connecting" spinner).
  const [liveReady, setLiveReady] = useState(false)
  const [liveStatus, setLiveStatus] = useState<LiveVoiceStatus>('connecting')
  // Rolling diagnostic log surfaced in the silent-start fallback so users
  // who hit the "model never spoke" timeout on mobile can screenshot the
  // actual lifecycle events instead of staring at a generic retry card.
  const [diagnostics, setDiagnostics] = useState<string[]>([])
  const handleDiagnostic = useCallback((event: string) => {
    setDiagnostics(prev => {
      const stamped = `${new Date().toISOString().slice(11, 19)} ${event}`
      const next = [...prev, stamped]
      return next.length > 20 ? next.slice(-20) : next
    })
  }, [])

  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)

  const liveRef = useRef<LiveVoiceCaptureHandle | null>(null)
  const allTranscriptsRef = useRef<string[]>([])
  const shouldStopAfterTurnRef = useRef(false)
  // Named things the user mentioned during the chat — accumulated across
  // every observe call. Books are pre-populated into the BookshelfStep;
  // other types (films, places, etc.) are persisted to their respective
  // lists when onboarding completes.
  const capturedItemsRef = useRef<CapturedItem[]>([])
  const [capturedBooks, setCapturedBooks] = useState<BookSearchResult[]>([])
  // Project ideas the user explicitly raised mid-chat. Persisted to
  // project_suggestions on chat-end so they show up in Home's
  // "Try Something New" carousel alongside the AI-derived suggestions.
  const capturedProjectsRef = useRef<CapturedProject[]>([])

  // ── Bootstrap: fetch a grid (we still need one for the random dot
  //    permutation + as the shape the observer mutates) ───────────────────
  const bootstrapGrid = useCallback(async () => {
    try {
      const res = await fetch('/api/utilities?resource=onboarding-start', { method: 'POST' })
      if (!res.ok) throw new Error('Start failed')
      const data = await res.json()
      setGrid(data.grid as CoverageGrid)
      setPhase('turn')
    } catch (err: any) {
      console.error('[onboarding-chat] bootstrap failed', err)
      setError("Couldn't start the chat. Check your connection and try again.")
      setPhase('welcome')
    }
  }, [])

  // ── Already-onboarded guard ────────────────────────────────────────────
  // Onboarding is a one-time experience. If this user has already done it
  // (has at least one foundational memory tagged 'onboarding'), redirect
  // home silently. Async + fire-and-forget; the welcome render stays
  // snappy and just gets replaced if the probe comes back positive.
  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/memories')
        if (!res.ok) return
        const { memories = [] } = await res.json()
        const alreadyOnboarded = Array.isArray(memories) && memories.some((m: any) =>
          m?.memory_type === 'foundational' &&
          Array.isArray(m?.tags) &&
          (m.tags.includes('onboarding') || m.tags.includes('live-hybrid')),
        )
        if (!cancelled && alreadyOnboarded) navigate('/', { replace: true })
      } catch {
        // Probe failed — let them onboard. Worst case is a duplicate run.
      }
    })()
    return () => { cancelled = true }
  }, [isAuthenticated, navigate])

  // No-response fallback. The voice component auto-triggers the opening
  // turn on connection, so if 10s after "ready" we haven't heard the model
  // speak and don't have any transcript, surface a clear retry.
  const [silentStart, setSilentStart] = useState(false)
  useEffect(() => {
    if (phase !== 'turn' || !liveReady) return
    setSilentStart(false)
    const timer = setTimeout(() => {
      if (!currentQuestion && liveStatus !== 'speaking') {
        console.warn('[onboarding-chat] model did not speak anchor within 10s — showing retry')
        setSilentStart(true)
      }
    }, 10000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, liveReady])
  useEffect(() => {
    if (currentQuestion || liveStatus === 'speaking') setSilentStart(false)
  }, [currentQuestion, liveStatus])

  // NOTE: we deliberately do NOT auto-advance authed users past the welcome
  // page. iOS Safari requires the output AudioContext to be created inside
  // a user-gesture tick, and auto-advance breaks that — voice would silently
  // fail to produce audio on iPhones. The "Start talking" tap is the gesture
  // that does the unlock (see handleStart below). If you ever reintroduce
  // auto-advance, you MUST attach a one-shot document-level gesture listener
  // to perform the unlock on the user's next touch.

  // iOS Safari requires the output AudioContext to be created AND resumed
  // synchronously inside a user-gesture tick, or subsequent playback
  // silently no-ops. By the time <LiveVoiceCapture> mounts (after the
  // bootstrap fetch + phase transition), we're far outside that tick —
  // so we unlock here in the "Start talking" handler and hand the primed
  // context down. The silent-buffer playback is the canonical iOS trick
  // that actually convinces WebKit the context is live.
  const unlockedOutputCtxRef = useRef<AudioContext | null>(null)
  const unlockAudioOutput = useCallback(() => {
    if (unlockedOutputCtxRef.current) return
    try {
      const AudioCtx: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx({ sampleRate: 24000 })
      // Fire-and-forget — on iOS resume() returns a promise that resolves
      // once WebKit actually flips the state. We can't await it without
      // breaking the gesture tick, and it's not required: the silent
      // buffer below is what unlocks playback.
      if (ctx.state === 'suspended') void ctx.resume()
      const buf = ctx.createBuffer(1, 1, 24000)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      src.start(0)
      unlockedOutputCtxRef.current = ctx
    } catch (e) {
      console.warn('[onboarding-chat] audio unlock failed (non-iOS browsers are fine)', e)
    }
  }, [])

  const handleStart = useCallback(() => {
    // MUST run synchronously in the click handler, before any awaits, or
    // iOS audio unlock fails.
    unlockAudioOutput()
    setPhase('bootstrap')
    setError(null)
    void bootstrapGrid()
  }, [bootstrapGrid, unlockAudioOutput])

  // Mid-turn stall detection. After the user finishes speaking and we've
  // observed their turn, the model should start talking again within a few
  // seconds. If nothing arrives for STALL_MS we surface a retry affordance —
  // otherwise the user is staring at a silent mic icon with no recourse.
  const STALL_MS = 12000
  const [turnStalled, setTurnStalled] = useState(false)
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
  }, [])
  const armStallTimer = useCallback(() => {
    clearStallTimer()
    stallTimerRef.current = setTimeout(() => {
      console.warn('[onboarding-chat] model did not respond within stall window')
      setTurnStalled(true)
    }, STALL_MS)
  }, [clearStallTimer])
  useEffect(() => () => clearStallTimer(), [clearStallTimer])

  // ── Live callbacks ──────────────────────────────────────────────────────
  const handleModelSpeaking = useCallback((accumulated: string) => {
    setCurrentQuestion(accumulated)
    // Any model output clears the stall state + timer.
    clearStallTimer()
    setTurnStalled(false)
  }, [clearStallTimer])

  const handleUserSpeaking = useCallback((accumulated: string) => {
    setUserPartial(accumulated)
  }, [])

  const handleRetryVoice = useCallback(() => {
    // Full remount is the reliable path — the Live socket, audio contexts,
    // and mic stream all need fresh state. We keep the unlocked output
    // AudioContext around (iOS) and just cycle the voice component by
    // bouncing out of 'turn' and back.
    clearStallTimer()
    setTurnStalled(false)
    setCurrentQuestion('')
    setUserPartial('')
    setError(null)
    setLiveReady(false)
    setPhase('bootstrap')
    void bootstrapGrid()
  }, [bootstrapGrid, clearStallTimer])

  const handleLiveReady = useCallback(() => setLiveReady(true), [])

  const handleLiveError = useCallback((msg: string) => {
    console.error('[onboarding-chat] live error', msg)
    setError(msg)
  }, [])

  // ── Enrich a captured book title with cover art from Google Books. Adds
  //    to capturedBooks, deduped by title+author. Best-effort — no errors
  //    surfaced; if search fails we just won't pre-populate the bookshelf.
  const enrichBook = useCallback(async (item: CapturedItem) => {
    try {
      const res = await fetch(`/api/utilities?resource=book-search&q=${encodeURIComponent(item.name)}`)
      if (!res.ok) return
      const data = await res.json()
      const top = (data.results as BookSearchResult[] | undefined)?.[0]
      if (!top) return
      setCapturedBooks(prev => {
        if (prev.some(b => b.title === top.title && b.author === top.author)) return prev
        return [...prev, top].slice(0, 3)
      })
    } catch {
      // Silent fallback — onboarding continues fine without the enrichment.
    }
  }, [])

  // Idempotency guard — persistCapturedItems / persistCapturedProjects
  // may fire from multiple exit paths (should_stop, Exit button, books
  // handoff). Each fires at most once per session.
  const persistedItemsRef = useRef(false)
  const persistedProjectsRef = useRef(false)

  // Persist projects the observer caught mid-chat. Routing splits by
  // status: ideas land in the "Try Something New" carousel via the
  // existing save-idea endpoint; in-progress projects become real
  // Projects in the Projects pillar from day one.
  const persistCapturedProjects = useCallback(async () => {
    if (persistedProjectsRef.current) return
    persistedProjectsRef.current = true
    const projects = capturedProjectsRef.current
    if (projects.length === 0) return
    for (const project of projects) {
      try {
        if (project.status === 'in_progress') {
          await createProject({
            title: project.title,
            description: project.description,
            status: 'active',
            metadata: {
              source: 'onboarding-capture',
              captured_at: new Date().toISOString(),
              grounding_phrase: project.raw_phrase,
            } as any,
          })
        } else {
          await fetch('/api/projects?resource=save-idea', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: project.title,
              description: project.description,
              reasoning: `You mentioned this: "${project.raw_phrase}"`,
              source: 'onboarding-capture',
            }),
          })
        }
      } catch (e) {
        console.warn('[onboarding-chat] failed to save captured project', project.title, e)
      }
    }
  }, [createProject])

  // Persist EVERY captured item (books included) to its matching list when
  // the chat ends. The "quiet seeding" guarantee — when the user wanders
  // into Lists later they find what they mentioned.
  const persistCapturedItems = useCallback(async () => {
    if (persistedItemsRef.current) return
    persistedItemsRef.current = true
    const items = capturedItemsRef.current
    console.log('[onboarding-chat] persisting captured items', {
      total: items.length,
      byType: items.reduce<Record<string, number>>((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1
        return acc
      }, {}),
    })
    if (items.length === 0) return

    const byType = new Map<ListType, CapturedItem[]>()
    for (const item of items) {
      const list = byType.get(item.type) ?? []
      list.push(item)
      byType.set(item.type, list)
    }

    const listTitles: Record<ListType, string> = {
      film: 'Films', music: 'Music', tech: 'Tech', book: 'Books', place: 'Places',
      game: 'Games', software: 'Software', event: 'Events', quote: 'Quotes',
      article: 'Articles', generic: 'Things', fix: 'Fixes',
    }

    for (const [type, typeItems] of byType) {
      try {
        const existing = lists.find(l => l.type === type)
        // Stamp `origin: 'onboarding'` on newly-created lists so the
        // reset-onboarding action can find and remove them. Existing lists
        // are left alone — we only own what we create.
        const listId = existing
          ? existing.id
          : await createList({
              title: listTitles[type] || type,
              type,
              settings: { origin: 'onboarding' } as any,
            })
        for (const item of typeItems) {
          try {
            await addListItem({
              list_id: listId,
              content: item.name,
              metadata: { origin: 'onboarding' },
            })
          } catch (e) {
            console.warn('[onboarding-chat] failed to add item to list', type, item.name, e)
          }
        }
      } catch (e) {
        console.warn('[onboarding-chat] failed to create list for captured items', type, e)
      }
    }
  }, [lists, createList, addListItem])

  // Grid needs to be read fresh inside the serialised processor, otherwise
  // the second turn in a burst would observe against stale grid state.
  // Ref stays in sync via a useEffect below.
  const gridRef = useRef<CoverageGrid | null>(grid)
  useEffect(() => { gridRef.current = grid }, [grid])

  // ── Turn complete: save memory + observe + maybe stop ──────────────────
  // Turns are SERIALISED via a promise chain. Previously a second turn
  // landing while the first was still observing would be silently dropped
  // (via an `inflight` ref) — grid lost the update, dots didn't move,
  // captured items vanished. Chaining guarantees every turn lands, in
  // order, against fresh grid state.
  const processTurn = useCallback(
    async (userTranscript: string, modelUtterance: string) => {
      const currentGrid = gridRef.current
      if (!currentGrid) return

      // The "first turn" from the model is just the anchor — user transcript
      // will be empty because we seeded the session with an internal "Hi."
      // Skip the observer on that turn.
      const isOpeningTurn = currentGrid.turns.length === 0 && userTranscript.trim().length === 0
      if (isOpeningTurn) return

      // Track the user's transcript for the end-of-chat segmentation pass.
      // We used to persist a foundational memory per turn, but related thoughts
      // often spanned multiple turns and ended up fragmented. Persistence is
      // deferred to `persistConversationMemories`, which re-reads the whole
      // conversation once and cuts it into coherent notes.
      if (userTranscript.trim().length > 0) {
        allTranscriptsRef.current.push(userTranscript)
      }

      // Observer — updates the coverage grid based on what the user said
      // in response to what the model asked.
      let data: {
        grid: CoverageGrid
        newly_filled_slots: CoverageSlotId[]
        stopping_hint: { should_stop: boolean; reason: string }
        captured_items?: CapturedItem[]
        captured_projects?: CapturedProject[]
      } | null = null
      try {
        const res = await fetch('/api/utilities?resource=onboarding-observe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid: currentGrid,
            user_transcript: userTranscript,
            model_utterance: modelUtterance,
          }),
        })
        if (!res.ok) throw new Error('Observe failed')
        data = await res.json()
      } catch (err: any) {
        console.error('[onboarding-chat] observe failed', err)
        return
      }
      if (!data) return

      setGrid(data.grid)
      // Keep gridRef in sync immediately — don't wait for the useEffect —
      // so the NEXT queued turn observes against this result, not the
      // pre-turn grid.
      gridRef.current = data.grid
      setJustFilled(data.newly_filled_slots)
      setUserPartial('')
      // We've observed the user's turn; now wait for the model to respond.
      // If nothing arrives within STALL_MS, surface a retry.
      if (!data.stopping_hint.should_stop) {
        setCurrentQuestion('')
        armStallTimer()
      }

      // Accumulate any named entities the observer pulled out.
      if (data.captured_items && data.captured_items.length > 0) {
        const seen = new Set(
          capturedItemsRef.current.map(i => `${i.type}::${i.name.toLowerCase()}`),
        )
        for (const item of data.captured_items) {
          const key = `${item.type}::${item.name.toLowerCase()}`
          if (seen.has(key)) continue
          seen.add(key)
          capturedItemsRef.current.push(item)
          if (item.type === 'book') void enrichBook(item)
        }
      }

      // Accumulate any project intents the user raised.
      if (data.captured_projects && data.captured_projects.length > 0) {
        const seenProjects = new Set(
          capturedProjectsRef.current.map(p => p.title.toLowerCase()),
        )
        for (const project of data.captured_projects) {
          const key = project.title.toLowerCase()
          if (seenProjects.has(key)) continue
          seenProjects.add(key)
          capturedProjectsRef.current.push(project)
        }
      }

      // If the observer thinks we've covered enough, close the Live session
      // and move on. Both the model's prompt and the observer can trigger
      // stop; whichever fires first wins.
      if (data.stopping_hint.should_stop && !shouldStopAfterTurnRef.current) {
        shouldStopAfterTurnRef.current = true
        setTimeout(() => {
          try { liveRef.current?.close() } catch {}
          setPhase('completing')
          void persistCapturedItems()
          void persistCapturedProjects()
          setTimeout(() => setPhase('books'), 600)
        }, 400)
      }
    },
    [armStallTimer, enrichBook, persistCapturedItems, persistCapturedProjects],
  )

  // Serialise per-turn processing via a promise chain so no turn is ever
  // dropped, even when the observer is slow.
  const turnChainRef = useRef<Promise<void>>(Promise.resolve())
  const handleTurnComplete = useCallback(
    (userTranscript: string, modelUtterance: string) => {
      const next = turnChainRef.current.then(() =>
        processTurn(userTranscript, modelUtterance),
      )
      // Swallow rejections so one failed turn doesn't break the chain for
      // every subsequent turn.
      turnChainRef.current = next.catch(err => {
        console.warn('[onboarding-chat] turn processing errored', err)
      })
    },
    [processTurn],
  )

  // ── Typing fallback ─────────────────────────────────────────────────────
  const handleTypedSubmit = useCallback(() => {
    const text = typingDraft.trim()
    if (!text) return
    liveRef.current?.sendUserText(text)
    setTypingDraft('')
  }, [typingDraft])

  // ── Conversation → foundational memories ────────────────────────────────
  // Runs once, at the end of the chat. Sends the full coverage grid to the
  // server, which re-reads the whole conversation and returns coherent chunks
  // grouped by topic. We then create one foundational memory per chunk.
  // Guarded so it's idempotent across the should_stop and analyze paths.
  const conversationPersistedRef = useRef(false)
  const persistConversationMemories = useCallback(
    async (coverageGrid: CoverageGrid) => {
      if (conversationPersistedRef.current) return
      conversationPersistedRef.current = true
      try {
        const res = await fetch('/api/utilities?resource=onboarding-segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverage_grid: coverageGrid }),
        })
        if (!res.ok) throw new Error(`Segment failed (${res.status})`)
        const data = (await res.json()) as {
          memories?: Array<{ title?: string; body?: string }>
        }
        const memories = Array.isArray(data.memories) ? data.memories : []
        for (const m of memories) {
          const body = (m.body || '').trim()
          if (!body) continue
          try {
            await createMemory({
              title: (m.title || '').trim() || undefined,
              body,
              memory_type: 'foundational',
              tags: ['onboarding', 'live-hybrid'],
            })
          } catch (createErr) {
            console.warn('[onboarding-chat] memory save failed, continuing', createErr)
          }
        }
      } catch (err) {
        // Fallback: save the whole conversation as a single memory so the
        // user doesn't lose their chat if segmentation was unavailable.
        console.warn('[onboarding-chat] segmentation failed, saving fallback', err)
        const joined = allTranscriptsRef.current.map(t => t.trim()).filter(Boolean).join('\n\n')
        if (joined.length > 0) {
          try {
            await createMemory({
              title: 'Onboarding conversation',
              body: joined,
              memory_type: 'foundational',
              tags: ['onboarding', 'live-hybrid'],
            })
          } catch (createErr) {
            console.warn('[onboarding-chat] fallback memory save failed', createErr)
          }
        }
      }
    },
    [createMemory],
  )

  // ── Books / analysis handoff ─────────────────────────────────────────────
  const runAnalysis = useCallback(
    async (selectedBooks: BookSearchResult[]) => {
      if (!grid) return
      // Belt-and-braces: if persistence didn't fire via the should_stop path
      // (e.g. Live session ended some other way), catch it here before we
      // run the analyze step. Idempotent — no-op if already persisted.
      await persistCapturedItems()
      await persistCapturedProjects()
      await persistConversationMemories(grid)
      setPhase('analyzing')
      try {
        const res = await fetch('/api/utilities?resource=analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coverage_grid: grid,
            books: selectedBooks.map(b => ({ title: b.title, author: b.author })),
          }),
        })
        if (!res.ok) throw new Error('Analysis failed')
        const data = (await res.json()) as OnboardingAnalysis
        setAnalysis(data)
      } catch {
        setAnalysis({
          capabilities: [],
          themes: [],
          patterns: [],
          first_insight: 'Your thoughts are saved. Start a project to see how they connect.',
          project_suggestions: [],
        })
      } finally {
        setPhase('reveal')
      }
    },
    [grid, persistCapturedItems, persistCapturedProjects, persistConversationMemories],
  )

  const handleBooksComplete = useCallback(
    (selected: BookSearchResult[]) => {
      setBooks(selected)
      void runAnalysis(selected)
    },
    [runAnalysis],
  )

  const handleBooksSkip = useCallback(() => {
    setBooks([])
    void runAnalysis([])
  }, [runAnalysis])

  // ── Auth gate ───────────────────────────────────────────────────────────
  // The chat is a 3-minute commitment that produces real artifacts —
  // memories, list items, an analysis. All of those go through
  // authenticated endpoints, so guests would silently lose everything they
  // capture during the chat. Block here instead, with a short explanation
  // and a sign-in CTA. (See docs/GUEST_ONBOARDING_SPEC.md for the proper
  // try-before-you-buy pattern, scoped as follow-up work.)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg w-full"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 180 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.12)' }}
          >
            <Mic className="h-6 w-6" style={{ color: 'var(--brand-primary)' }} />
          </motion.div>

          {/* The promise — lead with the value, not the friction. */}
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-[2.1rem] sm:text-[2.6rem] font-semibold leading-[1.08] tracking-tight mb-5"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            A project you'd never have<br className="hidden sm:block" /> thought of yourself.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="text-base sm:text-lg leading-relaxed mb-7 max-w-md mx-auto"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            Talk for three minutes. Aperture listens for the threads between the things you mention — and surfaces something to build that genuinely surprises you.
          </motion.p>

          {/* Sample reveal teaser — hints at the format the user is signing
              up to receive. Same two-quote-split aesthetic as the real
              InsightBody, with an unmistakable "example" label so we're
              not pretending it's theirs. Glow breathes slowly so the card
              feels alive without being distracting. */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              boxShadow: [
                '0 6px 28px -14px rgba(var(--brand-primary-rgb),0.22)',
                '0 6px 34px -10px rgba(var(--brand-primary-rgb),0.38)',
                '0 6px 28px -14px rgba(var(--brand-primary-rgb),0.22)',
              ],
            }}
            transition={{
              opacity: { delay: 0.85, duration: 0.5 },
              y: { delay: 0.85, duration: 0.5 },
              boxShadow: { duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 1.2 },
            }}
            className="p-5 sm:p-6 rounded-2xl mb-9"
            style={{
              background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.10), rgba(var(--brand-primary-rgb),0.04))',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(var(--brand-primary-rgb),0.16)',
            }}
          >
            <p
              className="text-[10px] uppercase tracking-[0.22em] font-medium mb-4"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.55 }}
            >
              an example reveal
            </p>
            <div className="flex flex-col gap-3 text-center">
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                className="text-base sm:text-lg italic font-medium leading-snug"
                style={{ color: 'var(--brand-primary)' }}
              >
                “the welding part caught my ear”
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: 1.35, duration: 0.6 }}
                className="text-xs sm:text-sm leading-relaxed mx-auto max-w-prose"
                style={{ color: 'var(--brand-text-primary)' }}
              >
                Both of these are the same thought in different clothes — you're missing a kind of work that doesn't have a name in your day job.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.7, duration: 0.5 }}
                className="text-base sm:text-lg italic font-medium leading-snug"
                style={{ color: 'var(--brand-primary)' }}
              >
                “I miss making things with my hands”
              </motion.p>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.05 }}
            onClick={() => navigate('/login?next=/onboarding')}
            className="btn-primary px-10 py-4 text-base font-semibold inline-flex items-center gap-2"
          >
            Sign in to begin
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          {/* The ask — small, factual, in service of the promise above. */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            transition={{ delay: 1.25 }}
            className="mt-4 text-xs flex items-center justify-center gap-1.5"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            <Lock className="h-3 w-3" />
            We need an account so we can keep what you share.
          </motion.p>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.4 }}
            onClick={() => navigate('/')}
            className="mt-7 block mx-auto text-xs hover:opacity-80"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            Not now
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // ── Welcome ─────────────────────────────────────────────────────────────
  // Authed users see the same welcome page as everyone else. The button tap
  // is load-bearing: it's the user-gesture tick that unlocks the output
  // AudioContext for iOS Safari (see unlockAudioOutput). Do not short-
  // circuit this — auto-advance would silently break voice on iPhones.
  if (phase === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-[22rem] sm:max-w-md w-full"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 180 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-8"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.12)' }}
          >
            <Mic className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-[1.75rem] sm:text-4xl font-semibold leading-[1.1] mb-4"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            The hidden depth of your curiosity.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-base mb-10"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            A few minutes of talking. Aperture maps the connections.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={handleStart}
            className="btn-primary px-10 py-4 text-base font-semibold inline-flex items-center gap-2"
          >
            Start talking
            <ArrowRight className="h-4 w-4" />
          </motion.button>

          {error && (
            <p className="mt-6 text-sm" style={{ color: 'var(--brand-danger, #dc2626)' }}>
              {error}
            </p>
          )}

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.1 }}
            onClick={() => navigate('/')}
            className="mt-8 block mx-auto text-xs hover:opacity-80"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            Not now
          </motion.button>
        </motion.div>
      </div>
    )
  }

  if (phase === 'bootstrap' || phase === 'completing') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--brand-text-secondary)' }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          {phase === 'bootstrap' ? 'Getting ready…' : 'Nice. Pulling that together…'}
        </div>
      </div>
    )
  }

  if (phase === 'books') {
    return (
      <BookshelfStep
        onComplete={handleBooksComplete}
        onSkip={handleBooksSkip}
        prepopulated={capturedBooks}
      />
    )
  }

  if (phase === 'analyzing' || phase === 'reveal') {
    if (phase === 'reveal' && analysis) {
      // Lift short grounding phrases off the coverage grid so the refine-idea
      // prompt can keep later rounds anchored in the user's own words.
      const groundingPhrases = grid
        ? Object.values(grid.slots).flatMap(s => s.grounding_phrases).filter(Boolean).slice(0, 20)
        : []
      // Summarise the lists the observer quietly seeded during the chat, so
      // the reveal can disclose them rather than have the user stumble on
      // them in Lists later.
      const seededCounts = new Map<string, number>()
      for (const item of capturedItemsRef.current) {
        seededCounts.set(item.type, (seededCounts.get(item.type) || 0) + 1)
      }
      const seededLists = Array.from(seededCounts, ([type, count]) => ({ type, count }))
      const enrichedAnalysis: OnboardingAnalysis = { ...analysis, seeded_lists: seededLists }
      return (
        <RevealSequence
          analysis={enrichedAnalysis}
          books={books}
          transcripts={allTranscriptsRef.current}
          groundingPhrases={groundingPhrases}
        />
      )
    }
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <div className="flex gap-1 justify-center mb-6">
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="block w-2 h-2 rounded-full"
                style={{ background: 'var(--brand-primary)' }}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22 }}
              />
            ))}
          </div>
          <p className="text-base" style={{ color: 'var(--brand-text-secondary)' }}>
            Reading between the lines…
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Turn UI ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col px-4 py-12 relative">
      {/* Mounted once for the whole conversation. Live drives the chat. */}
      <LiveVoiceCapture
        ref={liveRef}
        hideVisualizer
        muted={typingMode}
        outputAudioContext={unlockedOutputCtxRef.current}
        onTurnComplete={handleTurnComplete}
        onModelSpeaking={handleModelSpeaking}
        onUserSpeaking={handleUserSpeaking}
        onReady={handleLiveReady}
        onStatusChange={setLiveStatus}
        onError={handleLiveError}
        onDiagnostic={handleDiagnostic}
      />

      <button
        onClick={() => {
          try { liveRef.current?.close() } catch {}
          // Best-effort persist before navigating — keeps whatever they
          // mentioned up to this point. Fire-and-forget; no UI delay.
          void persistCapturedItems()
          void persistCapturedProjects()
          navigate('/')
        }}
        className="absolute top-6 right-6 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
      >
        Exit
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full text-center">
          {/* Current question (live subtitle of what the model is saying) */}
          <AnimatePresence mode="wait">
            <motion.h2
              key={currentQuestion || 'waiting'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="text-xl sm:text-3xl font-semibold leading-snug mb-8 sm:mb-10 min-h-[3rem] sm:min-h-[4rem]"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              {currentQuestion || (liveReady ? '' : '\u00A0')}
            </motion.h2>
          </AnimatePresence>

          {/* Input surface */}
          {!typingMode ? (
            <div className="mb-6 flex flex-col items-center">
              {!liveReady ? (
                <div className="flex flex-col items-center gap-3 text-xs" style={{ color: 'var(--brand-text-secondary)' }}>
                  <Loader2 className="h-5 w-5 animate-spin opacity-60" />
                  <span className="opacity-60">Connecting voice…</span>
                </div>
              ) : silentStart ? (
                <div className="flex flex-col items-center gap-4 text-sm max-w-sm" style={{ color: 'var(--brand-text-secondary)' }}>
                  <p className="text-center leading-relaxed">
                    Hmm — Aperture's taking a beat to warm up. Mind refreshing the page to give it another go?
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-primary px-6 py-2.5 text-sm font-semibold"
                  >
                    Refresh
                  </button>
                  {/* Diagnostic log — invaluable for diagnosing "mic says
                      listening but nothing happens" on mobile devices
                      without a console. The user can screenshot this when
                      reporting an issue. */}
                  {diagnostics.length > 0 && (
                    <details className="w-full mt-2 text-left">
                      <summary className="text-[10px] uppercase tracking-wide opacity-50 cursor-pointer">
                        Diagnostic log (tap to expand)
                      </summary>
                      <pre
                        className="text-[10px] leading-snug mt-2 p-2 rounded overflow-x-auto"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'var(--brand-text-secondary)',
                          opacity: 0.7,
                          maxHeight: '180px',
                          overflowY: 'auto',
                        }}
                      >
                        {diagnostics.join('\n')}
                      </pre>
                    </details>
                  )}
                </div>
              ) : turnStalled ? (
                <div className="flex flex-col items-center gap-4 text-sm max-w-sm" style={{ color: 'var(--brand-text-secondary)' }}>
                  <p className="text-center leading-relaxed">
                    Taking longer than usual — want to try that again? Your thoughts so far are saved.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleRetryVoice}
                      className="btn-primary px-5 py-2 text-sm font-semibold inline-flex items-center gap-2"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      Try again
                    </button>
                    <button
                      onClick={() => {
                        setTurnStalled(false)
                        setTypingMode(true)
                      }}
                      className="px-4 py-2 text-sm hover:opacity-80 inline-flex items-center gap-1.5"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
                    >
                      <Type className="h-3.5 w-3.5" />
                      Type instead
                    </button>
                  </div>
                </div>
              ) : (
                <TurnIndicator status={liveStatus} />
              )}
            </div>
          ) : (
            <div className="mb-6">
              <textarea
                value={typingDraft}
                onChange={e => setTypingDraft(e.target.value)}
                placeholder="Type your answer…"
                rows={3}
                className="w-full rounded-xl p-4 text-base resize-none"
                style={{
                  background: 'var(--brand-glass-bg)',
                  color: 'var(--brand-text-primary)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  onClick={() => liveRef.current?.sendUserText('skip')}
                  className="hover:opacity-80"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                >
                  Skip this one
                </button>
                <button
                  onClick={handleTypedSubmit}
                  disabled={!typingDraft.trim()}
                  className="btn-primary px-5 py-2 inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  Send
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* User's live transcript */}
          <AnimatePresence>
            {userPartial && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                exit={{ opacity: 0 }}
                className="text-sm mt-2 italic max-w-md mx-auto"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                "{userPartial}"
              </motion.p>
            )}
          </AnimatePresence>

          {/* Mode toggle */}
          <button
            onClick={() => setTypingMode(v => !v)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            {typingMode ? (
              <>
                <Mic className="h-3 w-3" />
                back to voice
              </>
            ) : (
              <>
                <Type className="h-3 w-3" />
                type instead
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="text-sm" style={{ color: 'var(--brand-danger, #dc2626)' }}>
                {error}
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRetryVoice}
                  className="btn-primary px-4 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Mic className="h-3 w-3" />
                  Retry voice
                </button>
                <button
                  onClick={() => { setError(null); setTypingMode(true) }}
                  className="text-xs hover:opacity-80 inline-flex items-center gap-1.5"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
                >
                  <Type className="h-3 w-3" />
                  Type instead
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="pb-8 pt-4">
        {grid && <CoverageDots grid={grid} justFilled={justFilled} />}
      </div>

      {!typingMode && liveReady && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}>
          Say "skip" to move on
        </div>
      )}
    </div>
  )
}

// ── TurnIndicator ──────────────────────────────────────────────────────────
// Who's talking, without the turn-based game-show feel. The visual is the
// whole cue:
//   - speaking  → ring glows steady, mic dims (Aperture is talking)
//   - listening → ring breathes softly, mic bright (over to you)
// No "YOUR TURN" text — that was reading robotic. A tiny lowercase
// "listening…" / "…" sits underneath, quiet enough to be ignored.
function TurnIndicator({ status }: { status: LiveVoiceStatus }) {
  const speaking = status === 'speaking'
  const listening = status === 'listening' || status === 'ready'

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <motion.div
        animate={{
          scale: listening ? [1, 1.06, 1] : 1,
          boxShadow: speaking
            ? '0 0 36px 4px rgba(var(--brand-primary-rgb), 0.32)'
            : listening
              ? '0 0 18px 0 rgba(var(--brand-primary-rgb), 0.18)'
              : '0 0 0 0 rgba(0,0,0,0)',
        }}
        transition={{
          duration: listening ? 1.8 : 0.4,
          repeat: listening ? Infinity : 0,
          ease: 'easeInOut',
        }}
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(var(--brand-primary-rgb), 0.10)',
          border: `1px solid rgba(var(--brand-primary-rgb), ${speaking ? 0.6 : 0.3})`,
        }}
      >
        <Mic
          className="h-8 w-8"
          style={{
            color: 'var(--brand-primary)',
            opacity: speaking ? 0.55 : 1,
          }}
        />
      </motion.div>
      {/* Quiet caption — a gentle "listening…" during the user's turn so
          the state is legible to screen readers and nervous speakers. */}
      <span
        className="text-[11px] italic"
        style={{
          color: 'var(--brand-text-secondary)',
          opacity: speaking ? 0 : listening ? 0.45 : 0,
        }}
      >
        listening…
      </span>
    </div>
  )
}
