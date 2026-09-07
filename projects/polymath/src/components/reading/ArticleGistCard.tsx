import { motion } from 'framer-motion'
import type { ArticleGist } from '../../types/reading'
import { ease } from '../../lib/motion'

interface ArticleGistCardProps {
  gist: ArticleGist | null
  loading: boolean
}

/**
 * "The gist" — what the article actually claims, before you commit to it.
 *
 * Sits between the headline and the first paragraph. Deliberately quiet:
 * a hairline rule, small caps label, three lines. It's a way in, not a
 * replacement for the piece, so it never gets a box, a glow or a button.
 *
 * Renders nothing at all when there's no gist. A card that says "no
 * summary available" is worse than the silence.
 */
export function ArticleGistCard({ gist, loading }: ArticleGistCardProps) {
  if (!loading && (!gist || gist.bullets.length === 0)) return null

  return (
    <motion.aside
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ease.editorial}
      className="mb-12 pl-4"
      style={{ borderLeft: '2px solid rgba(var(--brand-primary-rgb), 0.35)' }}
      aria-label="The gist"
    >
      <div
        className="text-[10px] uppercase tracking-[0.32em] font-semibold mb-3.5"
        style={{ color: 'rgba(var(--brand-primary-rgb), 0.75)' }}
      >
        The gist
      </div>

      {loading && !gist ? (
        <div className="space-y-3" aria-busy="true" aria-label="Reading it for you">
          {[92, 78, 85].map((width, i) => (
            <motion.div
              key={i}
              className="h-3 rounded-full"
              style={{ width: `${width}%`, background: 'rgba(255,255,255,0.07)' }}
              animate={{ opacity: [0.35, 0.75, 0.35] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.18 }}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {gist!.bullets.map((bullet, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              className="text-[15px] leading-[1.55] flex gap-2.5"
              style={{
                fontFamily: 'var(--brand-font-body)',
                color: 'rgba(255,255,255,0.74)',
              }}
            >
              <span
                aria-hidden
                className="mt-[0.6em] h-1 w-1 rounded-full flex-shrink-0"
                style={{ background: 'rgba(var(--brand-primary-rgb), 0.6)' }}
              />
              <span>{bullet}</span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.aside>
  )
}
