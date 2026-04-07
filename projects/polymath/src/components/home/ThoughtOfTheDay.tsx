/**
 * ThoughtOfTheDay — Resurfaced memory as a quote card.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Memory } from '../../types'

export function ThoughtOfTheDay() {
  const [card, setCard] = useState<Memory | null>(null)

  useEffect(() => {
    fetch('/api/memories?resurfacing=true&limit=10')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.memories?.[0]) setCard(data.memories[0])
      })
      .catch(() => {})
  }, [])

  if (!card) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="p-6 relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(145deg, rgba(6,182,212,0.08) 0%, rgba(15,24,41,0.6) 50%, rgba(168,85,247,0.05) 100%)',
        border: '1px solid rgba(6,182,212,0.12)',
        boxShadow: '0 0 40px rgba(6,182,212,0.04), 3px 3px 0 rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.3), rgba(168,85,247,0.2), transparent)' }} />
      <div className="relative z-10">
        <h3 className="font-bold text-xs aperture-header mb-3 uppercase tracking-[0.2em]" style={{ color: 'rgba(6,182,212,0.6)' }}>
          Thought of the day
        </h3>
        <p className="mb-3 leading-relaxed text-base italic aperture-body" style={{ color: 'var(--brand-text-primary)', fontWeight: 500 }}>
          &ldquo;{card.body}&rdquo;
        </p>
        <div className="flex items-center gap-2 text-xs aperture-body" style={{ color: 'rgba(6,182,212,0.5)' }}>
          <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: 'rgba(6,182,212,0.4)' }} />
          <span>
            {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
    </motion.div>
  )
}
