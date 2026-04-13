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
import { ArrowRight, Type, Mic, Loader2 } from 'lucide-react'
import { LiveVoiceCapture, type LiveVoiceCaptureHandle, type LiveVoiceStatus } from '../components/onboarding/LiveVoiceCapture'
import { CoverageDots } from '../components/onboarding/CoverageDots'
import { BookshelfStep } from '../components/onboarding/BookshelfStep'
import { RevealSequence } from '../components/onboarding/RevealSequence'
import { useMemoryStore } from '../stores/useMemoryStore'
import type {
  CoverageGrid,
  CoverageSlotId,
  OnboardingAnalysis,
  BookSearchResult,
} from '../types'

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
  const { createMemory } = useMemoryStore()

  const [phase, setPhase] = useState<Phase>('welcome')
  const [grid, setGrid] = useState<CoverageGrid | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [userPartial, setUserPartial] = useState<string>('')
  const [justFilled, setJustFilled] = useState<CoverageSlotId[]>([])
  const [typingMode, setTypingMode] = useState(false)
  const [typingDraft, setTypingDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [liveReady, setLiveReady] = useState(false)
  const [liveStatus, setLiveStatus] = useState<LiveVoiceStatus>('connecting')

  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)

  const liveRef = useRef<LiveVoiceCaptureHandle | null>(null)
  const allTranscriptsRef = useRef<string[]>([])
  const inflightObserveRef = useRef(false)
  const shouldStopAfterTurnRef = useRef(false)

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

  // Once Live is connected AND the grid has loaded, trigger the model to
  // begin speaking the anchor question.
  useEffect(() => {
    if (phase === 'turn' && liveReady && liveRef.current && grid) {
      liveRef.current.begin()
    }
  }, [phase, liveReady, grid])

  const handleStart = useCallback(() => {
    setPhase('bootstrap')
    setError(null)
    void bootstrapGrid()
  }, [bootstrapGrid])

  // ── Live callbacks ──────────────────────────────────────────────────────
  const handleModelSpeaking = useCallback((accumulated: string) => {
    setCurrentQuestion(accumulated)
  }, [])

  const handleUserSpeaking = useCallback((accumulated: string) => {
    setUserPartial(accumulated)
  }, [])

  const handleLiveReady = useCallback(() => setLiveReady(true), [])

  const handleLiveError = useCallback((msg: string) => {
    console.error('[onboarding-chat] live error', msg)
    setError(msg)
  }, [])

  // ── Turn complete: save memory + run observer planner + maybe stop ──────
  const handleTurnComplete = useCallback(
    async (userTranscript: string, modelUtterance: string) => {
      if (!grid) return
      if (inflightObserveRef.current) return
      inflightObserveRef.current = true

      try {
        // The "first turn" from the model is just the anchor — user transcript
        // will be empty because we seeded the session with an internal "I'm
        // ready" message. Skip the observer on that turn.
        const isOpeningTurn = grid.turns.length === 0 && userTranscript.trim().length === 0
        if (isOpeningTurn) {
          // Seed the grid with the anchor question as turn 1 so subsequent
          // observations have the right shape.
          return
        }

        // Save the user's transcript as a foundational memory (tagged so we
        // can retrieve later without knowing the Live-decided slot).
        if (userTranscript.trim().length > 0) {
          allTranscriptsRef.current.push(userTranscript)
          try {
            await createMemory({
              body: userTranscript,
              memory_type: 'foundational',
              tags: ['onboarding', 'live-hybrid'],
            })
          } catch (memErr) {
            console.warn('[onboarding-chat] memory save failed, continuing', memErr)
          }
        }

        // Observer — updates the coverage grid based on what the user said
        // in response to what the model asked.
        const res = await fetch('/api/utilities?resource=onboarding-observe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grid,
            user_transcript: userTranscript,
            model_utterance: modelUtterance,
          }),
        })
        if (!res.ok) throw new Error('Observe failed')
        const data = (await res.json()) as {
          grid: CoverageGrid
          newly_filled_slots: CoverageSlotId[]
          stopping_hint: { should_stop: boolean; reason: string }
        }

        setGrid(data.grid)
        setJustFilled(data.newly_filled_slots)
        setUserPartial('')

        // If the observer thinks we've covered enough, close the Live session
        // gracefully and move on to the books step. The model's system prompt
        // also has its own stopping logic; whichever fires first wins.
        if (data.stopping_hint.should_stop) {
          shouldStopAfterTurnRef.current = true
          // Give the model a brief moment to finish whatever it's saying,
          // then close.
          setTimeout(() => {
            try { liveRef.current?.close() } catch {}
            setPhase('completing')
            setTimeout(() => setPhase('books'), 600)
          }, 400)
        }
      } catch (err: any) {
        console.error('[onboarding-chat] observe failed', err)
        // Not fatal — let the Live conversation continue.
      } finally {
        inflightObserveRef.current = false
      }
    },
    [grid, createMemory],
  )

  // ── Typing fallback ─────────────────────────────────────────────────────
  const handleTypedSubmit = useCallback(() => {
    const text = typingDraft.trim()
    if (!text) return
    liveRef.current?.sendUserText(text)
    setTypingDraft('')
  }, [typingDraft])

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
    return <BookshelfStep onComplete={handleBooksComplete} onSkip={handleBooksSkip} />
  }

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
      {/* Mounted once for the whole conversation. Live drives the chat. */}
      <LiveVoiceCapture
        ref={liveRef}
        hideVisualizer
        onTurnComplete={handleTurnComplete}
        onModelSpeaking={handleModelSpeaking}
        onUserSpeaking={handleUserSpeaking}
        onReady={handleLiveReady}
        onStatusChange={setLiveStatus}
        onError={handleLiveError}
      />

      <button
        onClick={() => {
          try { liveRef.current?.close() } catch {}
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
              className="text-2xl sm:text-3xl font-semibold leading-snug mb-10 min-h-[4rem]"
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
            <p className="mt-4 text-sm" style={{ color: 'var(--brand-danger, #dc2626)' }}>
              {error}
            </p>
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
// A clear, prominent visual cue for whose turn it is. Three states:
//   - speaking  → Aperture is talking (don't speak over it, but you can)
//   - listening → your turn (mic is hot, take your time)
//   - thinking  → bridging silence after you finished, before Aperture replies
function TurnIndicator({ status }: { status: LiveVoiceStatus }) {
  const speaking = status === 'speaking'
  const listening = status === 'listening' || status === 'ready'

  // The visual: a soft ring that pulses when listening, glows steady when
  // Aperture is speaking. Mic icon in the middle.
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
      <span
        className="text-[11px] uppercase tracking-[0.18em] font-medium"
        style={{
          color: 'var(--brand-text-secondary)',
          opacity: speaking ? 0.45 : listening ? 0.7 : 0.3,
        }}
      >
        {speaking ? 'Aperture' : listening ? 'your turn' : '\u00A0'}
      </span>
    </div>
  )
}
