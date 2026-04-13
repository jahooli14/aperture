/**
 * OnboardingChatPage — Aperture's contextual onboarding chat
 *
 * Replaces the legacy 5-voice-question OnboardingPage with an adaptive,
 * planner-driven conversation. See docs/ONBOARDING_CHAT_SPEC.md.
 *
 * V1 voice stack (this file):
 *   - MediaRecorder (via VoiceInput) for capture
 *   - Existing Gemini transcribe endpoint for speech-to-text
 *   - Server-side planner (/api/onboarding-chat) for coverage + reframe
 *   - Browser SpeechSynthesis for TTS
 *
 * V2 (follow-up): swap the three voice layers for gemini-3.1-flash-live-preview.
 * The planner / coverage / dots / skip / typing paths stay identical.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Type, Mic, Loader2 } from 'lucide-react'
import { VoiceInput } from '../components/VoiceInput'
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
  | 'welcome'          // hook + CTA
  | 'bootstrap'        // spinning up grid
  | 'listening'        // question posed, mic open
  | 'processing'       // transcribing + planner running
  | 'reframing'        // reframe + next question being spoken
  | 'completing'       // session ended, hand-off to books step
  | 'books'            // optional bookshelf
  | 'analyzing'        // final analysis call
  | 'reveal'           // existing RevealSequence

// ── TTS ────────────────────────────────────────────────────────────────────
/**
 * Speak a string via browser SpeechSynthesis. Resolves when playback ends.
 * Silent fallback if unavailable (headless browsers, strict iOS). The page
 * still shows the text visually, so users don't miss content.
 */
