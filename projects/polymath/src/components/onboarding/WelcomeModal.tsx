/**
 * Welcome Modal Component
 * Shown to first-time users to explain Aperture and offer demo data
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()

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
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'rgba(15, 24, 41, 0.98)',
          border: '1px solid rgba(255,255,255,0.35)',
          borderRadius: '4px',
          boxShadow: '6px 6px 0 rgba(0,0,0,0.8), 0 0 40px rgba(var(--brand-primary-rgb),0.15)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 transition-colors rounded-lg hover:bg-brand-surface/80"
          style={{ color: "var(--brand-primary)" }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="text-center pt-12 pb-8 px-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-primary mb-6">
            <Zap className="h-8 w-8 text-[var(--brand-text-primary)]" />
          </div>
          <h1 className="text-3xl font-bold mb-3 aperture-header" style={{ color: "var(--brand-primary)" }}>
            Welcome to <BrandName size="xl" />
          </h1>
          <p className="text-lg max-w-xl mx-auto" style={{ color: "var(--brand-primary)" }}>
            Talk through ideas. See where they lead.
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--brand-text-secondary)', opacity: 0.55 }}>
            5 questions. 30 seconds each. Or explore with demo data.
          </p>
        </div>

        {/* How it works */}
        <div className="px-8 pb-8">
          <div className="space-y-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center"
                style={{
                  background: 'rgba(var(--brand-primary-rgb),0.1)',
                  border: '1.5px solid rgba(var(--brand-primary-rgb),0.3)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <Brain className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--brand-primary)" }}>
                  1. Capture Memories
                </h3>
                <p className="text-sm" style={{ color: "var(--brand-primary)" }}>
                  Send voice notes via Audiopen. <BrandName size="sm" /> extracts themes, entities, and insights automatically.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center"
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1.5px solid rgba(245,158,11,0.3)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <Lightbulb className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--brand-primary)" }}>
                  2. AI Generates Suggestions
                </h3>
                <p className="text-sm" style={{ color: "var(--brand-primary)" }}>
                  AI spots connections between your thoughts and suggests projects that fit your interests. Connects your different interests in unexpected ways.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center"
                style={{
                  background: 'rgba(var(--brand-primary-rgb),0.1)',
                  border: '1.5px solid rgba(var(--brand-primary-rgb),0.3)',
                  borderRadius: '4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                }}
              >
                <Layers className="h-6 w-6" style={{ color: "var(--brand-primary)" }} />
              </div>
              <div>
                <h3 className="font-semibold mb-1" style={{ color: "var(--brand-primary)" }}>
                  3. Build Projects
                </h3>
                <p className="text-sm" style={{ color: "var(--brand-primary)" }}>
                  Rate suggestions as "sparks" to build them. Track progress, link back to originating memories.
                </p>
              </div>
            </div>
          </div>

          {/* Demo data explainer */}
          <div
            className="mt-8 p-6"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1.5px solid rgba(245,158,11,0.25)',
              borderRadius: '4px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--brand-primary)" }}>
              <Lightbulb className="h-5 w-5" style={{ color: "var(--brand-primary)" }} />
              Try it with demo data
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--brand-primary)" }}>
              We'll load <strong style={{ color: "var(--brand-primary)" }}>8 sample memories</strong> (coding, woodworking, parenting, photography, etc.)
              and show you <strong style={{ color: "var(--brand-primary)" }}>7 AI-generated suggestions</strong> plus <strong style={{ color: "var(--brand-primary)" }}>4 projects</strong> in various stages.
            </p>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--brand-primary)" }}>
              <span className="inline-block w-2 h-2 rounded-full bg-brand-primary"></span>
              You can clear demo data anytime
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleLoadDemo}
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-50"
              style={{
                background: 'rgba(var(--brand-primary-rgb),0.15)',
                border: '1px solid rgba(var(--brand-primary-rgb),0.5)',
                borderRadius: '4px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                color: 'var(--brand-primary)',
              }}
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
              onClick={() => { onStartFresh(); navigate('/onboarding') }}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 font-bold uppercase tracking-wider text-sm transition-all hover:bg-brand-surface"
              style={{
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                color: 'var(--brand-text-secondary)',
              }}
            >
              Start with voice
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-xs text-center text-[var(--brand-text-muted)]">
            First time? We recommend trying demo data to see how everything works.
          </p>
        </div>
      </div>
    </div>
  )
}
