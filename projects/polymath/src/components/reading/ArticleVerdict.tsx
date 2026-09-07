import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Mic, ThumbsDown, X } from 'lucide-react'
import type { ArticleResonance } from '../../types/reading'

interface ArticleVerdictProps {
  /** The verdict already on the article, if it has one. */
  resonance: ArticleResonance | null
  saving: boolean
  onChoose: (verdict: ArticleResonance) => void
  onUndo: () => void
  onCaptureThought: () => void
  onDone: () => void
}

/**
 * The end of the article. One question, two answers.
 *
 * "This was good" is the ONLY way an article joins the corpus — it's what
 * lets a piece influence project ideas, and what earns it an embedding.
 * "Not for me" files it and makes sure it never does. Both file the
 * article, because answering IS finishing it; there's no separate archive
 * step to remember.
 *
 * Two buttons of equal weight, not a primary and an escape hatch: a
 * genuine question needs a genuine no. Undo is there because the tap is
 * one-way otherwise.
 */
export function ArticleVerdict({
  resonance,
  saving,
  onChoose,
  onUndo,
  onCaptureThought,
  onDone,
}: ArticleVerdictProps) {
  const [pending, setPending] = useState<ArticleResonance | null>(null)

  const choose = (verdict: ArticleResonance) => {
    setPending(verdict)
    onChoose(verdict)
  }

  if (resonance) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-16 pt-10 border-t border-white/[0.08] flex flex-col items-center text-center"
      >
        <p
          className="text-[15px]"
          style={{ fontFamily: 'var(--brand-font-body)', color: 'rgba(255,255,255,0.68)' }}
        >
          {resonance === 'good'
            ? 'Filed. This one counts towards what you make next.'
            : 'Filed. It won’t come back.'}
        </p>

        <button
          onClick={onDone}
          className="mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-white transition-all press-spring"
          style={{
            backgroundColor: 'var(--brand-primary)',
            boxShadow: '0 8px 28px -10px rgba(var(--brand-primary-rgb), 0.7)',
          }}
        >
          Back to your reading
        </button>

        <div className="mt-4 flex items-center gap-5">
          {resonance === 'good' && (
            <button
              onClick={onCaptureThought}
              className="text-[13px] inline-flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity press-spring py-2"
              style={{ color: 'var(--brand-text-secondary)' }}
            >
              <Mic className="h-3.5 w-3.5" /> Say what stuck
            </button>
          )}
          <button
            onClick={onUndo}
            className="text-[13px] opacity-45 hover:opacity-80 transition-opacity press-spring py-2"
            style={{ color: 'var(--brand-text-secondary)' }}
          >
            Undo
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className="mt-16 pt-10 border-t border-white/[0.08] flex flex-col items-center text-center"
    >
      <span
        className="text-[11px] uppercase tracking-[0.32em] font-semibold mb-3"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        You reached the end
      </span>
      <p
        className="text-[15px] mb-7 max-w-sm"
        style={{ fontFamily: 'var(--brand-font-body)', color: 'rgba(255,255,255,0.6)' }}
      >
        Worth keeping? Only the good ones feed into what the app suggests you make.
      </p>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-sm">
        <button
          onClick={() => choose('good')}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold text-white transition-all press-spring disabled:opacity-50"
          style={{
            backgroundColor: 'var(--brand-primary)',
            boxShadow: '0 8px 28px -10px rgba(var(--brand-primary-rgb), 0.7)',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {saving && pending === 'good' ? (
              <motion.span key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
              </motion.span>
            ) : (
              <motion.span key="i" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Check className="h-4 w-4" />
              </motion.span>
            )}
          </AnimatePresence>
          This was good
        </button>

        <button
          onClick={() => choose('not_for_me')}
          disabled={saving}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold transition-all press-spring disabled:opacity-50"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.75)',
          }}
        >
          {saving && pending === 'not_for_me' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsDown className="h-4 w-4" />
          )}
          Not for me
        </button>
      </div>
    </motion.div>
  )
}

/** Small badge used in list surfaces so a verdict is visible from outside. */
export function ResonanceBadge({ resonance }: { resonance: ArticleResonance | null | undefined }) {
  if (!resonance) return null
  const good = resonance === 'good'
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: good ? 'rgba(var(--brand-primary-rgb), 0.14)' : 'rgba(255,255,255,0.05)',
        color: good ? 'rgb(var(--brand-primary-rgb))' : 'rgba(255,255,255,0.4)',
      }}
    >
      {good ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      {good ? 'Good' : 'Not for me'}
    </span>
  )
}
