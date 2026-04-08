/**
 * OnboardingPage — Voice-first mind mapping + bookshelf + reveal
 *
 * Flow: Pillar intro → 5 voice questions → Bookshelf step → Analysis reveal
 *
 * Each phase teaches a pillar of the app:
 *   1. Voice capture (thoughts)
 *   2. List curation (books)
 *   3. Project creation (spark from suggestions)
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, RotateCcw, Mic } from 'lucide-react'
import { VoiceInput } from '../components/VoiceInput'
import { useMemoryStore } from '../stores/useMemoryStore'
import { BookshelfStep } from '../components/onboarding/BookshelfStep'
import { RevealSequence } from '../components/onboarding/RevealSequence'
import type { OnboardingAnalysis, BookSearchResult } from '../types'

const PROMPTS = [
  "What's been on your mind lately — something you're in the middle of?",
  "What's something you made or figured out recently that felt good?",
  "Pick a topic you're genuinely curious about and just talk about it.",
  "What's something you're good at that most people wouldn't guess?",
  "What's an idea you keep coming back to — something you'd love to build or try?",
]

type Phase = 'voice-intro' | 'prompts' | 'captured' | 'book-intro' | 'books' | 'analyzing' | 'reveal'

// Extract 2-3 "interesting" words from a transcript for the keyword animation
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'it', 'its', 'my', 'me', 'we', 'our', 'you', 'your',
    'he', 'she', 'they', 'them', 'their', 'this', 'that', 'these', 'those',
    'i', 'so', 'if', 'not', 'no', 'just', 'like', 'about', 'been', 'really',
    'thing', 'things', 'kind', 'lot', 'much', 'very', 'also', 'get', 'got',
    'know', 'think', 'something', 'actually', 'basically', 'going', 'there',
    'here', 'what', 'when', 'where', 'which', 'who', 'how', 'than', 'then',
    'some', 'more', 'into', 'from', 'up', 'out', 'all', 'one', 'two',
  ])

  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
  const freq = new Map<string, number>()
  for (const w of words) {
    if (w.length > 3 && !stopWords.has(w)) {
      freq.set(w, (freq.get(w) || 0) + 1)
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word)
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { createMemory } = useMemoryStore()

  const [stepIndex, setStepIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [voiceKey, setVoiceKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<Phase>('voice-intro')
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)
  const [transcripts, setTranscripts] = useState<string[]>([])
  const [books, setBooks] = useState<BookSearchResult[]>([])
  const [floatingWords, setFloatingWords] = useState<string[]>([])
  const [showCaptured, setShowCaptured] = useState(false)

  const isLast = stepIndex === PROMPTS.length - 1

  // ── Voice intro auto-advance ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'voice-intro') return
    const timer = setTimeout(() => setPhase('prompts'), 2800)
    return () => clearTimeout(timer)
  }, [phase])

  // ── Book intro auto-advance ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'book-intro') return
    const timer = setTimeout(() => setPhase('books'), 2800)
    return () => clearTimeout(timer)
  }, [phase])

  // ── Captured animation auto-advance ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'captured') return
    const timer = setTimeout(() => {
      setFloatingWords([])
      setShowCaptured(false)
      if (isLast) {
        // Voice done → go to book intro
        setPhase('book-intro')
      } else {
        setStepIndex(prev => prev + 1)
        setCurrentTranscript('')
        setVoiceKey(k => k + 1)
        setSaving(false)
        setPhase('prompts')
      }
    }, 2200)
    return () => clearTimeout(timer)
  }, [phase, isLast])

  const handleTranscript = (text: string) => {
    setCurrentTranscript(text)
  }

  const handleReRecord = () => {
    setCurrentTranscript('')
    setVoiceKey(k => k + 1)
  }

  const handleSave = async () => {
    if (!currentTranscript.trim() || saving) return
    setSaving(true)

    const updatedTranscripts = [...transcripts, currentTranscript]
    setTranscripts(updatedTranscripts)

    // Extract keywords for the floating animation
    const keywords = extractKeywords(currentTranscript)
    setFloatingWords(keywords)
    setShowCaptured(true)

    // Save as a real memory
    try {
      await createMemory({
        body: currentTranscript,
        memory_type: 'foundational',
      })
    } catch (e) {
      console.warn('[Onboarding] Failed to save memory, continuing', e)
    }

    setCompletedCount(prev => prev + 1)
    setPhase('captured')
  }

  const handleBooksComplete = (selectedBooks: BookSearchResult[]) => {
    setBooks(selectedBooks)
    setPhase('analyzing')
    analyzeResponses(transcripts, selectedBooks)
  }

  const handleBooksSkip = () => {
    setPhase('analyzing')
    analyzeResponses(transcripts, [])
  }

  const analyzeResponses = async (allTranscripts: string[], selectedBooks: BookSearchResult[]) => {
    try {
      const res = await fetch('/api/utilities?resource=analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: allTranscripts.map((t, i) => ({
            transcript: t,
            question_number: i + 1,
          })),
          books: selectedBooks.map(b => ({ title: b.title, author: b.author })),
        }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data: OnboardingAnalysis = await res.json()
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
  }

  // ── Voice Intro ─────────────────────────────────────────────────────
  if (phase === 'voice-intro') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(var(--brand-primary-rgb),0.12)' }}
          >
            <Mic className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl font-semibold mb-3"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            Think out loud.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-sm"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
          >
            Five questions. No right answers.
          </motion.p>
        </motion.div>
      </div>
    )
  }

  // ── Book Intro ──────────────────────────────────────────────────────
  if (phase === 'book-intro') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-center max-w-md"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'linear-gradient(135deg, rgba(var(--brand-primary-rgb),0.08), rgba(245,158,11,0.12))' }}
          >
            <svg
              className="h-7 w-7"
              style={{ color: 'var(--brand-primary)' }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl font-semibold mb-3"
            style={{ color: 'var(--brand-text-primary)' }}
          >
            Now, your bookshelf.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-sm"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}
          >
            Books, films, music — the more you add, the better Polymath understands how you think.
          </motion.p>
        </motion.div>
      </div>
    )
  }

  // ── Bookshelf step ──────────────────────────────────────────────────
  if (phase === 'books') {
    return (
      <BookshelfStep
        onComplete={handleBooksComplete}
        onSkip={handleBooksSkip}
      />
    )
  }

  // ── Analyzing + Reveal ──────────────────────────────────────────────
  if (phase === 'analyzing' || phase === 'reveal') {
    if (phase === 'reveal' && analysis) {
      return <RevealSequence analysis={analysis} books={books} transcripts={transcripts} />
    }

    // Still analyzing — RevealSequence handles its own loading state,
    // but we show a simple loader while the API call is in flight
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
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

  // ── Prompt screens (steps 1–5) with captured animation ─────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Skip */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 right-6 text-xs transition-opacity hover:opacity-80"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}
      >
        Skip
      </button>

      {/* Dot progress */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
        {PROMPTS.map((_, i) => (
          <motion.span
            key={i}
            className="block rounded-full"
            animate={{
              width: i === stepIndex ? 20 : 6,
              height: 6,
              opacity: i < completedCount ? 1 : i === stepIndex ? 0.9 : 0.25,
              background: i < completedCount ? 'var(--brand-primary)' : i === stepIndex ? 'var(--brand-text-primary)' : 'var(--brand-text-secondary)',
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* "Captured" micro-animation between questions */}
        {showCaptured && phase === 'captured' ? (
          <motion.div
            key="captured"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="text-center"
          >
            {/* Floating keywords — drift upward and fade */}
            <div className="flex justify-center gap-4">
              {floatingWords.map((word, i) => {
                const colors = [
                  'var(--brand-primary)',
                  'rgba(245,158,11,0.8)',
                  'rgba(var(--brand-primary-rgb),0.7)',
                ]
                return (
                  <motion.span
                    key={word}
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: [0, 0.9, 0.3], y: -60 }}
                    transition={{ duration: 1.8, delay: i * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-base font-medium"
                    style={{ color: colors[i] || colors[0] }}
                  >
                    {word}
                  </motion.span>
                )
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="max-w-xl w-full text-center"
          >
            {/* Question */}
            <h2
              className="text-2xl sm:text-3xl font-semibold leading-snug mb-10"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              {PROMPTS[stepIndex]}
            </h2>

            {/* Voice input */}
            <div className="mb-6">
              <VoiceInput
                key={voiceKey}
                onTranscript={handleTranscript}
                maxDuration={30}
                autoSubmit={false}
              />
            </div>

            {/* Transcript preview */}
            <AnimatePresence>
              {currentTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6 p-4 rounded-xl text-left"
                  style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                >
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-text-primary)' }}>
                    {currentTranscript}
                  </p>
                  <button
                    onClick={handleReRecord}
                    className="mt-3 flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Try again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Save & continue */}
            <button
              onClick={handleSave}
              disabled={!currentTranscript.trim() || saving}
              className="btn-primary px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : isLast ? "That's all five" : 'Next'}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
