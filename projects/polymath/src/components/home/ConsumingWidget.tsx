/**
 * Consuming widget — the home's identity layer.
 *
 * Three zones stacked inside one glass card:
 *   1. Top strip   — active list items (books, films, music, places, …).
 *                    Articles are intentionally excluded; they live in the
 *                    dropdowns below.
 *   2. Saved reads — articles you started or explicitly saved, not fresh
 *                    from RSS. Default open if non-empty.
 *   3. New reads   — unread RSS items, ranked by relevance × recency. The
 *                    scroll-through-feeds drawer. Default closed.
 *
 * Each dropdown is internally scrollable so the home page itself stays calm
 * — the rabbit hole lives inside the card.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ChevronDown, ChevronRight, X,
  Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box,
} from 'lucide-react'

const LIST_TYPE_ICONS: Record<string, React.ElementType> = {
  film: Film, music: Music, tech: Monitor, book: Book, place: MapPin,
  game: Gamepad2, event: Calendar, quote: Quote, article: FileText,
  software: Monitor, generic: Box,
}

const LIST_TYPE_ACCENT: Record<string, string> = {
  film: '236, 72, 153',
  music: '239, 68, 68',
  tech: '59, 130, 246',
  book: '252, 211, 77',
  place: '16, 185, 129',
  game: '167, 139, 250',
  event: '56, 189, 248',
  quote: '156, 163, 175',
  article: '6, 182, 212',
  software: '59, 130, 246',
  generic: '156, 163, 175',
}

interface ActiveItem {
  listId: string
  listTitle: string
  listType: string
  itemId: string
  itemContent: string
}

interface ConsumingArticle {
  id: string
  url: string
  title: string | null
  excerpt: string | null
  source: string | null
  favicon_url: string | null
  thumbnail_url: string | null
  published_date: string | null
  read_time_minutes: number | null
  status: string
  tags: string[] | null
  created_at: string
}

interface ConsumingPayload {
  saved: ConsumingArticle[]
  new: ConsumingArticle[]
}

function relativeAge(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

function ArticleRow({
  article,
  onDismiss,
  showDismiss = false,
}: {
  article: ConsumingArticle
  onDismiss?: (id: string) => void
  showDismiss?: boolean
}) {
  const age = relativeAge(article.published_date || article.created_at)
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3 hover:bg-white/[0.025] transition-colors min-h-[58px] border-b border-white/[0.04] last:border-b-0">
      <Link to={`/reading/${article.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="relative h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {article.favicon_url ? (
            <img src={article.favicon_url} alt="" className="h-4 w-4" loading="lazy" />
          ) : (
            <FileText className="h-4 w-4 text-[var(--brand-text-secondary)] opacity-80" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--brand-text-primary)] truncate">
            {article.title || article.url}
          </p>
          <p className="text-[11px] text-[var(--brand-text-muted)] truncate mt-0.5">
            {[article.source, age, article.read_time_minutes ? `${article.read_time_minutes} min` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </Link>
      {showDismiss && onDismiss ? (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(article.id) }}
          aria-label="Not interested"
          className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--brand-text-muted)] opacity-40 hover:opacity-100 hover:bg-white/[0.04] transition-all flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <ArrowRight className="h-4 w-4 text-[var(--brand-text-muted)] opacity-40 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
      )}
    </div>
  )
}

function DropdownHeader({
  label,
  count,
  open,
  onClick,
}: {
  label: string
  count: number
  open: boolean
  onClick: () => void
}) {
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-white/[0.02] transition-colors min-h-[44px]"
    >
      <Chevron className="h-4 w-4 text-[var(--brand-text-muted)] opacity-70" />
      <span className="text-[13px] font-medium text-[var(--brand-text-secondary)] tracking-wide">{label}</span>
      {count > 0 && (
        <span className="ml-auto text-[11px] text-[var(--brand-text-muted)] opacity-70 tabular-nums">
          {count}
        </span>
      )}
    </button>
  )
}

export function ConsumingWidget() {
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([])
  const [saved, setSaved] = useState<ConsumingArticle[]>([])
  const [feedReads, setFeedReads] = useState<ConsumingArticle[]>([])
  const [loaded, setLoaded] = useState(false)
  const [openSaved, setOpenSaved] = useState(false)
  const [openNew, setOpenNew] = useState(false)
  const [openSetByUser, setOpenSetByUser] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      try {
        const [activeRes, consumingRes] = await Promise.all([
          fetch('/api/lists?scope=items&resource=active-items&limit=4'),
          fetch('/api/reading?resource=consuming'),
        ])
        if (cancelled) return
        if (activeRes.ok) {
          const rows = await activeRes.json()
          setActiveItems(rows.map((r: any) => ({
            listId: r.list_id,
            listTitle: r.list?.title ?? '',
            listType: r.list?.type ?? 'generic',
            itemId: r.id,
            itemContent: r.content,
          })))
        }
        if (consumingRes.ok) {
          const data = (await consumingRes.json()) as ConsumingPayload
          setSaved(data.saved ?? [])
          setFeedReads(data.new ?? [])
          if (!openSetByUser) {
            setOpenSaved((data.saved ?? []).length > 0)
          }
        }
      } catch {
        /* silent — widget hides itself when everything is empty */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(async (id: string) => {
    setFeedReads(prev => prev.filter(r => r.id !== id))
    try {
      await fetch('/api/reading?resource=consuming&action=dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      /* optimistic — leave it removed locally even if the call fails */
    }
  }, [])

  if (!loaded) return null

  const hasAnything = activeItems.length > 0 || saved.length > 0 || feedReads.length > 0
  if (!hasAnything) return null

  const shownActive = activeItems.slice(0, 4)

  return (
    <section className="pb-8">
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(15,24,41,0.45))',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {/* Top strip — non-article active items */}
        {shownActive.map((item, i) => {
          const Icon = LIST_TYPE_ICONS[item.listType] || Box
          const accent = LIST_TYPE_ACCENT[item.listType] || LIST_TYPE_ACCENT.generic
          return (
            <Link
              key={item.itemId}
              to={`/lists/${item.listId}`}
              className="group relative flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025] min-h-[60px] border-b border-white/[0.04]"
              style={{
                animation: `pageEnter 0.45s cubic-bezier(0.4,0,0.2,1) ${i * 60}ms both`,
              }}
            >
              <div
                className="relative h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <Icon className="h-4 w-4 text-[var(--brand-text-secondary)] opacity-80" />
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full"
                  style={{ background: `rgb(${accent})`, boxShadow: `0 0 6px rgba(${accent}, 0.7)` }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--brand-text-primary)] truncate">{item.itemContent}</p>
                <p className="text-[11px] text-[var(--brand-text-muted)] truncate mt-0.5">{item.listTitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[var(--brand-text-muted)] opacity-40 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
            </Link>
          )
        })}

        {/* Saved reads dropdown */}
        {saved.length > 0 && (
          <>
            <DropdownHeader
              label="Saved reads"
              count={saved.length}
              open={openSaved}
              onClick={() => { setOpenSaved(v => !v); setOpenSetByUser(true) }}
            />
            {openSaved && (
              <div className="max-h-[320px] overflow-y-auto border-t border-white/[0.04]">
                {saved.map(article => (
                  <ArticleRow key={article.id} article={article} />
                ))}
              </div>
            )}
          </>
        )}

        {/* New reads dropdown */}
        {feedReads.length > 0 && (
          <>
            <DropdownHeader
              label="New reads"
              count={feedReads.length}
              open={openNew}
              onClick={() => { setOpenNew(v => !v); setOpenSetByUser(true) }}
            />
            {openNew && (
              <div className="max-h-[420px] overflow-y-auto border-t border-white/[0.04]">
                {feedReads.map(article => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    showDismiss
                    onDismiss={handleDismiss}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
