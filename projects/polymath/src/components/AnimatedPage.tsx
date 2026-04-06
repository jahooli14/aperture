/**
 * AnimatedPage — Wraps route content with enter/exit transitions.
 * Also applies the data-page attribute for page color identity.
 */

import React from 'react'
import { motion } from 'framer-motion'

interface AnimatedPageProps {
  children: React.ReactNode
  /** Page identity key for the color system, e.g. "projects", "thoughts" */
  page?: string
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1] as [number, number, number, number],
    },
  },
}

export function AnimatedPage({ children, page }: AnimatedPageProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      data-page={page}
    >
      {children}
    </motion.div>
  )
}
