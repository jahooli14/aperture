/**
 * The session takes the whole screen. Once you've said go, the app has one
 * job: show the move you're on and get out of the way. Nothing from the
 * rest of the app -- no nav, no cards, no questions about other projects --
 * until you stop. True black, because this is the screen you look at for
 * an hour.
 */

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

export function FocusShell({ children }: { children: ReactNode }) {
  // The page behind mustn't scroll under your thumb.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[10001] flex flex-col overflow-y-auto"
      style={{
        background: '#000',
        color: 'var(--brand-text-primary)',
        paddingTop: 'max(env(safe-area-inset-top), 16px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
      }}
    >
      <div className="w-full max-w-md mx-auto px-5 flex-1 flex flex-col">{children}</div>
    </motion.div>,
    document.body,
  )
}
