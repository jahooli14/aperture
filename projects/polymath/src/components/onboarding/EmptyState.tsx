/**
 * Empty State Component
 * Shown when user has no data — voice-first path back to onboarding
 */

import { useNavigate } from 'react-router-dom'
import { Mic, Zap } from 'lucide-react'
import { BrandName } from '../BrandName'

export function EmptyState() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="max-w-md mx-auto px-4 text-center">

        {/* Dot grid — subtle visual */}
        <div className="flex justify-center gap-2 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className="block w-2 h-2 rounded-full"
              style={{ background: 'var(--brand-text-secondary)', opacity: 0.2 }}
            />
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--brand-text-primary)' }}>
          Start by sharing a few thoughts
        </h2>
        <p className="text-sm mb-2" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>
          Speak 5 thoughts to see your first patterns emerge.
        </p>
        <p className="text-xs mb-8" style={{ color: 'var(--brand-text-secondary)', opacity: 0.35 }}>
          30 seconds each — <BrandName size="sm" /> does the rest.
        </p>

        {/* Progress hint */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-8"
          style={{ background: 'rgba(99,179,237,0.08)', color: 'var(--brand-primary)', border: '1px solid rgba(99,179,237,0.15)' }}
        >
          0 of 5 thoughts captured
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/onboarding')}
            className="btn-primary inline-flex items-center justify-center gap-2 py-3.5 text-base font-semibold"
          >
            <Mic className="h-4 w-4" />
            Speak a thought
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('clandestined_has_visited')
              window.location.reload()
            }}
            className="inline-flex items-center justify-center gap-2 py-2.5 text-sm transition-opacity hover:opacity-80"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
          >
            <Zap className="h-3.5 w-3.5" />
            Load demo instead
          </button>
        </div>
      </div>
    </div>
  )
}
