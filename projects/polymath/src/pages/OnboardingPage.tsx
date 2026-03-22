/**
 * OnboardingPage — Voice-first mind mapping
 *
 * 5 curated prompts, 30s voice each. Responses saved as real memories
 * so the brainstorm API has context when the user creates their first project.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Lightbulb, RotateCcw } from 'lucide-react'
import { VoiceInput } from '../components/VoiceInput'
import { useMemoryStore } from '../stores/useMemoryStore'
import { CreateProjectDialog } from '../components/projects/CreateProjectDialog'
import type { OnboardingAnalysis } from '../types'

const PROMPTS = [
  "What's been keeping your brain busy lately? Tell me about something you're actually in the middle of.",
  "What's something you made or figured out recently that felt satisfying — doesn't matter how big or small.",
  "What topic have you fallen down a rabbit hole on recently — something you keep reading or thinking about?",
  "What's something you can do well that tends to surprise people who mainly know you through work?",
  "What's an idea you keep coming back to — something you'd actually build if you had the time and the right people?",
]

type Phase = 'prompts' | 'analyzing' | 'done'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { createMemory } = useMemoryStore()

  const [stepIndex, setStepIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [voiceKey, setVoiceKey] = useState(0) // used to reset VoiceInput
  const [saving, setSaving] = useState(false)
  const [phase, setPhase] = useState<Phase>('prompts')
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [transcripts, setTranscripts] = useState<string[]>([])

  const isLast = stepIndex === PROMPTS.length - 1

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

    // Save as a real memory so the brainstorm API can find it
    try {
      await createMemory({
        body: currentTranscript,
        memory_type: 'foundational',
      })
    } catch (e) {
      console.warn('[Onboarding] Failed to save memory, continuing', e)
    }

    setCompletedCount(prev => prev + 1)

    if (!isLast) {
      setStepIndex(prev => prev + 1)
      setCurrentTranscript('')
      setVoiceKey(k => k + 1)
      setSaving(false)
    } else {
      // All done — analyse
      setPhase('analyzing')
      setSaving(false)
      await analyzeResponses(updatedTranscripts)
    }
  }

  const analyzeResponses = async (allTranscripts: string[]) => {
    try {
      const res = await fetch('/api/onboarding?resource=analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses: allTranscripts.map((t, i) => ({
            transcript: t,
            question_number: i + 1,
          })),
        }),
      })
      if (!res.ok) throw new Error('Analysis failed')
      const data: OnboardingAnalysis = await res.json()
      setAnalysis(data)
    } catch {
      // Show a minimal fallback so the user isn't stuck
      setAnalysis({
        capabilities: [],
        themes: [],
        patterns: [],
        entities: { people: [], places: [], topics: [], skills: [] },
        first_insight: 'Your thoughts are saved. Add your first project to see how they connect.',
        graph_preview: { nodes: [], edges: [] },
      })
    } finally {
      setPhase('done')
    }
  }

  // ── Analysis / done screen ───────────────────────────────────────
  if (phase === 'analyzing' || phase === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <AnimatePresence mode="wait">
          {phase === 'analyzing' ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                Building your mind map…
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="max-w-xl w-full"
            >
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--brand-text-primary)' }}>
                  Your mind, mapped.
                </h1>
                <p className="text-sm" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
                  From {PROMPTS.length} thoughts
                </p>
              </div>

              <div className="space-y-4 mb-8">
                {/* Themes */}
                {analysis && analysis.themes.length > 0 && (
                  <div
                    className="p-5 rounded-xl"
                    style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                  >
                    <p className="text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                      Themes emerging
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.themes.map((theme, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{ background: 'rgba(99,179,237,0.12)', color: 'var(--brand-primary)' }}
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Capabilities */}
                {analysis && analysis.capabilities.length > 0 && (
                  <div
                    className="p-5 rounded-xl"
                    style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                  >
                    <p className="text-xs font-medium mb-3 uppercase tracking-widest" style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}>
                      Skills & capabilities
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {analysis.capabilities.map((cap, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full text-sm"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--brand-text-primary)', opacity: 0.85 }}
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* First insight */}
                {analysis?.first_insight && (
                  <div
                    className="p-5 rounded-xl flex gap-3"
                    style={{ background: 'var(--brand-glass-bg)', backdropFilter: 'blur(12px)' }}
                  >
                    <Lightbulb className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--brand-primary)' }} />
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--brand-text-secondary)' }}>
                      {analysis.first_insight}
                    </p>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => setShowCreateProject(true)}
                  className="btn-primary w-full py-3.5 text-base font-semibold inline-flex items-center justify-center gap-2"
                >
                  Add your first project
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-3 text-sm transition-opacity hover:opacity-80"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.5 }}
                >
                  Start exploring →
                </button>
              </div>

              {/* Inline project dialog */}
              <CreateProjectDialog
                isOpen={showCreateProject}
                onOpenChange={setShowCreateProject}
                hideTrigger
                onCreated={() => navigate('/')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Prompt screens (steps 1–5) ───────────────────────────────────
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
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3 }}
          className="max-w-xl w-full text-center"
        >
          {/* Question */}
          <p
            className="text-xs font-medium mb-6 uppercase tracking-widest"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
          >
            Thought {stepIndex + 1} of {PROMPTS.length}
          </p>
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
                <p className="text-sm leading-relaxed italic" style={{ color: 'var(--brand-text-secondary)' }}>
                  "{currentTranscript}"
                </p>
                <button
                  onClick={handleReRecord}
                  className="mt-3 flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                  style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
                >
                  <RotateCcw className="h-3 w-3" />
                  Re-record
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
            {saving ? 'Saving…' : isLast ? 'Finish' : 'Save & continue'}
            {!saving && <ArrowRight className="h-4 w-4" />}
          </button>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
