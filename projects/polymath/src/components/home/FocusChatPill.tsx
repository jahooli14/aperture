/**
 * Collapsed entry point for Focus chat — a pill showing the deterministic
 * opening line (no AI call, see focusChatOps.ts buildOpeningLine). Split
 * out of FocusChat.tsx to keep that file under the repo's 300-line
 * convention.
 */

import { Sparkles, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

export function FocusChatPill({ openingLine, onOpen }: { openingLine: string; onOpen: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.99] text-left mb-6"
      style={{ background: 'rgba(var(--brand-primary-rgb),0.05)', border: '1px solid rgba(var(--brand-primary-rgb),0.15)' }}
    >
      <div className="h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(var(--brand-primary-rgb),0.12)' }}>
        <Sparkles className="h-4 w-4" style={{ color: 'rgb(var(--brand-primary-rgb))' }} />
      </div>
      <p className="flex-1 min-w-0 text-[13px] leading-snug truncate" style={{ color: 'var(--brand-text-secondary)' }}>{openingLine}</p>
      <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-40" style={{ color: 'var(--brand-text-secondary)' }} />
    </motion.button>
  )
}
