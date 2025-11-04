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
    navigate('/today')
  }

  if (isAnalyzing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-900 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">
            Analyzing your responses...
          </h2>
          <p className="text-neutral-600">
            Building your first knowledge graph
          </p>
        </div>
      </div>
    )
  }

  if (analysis) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-6">
              <Check className="h-8 w-8 text-blue-900" />
            </div>
            <h1 className="text-4xl font-bold text-neutral-900 mb-4">
              Your First Patterns
            </h1>
            <p className="text-xl text-neutral-600">
              Here's what we found from just 5 thoughts
            </p>
          </div>

          <div className="grid gap-6 mb-8">
            {/* Capabilities */}
            <div className="pro-card p-6">
              <h3 className="font-semibold text-neutral-900 mb-3">
                ✅ {analysis.capabilities.length} capabilities detected
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.capabilities.map((cap, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-950 rounded-full text-sm font-medium">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Themes */}
            <div className="pro-card p-6">
              <h3 className="font-semibold text-neutral-900 mb-3">
                ✅ {analysis.themes.length} themes emerging
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.themes.map((theme, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {theme}
                  </span>
                ))}
              </div>
            </div>

            {/* Patterns */}
            {analysis.patterns.length > 0 && (
              <div className="pro-card p-6">
                <h3 className="font-semibold text-neutral-900 mb-3">
                  ✅ {analysis.patterns.length} pattern found
                </h3>
                <ul className="space-y-2">
                  {analysis.patterns.map((pattern, i) => (
                    <li key={i} className="text-neutral-700 flex items-start gap-2">
                      <span className="text-blue-900 mt-1">→</span>
                      {pattern}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* First Insight */}
            <div className="pro-card p-6 border-2 border-blue-200 bg-blue-50">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-blue-900 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">
                    💡 First Insight
                  </h3>
                  <p className="text-neutral-700">
                    {analysis.first_insight}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Graph Visualization Placeholder */}
          <div className="pro-card p-6 mb-8">
            <h3 className="font-semibold text-neutral-900 mb-4 text-center">
              Your Knowledge Graph
            </h3>
            <div className="flex items-center justify-center gap-8 py-8">
              {analysis.graph_preview.nodes.map((node, i) => (
                <div key={node.id} className="flex flex-col items-center">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center text-sm font-medium text-center p-2
                    ${node.type === 'capability' ? 'bg-blue-100 text-blue-950' : 'bg-blue-100 text-blue-700'}`}>
                    {node.label}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-neutral-600 mt-4">
              This is just the beginning. Imagine after 50 captures...
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={() => navigate('/today')}
              className="btn-primary px-8 py-4 text-lg inline-flex items-center gap-2"
            >
              Start Capturing Thoughts
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="text-sm text-neutral-600 mt-4">
              Your knowledge graph will grow with every voice note
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-neutral-200 z-50">
        <div
          className="h-full bg-blue-900 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-neutral-900 mb-3">
              Let's map your creative brain
            </h1>
            <p className="text-xl text-neutral-600">
              Question {currentQuestion + 1} of {QUESTIONS.length}
            </p>
            <button
              onClick={handleSkipOnboarding}
              className="text-sm text-neutral-500 hover:text-neutral-700 mt-4"
            >
              Skip onboarding →
            </button>
          </div>

          {/* Question Card */}
          <div className="pro-card p-8 mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900 mb-6">
              {question.text}
            </h2>

            <div className="space-y-4">
              <textarea
                value={currentResponse}
                onChange={(e) => setCurrentResponse(e.target.value)}
                placeholder={question.placeholder}
                className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
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
            <div className="text-sm text-neutral-600">
              {currentQuestion > 0 && (
                <button
                  onClick={() => setCurrentQuestion(currentQuestion - 1)}
                  className="text-neutral-600 hover:text-neutral-900"
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
            <div className="mt-8 pt-8 border-t border-neutral-200">
              <h3 className="text-sm font-medium text-neutral-600 mb-3">
                Your responses so far:
              </h3>
              <div className="space-y-2">
                {responses.map((response, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-neutral-700 line-clamp-1">
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
