/**
 * OnboardingChatPage — Aperture's contextual onboarding chat (V2)
 *
 * Voice transport: gemini-3.1-flash-live-preview audio-to-audio via
 * LiveVoiceCapture. Native VAD + transcription + TTS — sub-second
 * stop-to-speak latency.
 *
 * Brain (unchanged from V1): the server-side coverage planner at
 * /api/onboarding-chat?action=turn. Live model is used purely as a voice
 * channel that speaks whatever text the planner produces.
 *
 * See docs/ONBOARDING_CHAT_SPEC.md.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Type, Mic, Loader2 } from 'lucide-react'
import { LiveVoiceCapture, type LiveVoiceCaptureHandle } from '../components/onboarding/LiveVoiceCapture'
import { CoverageDots } from '../components/onboarding/CoverageDots'
import { BookshelfStep } from '../components/onboarding/BookshelfStep'
import { RevealSequence } from '../components/onboarding/RevealSequence'
import { useMemoryStore } from '../stores/useMemoryStore'
import type {
  CoverageGrid,
  CoverageSlotId,
  PlannerDecision,
  OnboardingAnalysis,
  BookSearchResult,
} from '../types'

// ── Phases ─────────────────────────────────────────────────────────────────
type Phase =
  | 'welcome'          // hook + CTA (tapping it triggers user-gesture audio init)
  | 'bootstrap'        // ephemeral token + Live session establishing + grid initialising
  | 'turn'             // active conversation: question shown, mic hot, OR processing
  | 'completing'       // session ended, hand-off to books step
  | 'books'            // optional bookshelf
  | 'analyzing'        // final analysis call
  | 'reveal'           // existing RevealSequence

// ── Component ──────────────────────────────────────────────────────────────
export function OnboardingChatPage() {
  const navigate = useNavigate()
  const { createMemory } = useMemoryStore()

  const [phase, setPhase] = useState<Phase>('welcome')
  const [grid, setGrid] = useState<CoverageGrid | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [currentTargetSlot, setCurrentTargetSlot] = useState<CoverageSlotId | null>(null)
  const [currentReframe, setCurrentReframe] = useState<string>('')
  const [latestTranscript, setLatestTranscript] = useState<string>('')
  const [justFilled, setJustFilled] = useState<CoverageSlotId[]>([])
  const [typingMode, setTypingMode] = useState(false)
  const [typingDraft, setTypingDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voiceMode, setVoiceMode] = useState(true)
  const [liveReady, setLiveReady] = useState(false)

  // Analysis / reveal state
  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)

  // Refs
  const liveRef = useRef<LiveVoiceCaptureHandle | null>(null)
  const inflightRef = useRef(false)
  const allTranscriptsRef = useRef<string[]>([])
  const pendingAnchorRef = useRef<string | null>(null)

  // ── Bootstrap: fetch initial grid + speak anchor question ───────────────
  const bootstrapGrid = useCallback(async () => {
    try {
      const res = await fetch('/api/onboarding-chat?action=start', { method: 'POST' })
      if (!res.ok) throw new Error('Start failed')
      const data = await res.json()
      setGrid(data.grid as CoverageGrid)
      setCurrentQuestion(data.anchor_question as string)
      setCurrentTargetSlot(null)
      pendingAnchorRef.current = data.anchor_question as string
      setPhase('turn')
    } catch (err: any) {
      console.error('[onboarding-chat] bootstrap failed', err)
      setError("Couldn't start the chat. Check your connection and try again.")
      setPhase('welcome')
    }
  }, [])

  // Once both the Live session is ready AND the grid is loaded, speak the anchor.
  useEffect(() => {
    if (phase === 'turn' && liveReady && pendingAnchorRef.current && liveRef.current) {
      const text = pendingAnchorRef.current
      pendingAnchorRef.current = null
      liveRef.current.say(text).catch(() => {})
    }
  }, [phase, liveReady])

  const handleStart = useCallback(() => {
    setPhase('bootstrap')
    setError(null)
    void bootstrapGrid()
  }, [bootstrapGrid])

  // ── Handle a completed turn (transcript in hand) ────────────────────────
  const submitTurn = useCallback(
    async (rawTranscript: string, skipped: boolean) => {
      if (inflightRef.current) return
      if (!grid) return
      inflightRef.current = true

      setLatestTranscript(rawTranscript)

      try {
        // Save every turn as its own foundational memory (per spec).
        if (!skipped && rawTranscript.trim().length > 0) {
          allTranscriptsRef.current.push(rawTranscript)
          try {
            await createMemory({
              body: rawTranscript,
              memory_type: 'foundational',
              tags: currentTargetSlot
                ? ['onboarding', `slot:${currentTargetSlot}`]
                : ['onboarding', 'slot:anchor'],
            })
          } catch (memErr) {
            console.warn('[onboarding-chat] memory save failed, continuing', memErr)
          }
        }

        const res = await fetch('/api/onboarding-chat?action=turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid,
            latest_transcript: rawTranscript,
            latest_question: currentQuestion,
            latest_target_slot: currentTargetSlot,
            skipped,
          }),
        })
        if (!res.ok) throw new Error('Turn failed')
        const data = (await res.json()) as {
          decision: PlannerDecision
          grid: CoverageGrid
          newly_filled_slots: CoverageSlotId[]
          stopping_hint: { should_stop: boolean; reason: string }
        }

        setGrid(data.grid)
        setJustFilled(data.newly_filled_slots)
        setCurrentReframe(data.decision.reframe_text)

        // Speak the reframe (and next question, if any) via Live.
        const utterance = [data.decision.reframe_text, data.decision.next_question]
          .filter(Boolean)
          .join(' ')

        if (utterance && liveRef.current) {
          await liveRef.current.say(utterance).catch(() => {})
        }

        if (data.decision.should_stop || !data.decision.next_question) {
          setPhase('completing')
          await new Promise(r => setTimeout(r, 600))
          setPhase('books')
          return
        }

        // Reset state for the next turn (Live session keeps running).
        setCurrentQuestion(data.decision.next_question)
        setCurrentTargetSlot(data.decision.next_slot_target)
        setCurrentReframe('')
        setLatestTranscript('')
        setTypingDraft('')
        setJustFilled([])
      } catch (err: any) {
        console.error('[onboarding-chat] turn failed', err)
        setError('Something went wrong processing your answer.')
      } finally {
        inflightRef.current = false
      }
    },
    [grid, currentQuestion, currentTargetSlot, createMemory],
  )

  // ── LiveVoiceCapture callbacks ──────────────────────────────────────────
  const handleUserTurn = useCallback(
    (transcript: string) => {
      if (!voiceMode) return // ignore voice during typing-mode answers
      if (phase !== 'turn') return
      void submitTurn(transcript, transcript.trim().length === 0)
    },
    [voiceMode, phase, submitTurn],
  )

  const handleLiveReady = useCallback(() => setLiveReady(true), [])
  const handleLiveError = useCallback((msg: string) => {
    console.error('[onboarding-chat] live error', msg)
    setError(msg)
  }, [])

  const handleTypedSubmit = useCallback(() => {
    const text = typingDraft.trim()
    void submitTurn(text, text.length === 0)
  }, [typingDraft, submitTurn])

  // ── Books / analysis handoff ─────────────────────────────────────────────
  const runAnalysis = useCallback(
    async (selectedBooks: BookSearchResult[]) => {
      if (!grid) return
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
          entities: { people: [], places: [], topics: [], skills: [] },
          first_insight: 'Your thoughts are saved. Start a project to see how they connect.',
          graph_preview: { nodes: [], edges: [] },
          project_suggestions: [],
        })
      } finally {
        setPhase('reveal')
      }
    },
    [grid],
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

  // Cleanup on unmount: LiveVoiceCapture handles its own teardown.
  useEffect(() => () => undefined, [])

  // ── Welcome ─────────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-md w-full"
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
            className="text-3xl sm:text-4xl font-semibold leading-tight mb-4"
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

  // ── Bootstrap / completing (transient spinners) ─────────────────────────
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

  // ── Books ───────────────────────────────────────────────────────────────
  if (phase === 'books') {
    return <BookshelfStep onComplete={handleBooksComplete} onSkip={handleBooksSkip} />
  }

  // ── Analyzing / Reveal ──────────────────────────────────────────────────
  if (phase === 'analyzing' || phase === 'reveal') {
    if (phase === 'reveal' && analysis) {
      return <RevealSequence analysis={analysis} books={books} transcripts={allTranscriptsRef.current} />
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
      {/* The Live session lives for the whole turn loop. Mounted once. */}
      <LiveVoiceCapture
        ref={liveRef}
        onUserTurn={handleUserTurn}
        onReady={handleLiveReady}
        onError={handleLiveError}
        showVisualizer={false}
      />

      {/* Top-right: exit */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 right-6 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
      >
        Exit
      </button>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full text-center">
          {/* Reframe chip */}
          <AnimatePresence>
            {currentReframe && (
              <motion.div
                key={currentReframe}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-6 text-sm italic"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.9 }}
              >
                {currentReframe}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current question */}
          <AnimatePresence mode="wait">
            <motion.h2
              key={currentQuestion}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              className="text-2xl sm:text-3xl font-semibold leading-snug mb-10"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              {currentQuestion || (liveReady ? '' : 'Connecting voice…')}
            </motion.h2>
          </AnimatePresence>

          {/* Voice visual OR typing */}
          {voiceMode ? (
            <div className="mb-6 flex flex-col items-center">
              {/* Inline visualizer mirroring the LiveVoiceCapture status */}
              <LiveVisualizer liveReady={liveReady} processing={inflightRef.current} />
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
                disabled={inflightRef.current}
              />
              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  onClick={() => void submitTurn('', true)}
                  disabled={inflightRef.current}
                  className="hover:opacity-80 disabled:opacity-30"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                >
                  Skip this one
                </button>
                <button
                  onClick={handleTypedSubmit}
                  disabled={inflightRef.current}
                  className="btn-primary px-5 py-2 inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  Send
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Latest transcript (confirmation artefact) */}
          <AnimatePresence>
            {latestTranscript && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                className="text-sm mt-2 italic max-w-md mx-auto"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                "{latestTranscript}"
              </motion.p>
            )}
          </AnimatePresence>

          {/* Mode toggle (low prominence) */}
          <button
            onClick={() => setVoiceMode(v => !v)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            {voiceMode ? (
              <>
                <Type className="h-3 w-3" />
                type instead
              </>
            ) : (
              <>
                <Mic className="h-3 w-3" />
                back to voice
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 text-sm" style={{ color: 'var(--brand-danger, #dc2626)' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Dots at the base */}
      <div className="pb-8 pt-4">
        {grid && <CoverageDots grid={grid} justFilled={justFilled} />}
      </div>

      {voiceMode && liveReady && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}>
          Say "skip" to move on
        </div>
      )}
    </div>
  )
}

// ── Inline visualizer (just a pulsing mic — Live does the audio work) ─────
function LiveVisualizer({ liveReady, processing }: { liveReady: boolean; processing: boolean }) {
  if (!liveReady) {
    return (
      <div className="flex flex-col items-center gap-3 text-xs" style={{ color: 'var(--brand-text-secondary)' }}>
        <Loader2 className="h-5 w-5 animate-spin opacity-60" />
        <span className="opacity-60">Connecting voice…</span>
      </div>
    )
  }
  return (
    <motion.div
      animate={{ scale: processing ? 1 : [1, 1.08, 1] }}
      transition={{
        duration: processing ? 0.3 : 1.6,
        repeat: processing ? 0 : Infinity,
        ease: 'easeInOut',
      }}
      className="w-20 h-20 rounded-full flex items-center justify-center"
      style={{
        background: 'rgba(var(--brand-primary-rgb),0.12)',
        border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
      }}
    >
      <Mic className="h-8 w-8" style={{ color: 'var(--brand-primary)' }} />
    </motion.div>
  )
}
