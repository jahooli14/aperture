/**
 * ThoughtOfTheDay — Resurfaced memory as a quote card.
 *
 * Rotates daily by seeding into the candidate list with the current day-of-year,
 * so the same user sees a different thought each day.
 */

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Memory } from '../../types'

function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export function ThoughtOfTheDay() {
  const [card, setCard] = useState<Memory | null>(null)

  useEffect(() => {
    fetch('/api/memories?resurfacing=true&limit=30')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list: Memory[] = data?.memories || []
        if (list.length === 0) return
        // Rotate deterministically by day-of-year so it changes daily.
        const idx = dayOfYear() % list.length
        setCard(list[idx])
      })
      .catch(() => {})
  }, [])

  if (!card) return null

  return (
    <section className="pb-6">
      <h2 className="section-header">thought of the <span>day</span></h2>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="p-6 relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(145deg, rgba(var(--brand-primary-rgb),0.08) 0%, rgba(15,24,41,0.6) 50%, rgba(var(--brand-primary-rgb),0.04) 100%)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.12)',
          boxShadow: '0 0 40px rgba(var(--brand-primary-rgb),0.04), 0 4px 16px rgba(0,0,0,0.5)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.3), transparent)' }} />
        <div className="relative z-10">
          <p className="mb-3 leading-relaxed text-base italic aperture-body" style={{ color: 'var(--brand-text-primary)', fontWeight: 500 }}>
            &ldquo;{card.body}&rdquo;
          </p>
          <div className="flex items-center gap-2 text-xs aperture-body" style={{ color: 'rgba(var(--brand-primary-rgb),0.5)' }}>
            <span className="inline-block h-1 w-1 rounded-full" style={{ backgroundColor: 'rgba(var(--brand-primary-rgb),0.4)' }} />
            <span>
              {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
