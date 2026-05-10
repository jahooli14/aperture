/**
 * Shared motion constants — one spring config, one set of eases, app-wide.
 *
 * Things 3 feels coherent because every gesture has the same physics.
 * Every framer-motion usage in this app should pull from here.
 *
 * Usage:
 *   <motion.div transition={spring.gentle}>...
 *   <motion.div transition={ease.editorial}>...
 */

import type { Transition } from 'framer-motion'

// Springs — for anything that should feel object-like (cards entering,
// drag/drop, sheet sheets, gesture-driven motion).
export const spring = {
  // Default — slightly bouncy, snappy. Use for most card/element entrances.
  gentle: { type: 'spring', stiffness: 260, damping: 24, mass: 0.9 } as Transition,

  // Snappier — for taps, toggles, immediate feedback.
  snap: { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 } as Transition,

  // Soft — for ambient / atmospheric movement, never urgent.
  soft: { type: 'spring', stiffness: 140, damping: 22, mass: 1 } as Transition,
}

// Eases — for time-based animations (fades, opacity, scroll-driven, anything
// where physics doesn't make sense).
export const ease = {
  // Editorial — soft enter, decisive land. Use for content reveals.
  editorial: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } as Transition,

  // Quick — hover/tap state changes.
  quick: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } as Transition,

  // Slow drift — backgrounds, ambient layers.
  drift: { duration: 1.2, ease: [0.4, 0, 0.2, 1] } as Transition,
}

// Stagger — used on lists / stacks. Keep one canonical value so every
// stagger feels the same.
export const stagger = {
  // Children appear ~70ms apart — feels like a hand dealing cards.
  list: 0.07,
  // Tight stagger for chips / inline elements.
  inline: 0.04,
}
