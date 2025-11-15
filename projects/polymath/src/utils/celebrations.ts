/**
 * Celebration Animations
 * Classy, subtle celebrations for user milestones
 *
 * Design Philosophy:
 * - Elegant, not overwhelming
 * - Reinforce positive behavior
 * - Match premium dark theme aesthetic
 *
 * Usage:
 * import { celebrate } from '@/utils/celebrations'
 *
 * celebrate.firstThought()
 * celebrate.tenthThought()
 * celebrate.firstConnection()
 * celebrate.projectComplete()
 */

import confetti from 'canvas-confetti'
import { haptic } from './haptics'

// Premium theme colors
const COLORS = {
  blue: '#3b82f6',
  indigo: '#6366f1',
  amber: '#f59e0b',
  emerald: '#10b981',
  platinum: '#e2e8f0',
}

/**
 * Subtle confetti burst - classy and refined
 */
function classyConfetti(options: confetti.Options = {}) {
  const defaults: confetti.Options = {
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    colors: [COLORS.blue, COLORS.indigo, COLORS.amber],
    ticks: 120,
    gravity: 0.8,
    scalar: 0.8,
    drift: 0,
  }

  confetti({
    ...defaults,
    ...options,
  })
}

/**
 * Fireworks burst - for major milestones
 */
function fireworks(duration: number = 2000) {
  const end = Date.now() + duration

  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval)
      return
    }

    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: [COLORS.blue, COLORS.indigo],
      ticks: 50,
      gravity: 0.6,
    })

    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: [COLORS.amber, COLORS.emerald],
      ticks: 50,
      gravity: 0.6,
    })
  }, 200)
}

/**
 * Star burst - elegant single burst
 */
function starBurst() {
  const count = 200
  const defaults = {
    origin: { y: 0.7 },
    colors: [COLORS.platinum, COLORS.blue, COLORS.indigo],
  }

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    })
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  })

  fire(0.2, {
    spread: 60,
  })

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  })

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  })
}

/**
 * Cannon shot - for achievements
 */
function cannonShot() {
  confetti({
    particleCount: 100,
    angle: 60,
    spread: 55,
    origin: { x: 0 },
    colors: [COLORS.blue, COLORS.indigo, COLORS.amber],
  })

  confetti({
    particleCount: 100,
    angle: 120,
    spread: 55,
    origin: { x: 1 },
    colors: [COLORS.emerald, COLORS.platinum],
  })
}

/**
 * Sparkles - subtle magic effect
 */
function sparkles() {
  const duration = 1000
  const animationEnd = Date.now() + duration
  const colors = [COLORS.blue, COLORS.platinum]

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now()

    if (timeLeft <= 0) {
      clearInterval(interval)
      return
    }

    const particleCount = 2

    confetti({
      particleCount,
      startVelocity: 0,
      ticks: 50,
      origin: {
        x: Math.random(),
        y: Math.random() - 0.2,
      },
      colors,
      shapes: ['circle'],
      gravity: 0.4,
      scalar: 0.4,
      drift: 0,
    })
  }, 50)
}

// ============================================
// Milestone Celebrations
// ============================================

export const celebrate = {
  /**
   * First thought captured - Welcome moment
   * Gentle, encouraging celebration
   */
  firstThought() {
    haptic.success()
    classyConfetti({
      particleCount: 30,
      spread: 50,
      colors: [COLORS.blue, COLORS.indigo],
      scalar: 0.6,
    })
  },

  /**
   * 10 thoughts milestone
   * Building momentum celebration
   */
  tenthThought() {
    haptic.success()
    classyConfetti({
      particleCount: 60,
      spread: 70,
      colors: [COLORS.blue, COLORS.amber, COLORS.indigo],
    })
  },

  /**
   * 50 thoughts milestone
   * Significant achievement
   */
  fiftiethThought() {
    haptic.heavy()
    starBurst()
  },

  /**
   * 100 thoughts milestone
   * Major milestone
   */
  hundredthThought() {
    haptic.heavy()
    fireworks(2500)
  },

  /**
   * First connection created
   * Network effect begins
   */
  firstConnection() {
    haptic.success()
    sparkles()
  },

  /**
   * 10 connections milestone
   * Knowledge graph forming
   */
  tenthConnection() {
    haptic.success()
    classyConfetti({
      particleCount: 50,
      spread: 60,
      colors: [COLORS.indigo, COLORS.blue],
    })
  },

  /**
   * Project completed
   * Achievement unlocked
   */
  projectComplete() {
    haptic.heavy()
    cannonShot()
  },

  /**
   * First project created
   * Starting journey
   */
  firstProject() {
    haptic.success()
    classyConfetti({
      particleCount: 40,
      spread: 55,
      colors: [COLORS.emerald, COLORS.blue],
    })
  },

  /**
   * Reading streak milestone
   * Consistency reward
   */
  readingStreak(days: number) {
    haptic.success()
    if (days >= 30) {
      fireworks(1500)
    } else if (days >= 7) {
      starBurst()
    } else {
      classyConfetti({
        particleCount: 40,
        colors: [COLORS.amber, COLORS.emerald],
      })
    }
  },

  /**
   * Generic success celebration
   * For custom milestones
   */
  success() {
    haptic.success()
    classyConfetti()
  },

  /**
   * Epic achievement
   * For rare, special moments
   */
  epic() {
    haptic.heavy()
    fireworks(3000)
  },
}

/**
 * Check if user deserves celebration for thought count
 */
export function checkThoughtMilestone(count: number): boolean {
  return count === 1 || count === 10 || count === 50 || count === 100
}

/**
 * Check if user deserves celebration for connection count
 */
export function checkConnectionMilestone(count: number): boolean {
  return count === 1 || count === 10 || count === 50
}

/**
 * Get celebration message for milestone
 */
export function getMilestoneMessage(type: 'thought' | 'connection' | 'project', count: number): string | null {
  if (type === 'thought') {
    switch (count) {
      case 1:
        return 'Your first thought! The journey begins 🌟'
      case 10:
        return '10 thoughts captured! Building momentum 🚀'
      case 50:
        return '50 thoughts! Your knowledge graph is growing 🌱'
      case 100:
        return '100 thoughts! Incredible milestone 🎯'
      default:
        return null
    }
  } else if (type === 'connection') {
    switch (count) {
      case 1:
        return 'First connection! Ideas are linking ✨'
      case 10:
        return '10 connections! Your graph is forming 🔗'
      case 50:
        return '50 connections! A true knowledge web 🕸️'
      default:
        return null
    }
  } else if (type === 'project') {
    switch (count) {
      case 1:
        return 'Your first project! Let\'s build something amazing 🎨'
      default:
        return null
    }
  }
  return null
}
