/**
 * CompactArticleRow — a quiet, single-line row for feed-sourced articles
 * (anything tagged `rss` / `auto-imported`). These arrive in bulk and aren't
 * things you chose to keep, so they read much smaller than a saved ArticleCard
 * — title, source, date, and a tap target. Archive clears it from the list.
 */
import React from 'react'
import { format } from 'date-fns'
import { Rss, Archive } from 'lucide-react'
import type { Article } from '../../types/reading'
import { useReadingStore } from '../../stores/useReadingStore'
import { haptic } from '../../utils/haptics'

interface CompactArticleRowProps {
  article: Article
  onClick?: () => void
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return ''
  }
}

export const CompactArticleRow = React.memo(function CompactArticleRow({ article, onClick }: CompactArticleRowProps) {
  const { updateArticleStatus } = useReadingStore()
  const source = article.source || hostname(article.url)
  const meta = [
    source,
    article.created_at ? format(new Date(article.created_at), 'MMM d') : null,
    article.read_time_minutes ? `${article.read_time_minutes} min` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.03]"
    >
      <Rss className="h-3.5 w-3.5 flex-shrink-0 text-[var(--brand-text-muted)] opacity-50" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-snug text-[var(--brand-text-secondary)] truncate">
          {article.title || article.url}
        </p>
        {meta && (
          <p className="text-[11px] text-[var(--brand-text-muted)] truncate mt-0.5">{meta}</p>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); haptic.light(); updateArticleStatus(article.id, 'archived') }}
        aria-label="Archive"
        className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--brand-text-muted)] opacity-40 hover:opacity-100 hover:bg-white/[0.06] transition-all flex-shrink-0"
      >
        <Archive className="h-3.5 w-3.5" />
      </button>
    </div>
  )
})
