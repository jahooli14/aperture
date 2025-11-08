/**
 * OnboardingPage - 5-question flow to build initial knowledge graph
 * Questions 1-2: Structured (skill learned, abandoned project)
 * Questions 3-5: Freeform voice/text
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { VoiceInput } from '../components/VoiceInput'
import type { OnboardingResponse, OnboardingAnalysis } from '../types'

const QUESTIONS = [
  {
    id: 1,
    text: "What's a skill you learned in the past year?",
    type: 'structured' as const,
    placeholder: "e.g., React, design, photography..."
  },
  {
    id: 2,
    text: "Tell me about something you started but didn't finish",
    type: 'structured' as const,
    placeholder: "What happened? Why did you stop?"
  },
  {
    id: 3,
    text: "What's on your mind lately? Projects, ideas, frustrations - anything",
    type: 'freeform' as const,
    placeholder: "Just talk for 30 seconds..."
  },
  {
    id: 4,
    text: "Anything else you've been mulling over?",
    type: 'freeform' as const,
    placeholder: "Another 30 seconds..."
  },
  {
    id: 5,
    text: "One more thought - whatever comes to mind",
    type: 'freeform' as const,
    placeholder: "Last one..."
  }
]

export function OnboardingPage() {
  const navigate = useNavigate()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [responses, setResponses] = useState<OnboardingResponse[]>([])
  const [currentResponse, setCurrentResponse] = useState('')
  const [analysis, setAnalysis] = useState<OnboardingAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const question = QUESTIONS[currentQuestion]
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100

  const handleNext = async () => {
    if (!currentResponse.trim()) return

    const newResponse: OnboardingResponse = {
      transcript: currentResponse,
      question_number: currentQuestion + 1
    }

    const updatedResponses = [...responses, newResponse]
    setResponses(updatedResponses)
    setCurrentResponse('')

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // All questions answered - analyze
      await analyzeResponses(updatedResponses)
    }
  }

  const analyzeResponses = async (allResponses: OnboardingResponse[]) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/onboarding?resource=analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: allResponses })
      })

      if (!response.ok) throw new Error('Analysis failed')

      const data: OnboardingAnalysis = await response.json()
      setAnalysis(data)
    } catch (error) {
      console.error('Error analyzing responses:', error)
      // For now, show placeholder results
      setAnalysis({
        capabilities: ['React', 'Design'],
        themes: ['Web Development', 'Creative Tools'],
        patterns: ['Abandons at deployment phase'],
        entities: { people: [], places: [], topics: ['coding', 'design'] },
        first_insight: 'You mentioned deployment twice as a challenge. This is a common pattern we can address.',
        graph_preview: {
          nodes: [
            { id: '1', label: 'React', type: 'capability' },
            { id: '2', label: 'Design', type: 'capability' },
            { id: '3', label: 'Web Development', type: 'theme' }
          ],
          edges: [
            { from: '1', to: '3', label: 'used in' },
            { from: '2', to: '3', label: 'applies to' }
          ]
        }
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleVoiceTranscript = (transcript: string) => {
    setCurrentResponse(transcript)
  }

  const handleSkipOnboarding = () => {
    navigate('/')
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-6" style={{ borderColor: 'var(--premium-blue)' }}></div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
            Analyzing your responses...
          </h2>
          <p style={{ color: 'var(--premium-text-secondary)' }}>
            Building your first knowledge graph
          </p>
        </div>
      </div>
    )
  }

  if (analysis) {
    return (
      <div className="min-h-screen py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
              <Check className="h-8 w-8" style={{ color: 'var(--premium-blue)' }} />
            </div>
            <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--premium-text-primary)' }}>
              Your First Patterns
            </h1>
            <p className="text-xl" style={{ color: 'var(--premium-text-secondary)' }}>
              Here's what we found from just 5 thoughts
            </p>
          </div>

          <div className="grid gap-6 mb-8">
            {/* Capabilities */}
            <div className="p-6" style={{ background: 'var(--premium-bg-2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--premium-radius-lg)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
                ✅ {analysis.capabilities.length} capabilities detected
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.capabilities.map((cap, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--premium-blue)' }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Themes */}
            <div className="p-6" style={{ background: 'var(--premium-bg-2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--premium-radius-lg)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
                ✅ {analysis.themes.length} themes emerging
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.themes.map((theme, i) => (
                  <span key={i} className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--premium-blue)' }}>
                    {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* Patterns */}
            {analysis.patterns.length > 0 && (
              <div className="p-6" style={{ background: 'var(--premium-bg-2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--premium-radius-lg)' }}>
                <h3 className="font-semibold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
                  ✅ {analysis.patterns.length} pattern found
                </h3>
                <ul className="space-y-2">
                  {analysis.patterns.map((pattern, i) => (
                    <li key={i} className="flex items-start gap-2" style={{ color: 'var(--premium-text-secondary)' }}>
                      <span className="mt-1" style={{ color: 'var(--premium-blue)' }}>→</span>
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* First Insight */}
            <div className="p-6" style={{ background: 'var(--premium-bg-3)', backdropFilter: 'blur(12px)', borderRadius: 'var(--premium-radius-lg)' }}>
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 flex-shrink-0 mt-1" style={{ color: 'var(--premium-blue)' }} />
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: 'var(--premium-text-primary)' }}>
                    💡 First Insight
                  </h3>
                  <p style={{ color: 'var(--premium-text-secondary)' }}>
                    {analysis.first_insight}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Graph Visualization Placeholder */}
          <div className="p-6 mb-8" style={{ background: 'var(--premium-bg-2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--premium-radius-lg)' }}>
            <h3 className="font-semibold mb-4 text-center" style={{ color: 'var(--premium-text-primary)' }}>
              Your Knowledge Graph
            </h3>
            <div className="flex items-center justify-center gap-8 py-8">
              {analysis.graph_preview.nodes.map((node, i) => (
                <div key={node.id} className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center text-sm font-medium text-center p-2"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)', color: 'var(--premium-blue)' }}>
                    {node.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm mt-4" style={{ color: 'var(--premium-text-tertiary)' }}>
              This is just the beginning. Imagine after 50 captures...
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={() => navigate('/')}
              className="btn-primary px-8 py-4 text-lg inline-flex items-center gap-2"
            >
              Start Capturing Thoughts
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="text-sm mt-4" style={{ color: 'var(--premium-text-tertiary)' }}>
              Your knowledge graph will grow with every voice note
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: 'var(--premium-blue)' }}
        />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3" style={{ color: 'var(--premium-text-primary)' }}>
              Let's map your creative brain
            </h1>
            <p className="text-xl" style={{ color: 'var(--premium-text-secondary)' }}>
              Question {currentQuestion + 1} of {QUESTIONS.length}
            </p>
            <button
              onClick={handleSkipOnboarding}
              className="text-sm mt-4 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--premium-text-tertiary)' }}
            >
              Skip onboarding →
            </button>
          </div>

          {/* Question Card */}
          <div className="p-8 mb-6" style={{ background: 'var(--premium-bg-2)', backdropFilter: 'blur(12px)', borderRadius: 'var(--premium-radius-lg)' }}>
            <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--premium-text-primary)' }}>
              {question.text}
            </h2>

            <div className="space-y-4">
              <textarea
                value={currentResponse}
                onChange={(e) => setCurrentResponse(e.target.value)}
                placeholder={question.placeholder}
                className="w-full px-4 py-3 rounded-lg focus:ring-2 resize-none"
                style={{
                  backgroundColor: 'var(--premium-surface-elevated)',
                  color: 'var(--premium-text-primary)',
                  borderWidth: '0',
                  outlineColor: 'var(--premium-blue)'
                }}
                rows={question.type === 'freeform' ? 6 : 3}
                autoFocus
              />

              {question.type === 'freeform' && (
                <VoiceInput
                  onTranscript={handleVoiceTranscript}
                  maxDuration={30}
                  autoSubmit={false}
                />
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <div className="text-sm">
              {currentQuestion > 0 && (
                <button
                  onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  className="hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--premium-text-secondary)' }}
                >
                  ← Back
                </button>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={!currentResponse.trim()}
              className="btn-primary px-6 py-3 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentQuestion === QUESTIONS.length - 1 ? 'Analyze' : 'Next'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Completed Questions */}
          {responses.length > 0 && (
            <div className="mt-8 pt-8" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--premium-text-secondary)' }}>
                Your responses so far:
              </h3>
              <div className="space-y-2">
                {responses.map((response, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--premium-blue)' }} />
                    <span className="line-clamp-1" style={{ color: 'var(--premium-text-secondary)' }}>
                      {QUESTIONS[i]?.text || 'Question'}: {response?.transcript?.substring(0, 60) || ''}...
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
