/**
 * RevealSequence — The "so what" moment after onboarding
 *
 * Three beats:
 *   1. Loading with rotating messages
 *   2. Here's what we noticed — themes, capabilities, "What only you can do"
 *   3. What if you built... — project suggestions with refinement loop
 *
 * Refinement loop:
 *   - "Not quite right" button lets user give voice feedback
 *   - AI reshapes the suggestion (up to 3 rounds)
 *   - On accept or after 3 rounds: save to saved ideas, navigate home
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, ArrowRight, Book, Lock, RotateCcw, Mic, CheckCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PostOnboardingFlow } from './PostOnboardingFlow'
import { useAuthContext } from '../../contexts/AuthContext'
import { VoiceInput } from '../VoiceInput'
import type { OnboardingAnalysis, BookSearchResult } from '../../types'

interface RevealSequenceProps {
  analysis: OnboardingAnalysis
  books: BookSearchResult[]
}

const LOADING_MESSAGES = [
  'Reading between the lines…',
  'Connecting the dots…',
  'Finding patterns you haven\'t noticed…',
  'Cross-referencing your bookshelf…',
  'Pulling it all together…',
]

const REFINEMENT_MESSAGES = [
  null, // after 1st attempt
  'No worries — I\'m still learning what makes you tick.\nThe more you share, the better I get at finding what only you can build.',
  'Let\'s save this and come back to it.\nAs you add more thoughts and ideas, I\'ll reshape this into something perfect for you.\nThat\'s the magic — ideas evolve here.',
]

interface Suggestion {
  title: string
  description: string
  reasoning: string
}

export function RevealSequence({ analysis, books }: RevealSequenceProps) {
  const { isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const [beat, setBeat] = useState<'loading' | 'profile' | 'ideas' | 'refining' | 'saved' | 'post-onboarding'>('loading')
  const [loadingMessage, setLoadingMessage] = useState(0)
  const [sparkSuggestion, setSparkSuggestion] = useState<Suggestion | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [refinementCount, setRefinementCount] = useState(0)
  const [refinementFeedback, setRefinementFeedback] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [currentSuggestions, setCurrentSuggestions] = useState<Suggestion[]>(analysis.project_suggestions || [])

  // Rotate loading messages
  useEffect(() => {
    if (beat !== 'loading') return
    const interval = setInterval(() => {
      setLoadingMessage(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [beat])

  // Auto-advance from loading → profile
  useEffect(() => {
    const timer = setTimeout(() => setBeat('profile'), 3500)
    return () => clearTimeout(timer)
  }, [])

  const handleSpark = (suggestion: Suggestion) => {
    setSparkSuggestion(suggestion)
    setSelectedSuggestion(suggestion)
    if (isAuthenticated) {
      setBeat('post-onboarding')
    } else {
      // Save to saved ideas and go home
      saveIdeaAndNavigate(suggestion)
    }
  }

  const handleNotQuiteRight = (suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion)
    setBeat('refining')
  }

  const handleRefinementSubmit = async () => {
    if (!selectedSuggestion || !refinementFeedback.trim() || isRefining) return
    setIsRefining(true)

    const nextCount = refinementCount + 1

    try {
      const res = await fetch('/api/utilities?resource=refine-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: selectedSuggestion,
          feedback: refinementFeedback,
          attempt: nextCount,
          context: {
            themes: analysis.themes,
            capabilities: analysis.capabilities,
          }
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (data.suggestion) {
          // Replace the tapped suggestion in the list
          setCurrentSuggestions(prev =>
            prev.map(s => s.title === selectedSuggestion.title ? data.suggestion : s)
          )
          setSelectedSuggestion(data.suggestion)
        }
      }
    } catch {}

    setRefinementCount(nextCount)
    setRefinementFeedback('')
    setIsRefining(false)

    if (nextCount >= 3) {
      // Max attempts — save latest and move on
      await saveIdeaAndNavigate(selectedSuggestion)
    } else {
      setBeat('ideas')
    }
  }

  const saveIdeaAndNavigate = async (suggestion: Suggestion) => {
    // Save the suggestion as a saved idea in the DB
    try {
      await fetch('/api/projects?resource=save-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          reasoning: suggestion.reasoning,
          source: 'onboarding',
        })
      })
    } catch {}
    setBeat('saved')
    setTimeout(() => navigate('/'), 2500)
  }

  const seedConversation = sparkSuggestion ? [
    {
      role: 'model' as const,
      content: `**${sparkSuggestion.title}** — ${sparkSuggestion.reasoning}\n\n${sparkSuggestion.description}\n\nWhat's the version of this that only you could make?`,
    },
  ] : undefined

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12">
      <AnimatePresence mode="wait">
        {/* ── Beat 1: Loading ──────────────────────────────────────────── */}
        {beat === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
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
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingMessage}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="text-base"
                style={{ color: 'var(--brand-text-secondary)' }}
              >
                {LOADING_MESSAGES[loadingMessage]}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Beat 2: Here's what we noticed ──────────────────────────── */}
      <AnimatePresence>
        {(beat === 'profile' || beat === 'ideas') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl w-full"
          >
            <div className="text-center mb-10">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold"
                style={{ color: 'var(--brand-text-primary)' }}
              >
                Here's what we noticed.
              </motion.h1>
            </div>

            <div className="space-y-4 mb-8">
              {/* The Insight */}
              {analysis.first_insight && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="p-6 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99,179,237,0.08), rgba(168,85,247,0.08))',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(99,179,237,0.15)',
                  }}
                >
                  <p className="text-base leading-relaxed" style={{ color: 'var(--brand-text-primary)' }}>
                    {analysis.first_insight}
                  </p>
                </motion.div>
              )}

              {/* Themes */}
              {analysis.themes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="p-5 rounded-xl"
                  style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                >
                  <p className="text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                    What keeps coming up
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.themes.map((theme, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.9 + i * 0.12 }}
                        className="px-3 py-1.5 rounded-full text-sm font-medium"
                        style={{ background: 'linear-gradient(135deg, rgba(99,179,237,0.15), rgba(99,179,237,0.08))', color: 'var(--brand-primary)', border: '1px solid rgba(99,179,237,0.2)' }}
                      >
                        {theme}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Books mini-shelf */}
              {books.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 }}
                  className="p-5 rounded-xl"
                  style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                >
                  <p className="text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                    Your shelf
                  </p>
                  <div className="flex gap-3">
                    {books.map((book, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 + i * 0.15 }} className="flex items-center gap-2">
                        {book.thumbnail ? (
                          <img src={book.thumbnail} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-12 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,179,237,0.12)' }}>
                            <Book className="h-4 w-4" style={{ color: 'var(--brand-primary)', opacity: 0.5 }} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-tight line-clamp-2" style={{ color: 'var(--brand-text-primary)' }}>{book.title}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Capabilities */}
              {analysis.capabilities.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                  className="p-5 rounded-xl"
                  style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                >
                  <p className="text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                    What you bring
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysis.capabilities.map((cap, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 1.5 + i * 0.12 }}
                        className="px-3 py-1.5 rounded-full text-sm"
                        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))', color: 'var(--brand-text-primary)', border: '1px solid rgba(245,158,11,0.2)', opacity: 0.9 }}
                      >
                        {cap}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {beat === 'profile' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="text-center">
                <button onClick={() => setBeat('ideas')} className="btn-primary px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2">
                  What could you build?
                  <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Beat 3: Ideas For You ─────────────────────────────────────── */}
      <AnimatePresence>
        {beat === 'ideas' && currentSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="max-w-xl w-full mt-4"
          >
            <motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-xl font-bold mb-5 text-center"
              style={{ color: 'var(--brand-text-primary)' }}
            >
              What if you built...
            </motion.h2>

            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {currentSuggestions.map((suggestion, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.2 }}
                  className="flex-shrink-0 w-[280px] snap-center rounded-xl p-5 flex flex-col"
                  style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--brand-text-primary)' }}>{suggestion.title}</h3>
                  <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>{suggestion.description}</p>

                  <div className="p-3 rounded-lg mb-4 flex-1" style={{ background: 'rgba(99,179,237,0.06)' }}>
                    <p className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--brand-primary)', opacity: 0.7 }}>Why you?</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--brand-text-secondary)', opacity: 0.8 }}>{suggestion.reasoning}</p>
                  </div>

                  <button
                    onClick={() => handleSpark(suggestion)}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110 mb-2"
                    style={{ background: 'var(--brand-primary)', color: '#fff' }}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Build this
                  </button>

                  <button
                    onClick={() => handleNotQuiteRight(suggestion)}
                    className="w-full py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                  >
                    Not quite right
                  </button>
                </motion.div>
              ))}
            </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="text-center mt-6 flex flex-col items-center gap-3">
              {!isAuthenticated && (
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)', color: '#fff' }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  Sign in to save your idea
                </button>
              )}
              <button
                onClick={() => { if (isAuthenticated) setBeat('post-onboarding'); else navigate('/') }}
                className="text-sm transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
              >
                {isAuthenticated ? "I'll find my own" : 'Skip for now'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fallback: no suggestions */}
      <AnimatePresence>
        {beat === 'ideas' && currentSuggestions.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-center mt-6 flex flex-col items-center gap-3">
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)', color: '#fff' }}
              >
                <Lock className="h-3.5 w-3.5" />
                Sign in to unlock
              </button>
            )}
            <button
              onClick={() => { if (isAuthenticated) setBeat('post-onboarding'); else navigate('/') }}
              className="btn-primary px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2"
            >
              {isAuthenticated ? 'Start exploring' : 'Skip for now'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Refinement Loop ───────────────────────────────────────────── */}
      <AnimatePresence>
        {beat === 'refining' && selectedSuggestion && (
          <motion.div
            key="refining"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-xl w-full mt-4"
          >
            {/* Context message after 1st attempt */}
            {refinementCount > 0 && REFINEMENT_MESSAGES[refinementCount] && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-xl mb-6 text-sm leading-relaxed whitespace-pre-line"
                style={{ background: 'rgba(99,179,237,0.06)', border: '1px solid rgba(99,179,237,0.12)', color: 'var(--brand-text-secondary)' }}
              >
                {REFINEMENT_MESSAGES[refinementCount]}
              </motion.div>
            )}

            <div className="p-5 rounded-xl mb-6" style={{ background: 'var(--brand-glass-bg)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--brand-text-primary)' }}>{selectedSuggestion.title}</h3>
              <p className="text-sm" style={{ color: 'var(--brand-text-secondary)' }}>{selectedSuggestion.description}</p>
            </div>

            <h3 className="text-lg font-semibold mb-4 text-center" style={{ color: 'var(--brand-text-primary)' }}>
              What would make this better for you?
            </h3>

            <VoiceInput
              onTranscript={setRefinementFeedback}
              maxDuration={30}
              autoSubmit={false}
            />

            {refinementFeedback && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-xl" style={{ background: 'var(--brand-glass-bg)' }}>
                <p className="text-sm" style={{ color: 'var(--brand-text-primary)' }}>{refinementFeedback}</p>
                <button
                  onClick={() => setRefinementFeedback('')}
                  className="mt-2 flex items-center gap-1.5 text-xs opacity-40 hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--brand-text-secondary)' }}
                >
                  <RotateCcw className="h-3 w-3" />
                  Try again
                </button>
              </motion.div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setBeat('ideas')}
                className="flex-1 py-3 rounded-xl font-medium text-sm transition-all hover:opacity-80"
                style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--brand-text-secondary)' }}
              >
                Go back
              </button>
              <button
                onClick={handleRefinementSubmit}
                disabled={!refinementFeedback.trim() || isRefining}
                className="flex-2 flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:brightness-110"
                style={{ background: 'var(--brand-primary)', color: '#fff' }}
              >
                {isRefining ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <RotateCcw className="h-3.5 w-3.5" />
                    </motion.div>
                    Reshaping…
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    Reshape this idea
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved confirmation ────────────────────────────────────────── */}
      <AnimatePresence>
        {beat === 'saved' && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center mt-20"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: 'rgba(99,179,237,0.12)' }}
            >
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--brand-primary)' }} />
            </motion.div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text-primary)' }}>Saved to your ideas</h2>
            <p className="text-sm" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>As you add more thoughts, I'll reshape this into something perfect for you.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Post-Onboarding Flow ──────────────────────────────────────── */}
      {beat === 'post-onboarding' && (
        <PostOnboardingFlow
          analysis={analysis}
          sparkedSuggestion={sparkSuggestion}
        />
      )}
    </div>
  )
}
