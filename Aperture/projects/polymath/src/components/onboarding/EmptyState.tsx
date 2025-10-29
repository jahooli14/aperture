/**
 * Empty State Component
 * Shown when user has no data - provides guidance on next steps
 */

import { Brain, Mic, Sparkles, ExternalLink } from 'lucide-react'
import { BrandName } from '../BrandName'

export function EmptyState() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-amber-100 mb-6">
          <Brain className="h-10 w-10 text-blue-900" />
        </div>

        {/* Heading */}
        <h2 className="text-3xl font-bold text-neutral-900 mb-4">
          Start Capturing Your Thoughts
        </h2>
        <p className="text-lg text-neutral-600 mb-8">
          <BrandName size="md" /> works by turning your voice notes into a personal knowledge graph.
          Here's how to get started:
        </p>

        {/* Steps */}
        <div className="space-y-6 text-left mb-8">
          {/* Step 1 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-900">
              1
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">
                Connect Audiopen
              </h3>
              <p className="text-sm text-neutral-600">
                Set up Audiopen webhook to send your voice notes to <BrandName size="sm" />.
                We'll automatically process them and extract themes, entities, and insights.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center font-bold text-amber-600">
              2
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">
                Record Voice Notes
              </h3>
              <p className="text-sm text-neutral-600">
                Share thoughts about anything: coding breakthroughs, project ideas, creative
                inspirations, learning insights. The more diverse, the better.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4 items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-900">
              3
            </div>
            <div>
              <h3 className="font-semibold text-neutral-900 mb-1">
                Get AI Suggestions
              </h3>
              <p className="text-sm text-neutral-600">
                After collecting a few memories, our AI will synthesize them into creative
                project suggestions that bridge your interests and skills.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="https://audiopen.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center justify-center gap-2"
          >
            <Mic className="h-4 w-4" />
            Get Audiopen
            <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => {
              // Show welcome modal again to load demo
              localStorage.removeItem('clandestined_has_visited')
              window.location.reload()
            }}
            className="btn-secondary inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Load Demo Instead
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-xs text-neutral-500">
          💡 Tip: Record 5-10 voice notes across different topics to see the magic happen
        </p>
      </div>
    </div>
  )
}
