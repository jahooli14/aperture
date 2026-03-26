/**
 * RevealSequence — The "so what" moment after onboarding
 *
 * Three beats that animate in sequence:
 *   1. Loading with rotating messages
 *   2. Your Mind, Mapped — themes, capabilities, books, first insight
 *   3. 3 Ideas For You — project suggestions with Spark → brainstorm
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, ArrowRight, Book, Lock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CreateProjectDialog } from '../projects/CreateProjectDialog'
import { useAuthContext } from '../../contexts/AuthContext'
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

export function RevealSequence({ analysis, books }: RevealSequenceProps) {
  const { isAuthenticated } = useAuthContext()
  const navigate = useNavigate()
  const [beat, setBeat] = useState<'loading' | 'profile' | 'ideas'>('loading')
  const [loadingMessage, setLoadingMessage] = useState(0)
  const [sparkSuggestion, setSparkSuggestion] = useState<{ title: string; description: string; reasoning: string } | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Rotate loading messages
  useEffect(() => {
    if (beat !== 'loading') return
    const interval = setInterval(() => {
      setLoadingMessage(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [beat])

  // Auto-advance from loading → profile after minimum delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setBeat('profile')
    }, 3500)
    return () => clearTimeout(timer)
  }, [])

  // User manually advances from profile → ideas via button

  const handleSpark = (suggestion: { title: string; description: string; reasoning: string }) => {
    setSparkSuggestion(suggestion)
    setShowCreateDialog(true)
  }

  // Build the seed conversation for CreateProjectDialog
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

      {/* ── Beat 2: Your Mind, Mapped ────────────────────────────────── */}
      <AnimatePresence>
        {(beat === 'profile' || beat === 'ideas') && (
          <motion.div
            ref={profileRef}
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
              {/* The Insight — centerpiece, shown first */}
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
                  <p
                    className="text-xs font-medium mb-3 uppercase tracking-widest"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                  >
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
                        style={{
                          background: `linear-gradient(135deg, rgba(99,179,237,0.15), rgba(99,179,237,0.08))`,
                          color: 'var(--brand-primary)',
                          border: '1px solid rgba(99,179,237,0.2)',
                        }}
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
                  <p
                    className="text-xs font-medium mb-3 uppercase tracking-widest"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                  >
                    Your shelf
                  </p>
                  <div className="flex gap-3">
                    {books.map((book, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.2 + i * 0.15 }}
                        className="flex items-center gap-2"
                      >
                        {book.thumbnail ? (
                          <img
                            src={book.thumbnail}
                            alt=""
                            className="w-8 h-12 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div
                            className="w-8 h-12 rounded flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(99,179,237,0.12)' }}
                          >
                            <Book className="h-4 w-4" style={{ color: 'var(--brand-primary)', opacity: 0.5 }} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-tight line-clamp-2" style={{ color: 'var(--brand-text-primary)' }}>
                            {book.title}
                          </p>
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
                  <p
                    className="text-xs font-medium mb-3 uppercase tracking-widest"
                    style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                  >
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
                        style={{
                          background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.08))',
                          color: 'var(--brand-text-primary)',
                          border: '1px solid rgba(245,158,11,0.2)',
                          opacity: 0.9,
                        }}
                      >
                        {cap}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Manual continue to ideas */}
            {beat === 'profile' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="text-center"
              >
                <button
                  onClick={() => setBeat('ideas')}
                  className="btn-primary px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2"
                >
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
        {beat === 'ideas' && analysis.project_suggestions && analysis.project_suggestions.length > 0 && (
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

            {/* Suggestion Cards — horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
              {analysis.project_suggestions.map((suggestion, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.2 }}
                  className="flex-shrink-0 w-[280px] snap-center rounded-xl p-5 flex flex-col"
                  style={{
                    background: 'var(--brand-glass-bg)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <h3
                    className="text-base font-semibold mb-2"
                    style={{ color: 'var(--brand-text-primary)' }}
                  >
                    {suggestion.title}
                  </h3>
                  <p
                    className="text-sm mb-3 leading-relaxed"
                    style={{ color: 'var(--brand-text-secondary)' }}
                  >
                    {suggestion.description}
                  </p>

                  {/* Why you? */}
                  <div
                    className="p-3 rounded-lg mb-4 flex-1"
                    style={{ background: 'rgba(99,179,237,0.06)' }}
                  >
                    <p
                      className="text-xs font-medium mb-1 uppercase tracking-wider"
                      style={{ color: 'var(--brand-primary)', opacity: 0.7 }}
                    >
                      Why you?
                    </p>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--brand-text-secondary)', opacity: 0.8 }}
                    >
                      {suggestion.reasoning}
                    </p>
                  </div>

                  <button
                    onClick={() => handleSpark(suggestion)}
                    className="w-full py-2.5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all hover:brightness-110"
                    style={{
                      background: 'var(--brand-primary)',
                      color: '#fff',
                    }}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Spark this idea
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Sign in to save / explore */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.3 }}
              className="text-center mt-6 flex flex-col items-center gap-3"
            >
              {!isAuthenticated && (
                <button
                  onClick={() => navigate('/login')}
                  className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)',
                    color: '#fff',
                  }}
                >
                  <Lock className="h-3.5 w-3.5" />
                  sign in to save your project
                </button>
              )}
              <button
                onClick={() => navigate('/')}
                className="text-sm transition-opacity hover:opacity-80 inline-flex items-center gap-1.5"
                style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
              >
                {isAuthenticated ? "I'll find my own" : 'skip for now'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fallback: no suggestions */}
      <AnimatePresence>
        {beat === 'ideas' && (!analysis.project_suggestions || analysis.project_suggestions.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-6 flex flex-col items-center gap-3"
          >
            {!isAuthenticated && (
              <button
                onClick={() => navigate('/login')}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, var(--brand-primary), #818cf8)',
                  color: '#fff',
                }}
              >
                <Lock className="h-3.5 w-3.5" />
                sign in to unlock
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="btn-primary px-8 py-3.5 text-base font-semibold inline-flex items-center gap-2"
            >
              {isAuthenticated ? 'Start exploring' : 'skip for now'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CreateProjectDialog with seed conversation */}
      <CreateProjectDialog
        isOpen={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        hideTrigger
        seedConversation={seedConversation}
        onCreated={() => navigate(isAuthenticated ? '/' : '/login')}
      />
    </div>
  )
}
