/**
 * ThoughtOfTheDay — Resurfaced memory as an editorial pull-quote.
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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(155deg, rgba(var(--brand-primary-rgb),0.10) 0%, rgba(15,24,41,0.65) 60%)',
          border: '1px solid rgba(var(--brand-primary-rgb),0.32)',
          boxShadow: '0 0 36px rgba(var(--brand-primary-rgb),0.20), 0 8px 28px -10px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Top hairline glow */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(var(--brand-primary-rgb),0.45), transparent)' }}
        />

        {/* Decorative giant quotation glyph in corner — Playfair for proper
            book-jacket curl rather than a sans-serif tick. */}
        <span
          aria-hidden
          className="absolute -top-10 -left-2 text-[200px] leading-none select-none pointer-events-none"
          style={{
            color: 'rgba(var(--brand-primary-rgb), 0.14)',
            fontFamily: 'var(--brand-font-serif)',
            fontWeight: 700,
            fontStyle: 'italic',
          }}
        >
          “
        </span>

        <div className="relative z-10 p-7 sm:p-8 pl-12 sm:pl-14">
          <p
            className="mb-5 leading-[1.45] text-[19px] sm:text-[22px] italic"
            style={{
              color: 'var(--brand-text-primary)',
              fontFamily: 'var(--brand-font-serif)',
              fontWeight: 400,
              opacity: 0.96,
            }}
          >
            {card.body}
          </p>
          <div className="flex items-center gap-3">
            <span
              className="h-px w-10"
              aria-hidden
              style={{ background: 'linear-gradient(to right, rgba(var(--brand-primary-rgb),0.5), transparent)' }}
            />
            <span
              className="text-[10px] uppercase tracking-[0.32em] font-semibold"
              style={{ color: 'rgba(var(--brand-primary-rgb),0.7)' }}
            >
              {new Date(card.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
