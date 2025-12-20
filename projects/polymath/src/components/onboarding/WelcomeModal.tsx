/**
 * Welcome Modal Component
 * Shown to first-time users to explain Aperture and offer demo data
 */

import { useState } from 'react'
import { Brain, Zap, Layers, ArrowRight, X, Lightbulb } from 'lucide-react'
import { BrandName } from '../BrandName'

interface WelcomeModalProps {
  open: boolean
  onClose: () => void
  onLoadDemo: () => void
  onStartFresh: () => void
}

export function WelcomeModal({ open, onClose, onLoadDemo, onStartFresh }: WelcomeModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  if (!open) return null

  const handleLoadDemo = async () => {
    setIsLoading(true)
    await onLoadDemo()
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-neutral-600 transition-colors rounded-lg hover:bg-neutral-100"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center pt-12 pb-8 px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-amber-500 mb-6">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-3">
            Welcome to <BrandName size="xl" />
          </h1>
          <p className="text-lg text-neutral-600 max-w-xl mx-auto">
            Turn your scattered thoughts into connected insights and creative projects
          </p>
        </div>

        {/* How it works */}
        <div className="px-8 pb-8">
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Brain className="h-6 w-6 text-blue-900" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-1">
                  1. Capture Memories
                </h3>
                <p className="text-sm text-neutral-600">
                  Send voice notes via Audiopen. <BrandName size="sm" /> extracts themes, entities, and insights automatically.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <Lightbulb className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-1">
                  2. AI Generates Suggestions
                </h3>
                <p className="text-sm text-neutral-600">
                  Google Gemini synthesizes your memories into creative project ideas. Cross-pollinates your interests and skills.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Layers className="h-6 w-6 text-blue-900" />
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900 mb-1">
                  3. Build Projects
                </h3>
                <p className="text-sm text-neutral-600">
                  Rate suggestions as "sparks" to build them. Track progress, link back to originating memories.
                </p>
              </div>
            </div>
          </div>

          {/* Demo data explainer */}
          <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-amber-50 to-blue-50 border border-amber-200">
            <h3 className="font-semibold text-neutral-900 mb-2 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-600" />
              Try it with demo data
            </h3>
            <p className="text-sm text-neutral-700 mb-4">
              We'll load <strong>8 sample memories</strong> (coding, woodworking, parenting, photography, etc.)
              and show you <strong>7 AI-generated suggestions</strong> plus <strong>4 projects</strong> in various stages.
            </p>
            <div className="flex items-center gap-2 text-xs text-neutral-600">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
              You can clear demo data anytime
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleLoadDemo}
              disabled={isLoading}
              className="flex-1 btn-primary inline-flex items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {isLoading ? (
                'Loading demo...'
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Load Demo Data
                </>
              )}
            </button>
            <button
              onClick={onStartFresh}
              className="flex-1 btn-secondary inline-flex items-center justify-center gap-2 py-3"
            >
              Start Fresh
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-xs text-center text-neutral-500">
            First time? We recommend trying demo data to see how everything works.
          </p>
        </div>
      </div>
    </div>
  )
}
