/**
 * CoverageDots
 *
 * Six dots at the base of the onboarding chat. A slot → dot mapping is
 * decided at session start (random permutation stored on the CoverageGrid),
 * so dots light up in a visually non-linear order — never "1, 2, 3 …" —
 * avoiding the progress-bar feeling the product spec explicitly rejects.
 */

import { motion } from 'framer-motion'
import type { CoverageGrid, CoverageSlotId } from '../../types'

interface CoverageDotsProps {
  grid: CoverageGrid
  /** Slot ids newly filled on the last turn — triggers a brief bloom animation. */
  justFilled?: CoverageSlotId[]
}

const FILL_THRESHOLD = 0.6

export function CoverageDots({ grid, justFilled = [] }: CoverageDotsProps) {
  return (
    <div
      className="flex gap-2 justify-center"
      aria-hidden // decorative; the transcript + reframe carry the real semantics
    >
      {grid.dot_order.map((slotId) => {
        const slot = grid.slots[slotId]
        const lit = slot.confidence >= FILL_THRESHOLD || slot.status === 'filled'
        const bloom = justFilled.includes(slotId)
        return (
          <motion.span
            key={slotId}
            className="block rounded-full"
            initial={{ width: 6, height: 6, opacity: 0.25 }}
            animate={{
              width: lit ? 10 : 6,
              height: lit ? 10 : 6,
              opacity: lit ? 1 : 0.25,
              background: lit ? 'var(--brand-primary)' : 'var(--brand-text-secondary)',
              scale: bloom ? [1, 1.5, 1] : 1,
            }}
            transition={{
              duration: bloom ? 0.55 : 0.3,
              ease: 'easeOut',
            }}
          />
        )
      })}
    </div>
  )
}