function speak(text: string): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve()
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 1.02
      utter.pitch = 1.0
      utter.volume = 1.0
      // Prefer a natural-sounding voice if any are installed
      const voices = window.speechSynthesis.getVoices()
      const preferred =
        voices.find(v => /Google UK English Female/i.test(v.name)) ||
        voices.find(v => /Samantha|Karen|Moira|Tessa/i.test(v.name)) ||
        voices.find(v => /en-GB|en-US/i.test(v.lang))
      if (preferred) utter.voice = preferred
      utter.onend = () => resolve()
      utter.onerror = () => resolve()
      window.speechSynthesis.speak(utter)
    } catch {
      resolve()
    }
  })
}

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
  const [voiceKey, setVoiceKey] = useState(0)
  const [typingMode, setTypingMode] = useState(false)
  const [typingDraft, setTypingDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Analysis / reveal state
  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)

  // Turn-in-flight guard (double-submit protection)
  const inflightRef = useRef(false)
  const allTranscriptsRef = useRef<string[]>([])

  // ── Bootstrap: fetch initial grid + anchor question ─────────────────────
  const startSession = useCallback(async () => {
    setPhase('bootstrap')
    setError(null)
    try {
      const res = await fetch('/api/onboarding-chat?action=start', { method: 'POST' })
      if (!res.ok) throw new Error('Start failed')
      const data = await res.json()
      setGrid(data.grid as CoverageGrid)
      setCurrentQuestion(data.anchor_question as string)
      setCurrentTargetSlot(null) // anchor is untargeted
      setPhase('listening')
      // Speak the anchor question
      speak(data.anchor_question).catch(() => {})
    } catch (err: any) {
      console.error('[onboarding-chat] bootstrap failed', err)
      setError('Couldn\'t start the chat. Check your connection and try again.')
      setPhase('welcome')
    }
  }, [])

  // ── Handle a completed turn (transcript in hand) ────────────────────────
  const submitTurn = useCallback(
    async (rawTranscript: string, skipped: boolean) => {
      if (inflightRef.current) return
      if (!grid) return
      inflightRef.current = true

      setPhase('processing')
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
                ? [`onboarding`, `slot:${currentTargetSlot}`]
                : [`onboarding`, `slot:anchor`],
            })
          } catch (memErr) {
            console.warn('[onboarding-chat] memory save failed, continuing', memErr)
          }
        }

        // Run the planner.
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
        setPhase('reframing')

        // Speak the reframe, then the next question (if any).
        const utterances: string[] = []
        if (data.decision.reframe_text) utterances.push(data.decision.reframe_text)
        if (data.decision.next_question) utterances.push(data.decision.next_question)

        for (const line of utterances) {
          // eslint-disable-next-line no-await-in-loop
          await speak(line).catch(() => {})
        }

        // Short settle — lets dot bloom finish and user register the reframe.
        await new Promise(r => setTimeout(r, 500))

        if (data.decision.should_stop || !data.decision.next_question) {
          setPhase('completing')
          // Brief pause then hand off to books step.
          await new Promise(r => setTimeout(r, 600))
          setPhase('books')
          return
        }

        // Otherwise: reset for the next turn.
        setCurrentQuestion(data.decision.next_question)
        setCurrentTargetSlot(data.decision.next_slot_target)
        setCurrentReframe('')
        setLatestTranscript('')
        setTypingDraft('')
        setJustFilled([])
        setVoiceKey(k => k + 1)
        setPhase('listening')
      } catch (err: any) {
        console.error('[onboarding-chat] turn failed', err)
        setError('Something went wrong processing your answer. Tap to try again.')
        setPhase('listening')
      } finally {
        inflightRef.current = false
      }
    },
    [grid, currentQuestion, currentTargetSlot, createMemory],
  )

  // ── Voice callbacks ──────────────────────────────────────────────────────
  const handleTranscript = useCallback(
    (text: string) => {
      void submitTurn(text, false)
    },
    [submitTurn],
  )

  const handleSkip = useCallback(() => {
    void submitTurn('', true)
  }, [submitTurn])

  const handleTypedSubmit = useCallback(() => {
    const text = typingDraft.trim()
    if (text.length === 0) {
      void submitTurn('', true)
    } else {
      void submitTurn(text, false)
    }
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

  // Cancel any in-flight TTS when unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

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
            onClick={() => startSession()}
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

  // ── Turn UI (listening / processing / reframing) ────────────────────────
  return (
    <div className="min-h-screen flex flex-col px-4 py-12 relative">
      {/* Top-right: skip button (session-level skip kills the onboarding entirely) */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 right-6 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
      >
        Exit
      </button>

      {/* Centre stage */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full text-center">
          {/* Reframe chip (appears briefly when returned from planner) */}
          <AnimatePresence>
            {phase === 'reframing' && currentReframe && (
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
              {currentQuestion}
            </motion.h2>
          </AnimatePresence>

          {/* Input surface: voice waveform OR typing textarea */}
          {!typingMode ? (
            <div className="mb-6">
              <VoiceInput
                key={voiceKey}
                onTranscript={handleTranscript}
                maxDuration={60}
                autoSubmit
              />
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
                disabled={phase !== 'listening'}
              />
              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  onClick={() => {
                    void submitTurn('', true)
                  }}
                  disabled={phase !== 'listening'}
                  className="hover:opacity-80 disabled:opacity-30"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                >
                  Skip this one
                </button>
                <button
                  onClick={handleTypedSubmit}
                  disabled={phase !== 'listening'}
                  className="btn-primary px-5 py-2 inline-flex items-center gap-1.5 disabled:opacity-40"
                >
                  Send
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Latest transcript (confirmation artefact after turn end) */}
          <AnimatePresence>
            {(phase === 'processing' || phase === 'reframing') && latestTranscript && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                className="text-sm mt-2 italic max-w-md mx-auto"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                “{latestTranscript}”
              </motion.p>
            )}
          </AnimatePresence>

          {/* Typing fallback link (only in voice mode, idle state) */}
          {!typingMode && phase === 'listening' && (
            <button
              onClick={() => setTypingMode(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
            >
              <Type className="h-3 w-3" />
              type instead
            </button>
          )}

          {/* Processing indicator */}
          {phase === 'processing' && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>thinking…</span>
            </div>
          )}

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

      {/* Voice-command skip hint (subtle) */}
      {!typingMode && phase === 'listening' && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}>
          Say "skip" to move on
        </div>
      )}
    </div>
  )
}
