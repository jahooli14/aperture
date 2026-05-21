/**
 * Consuming widget — mobile-first, the home's identity layer.
 *
 * Three zones stacked inside one glass card:
 *   1. Top strip   — up to 3 active books (currently reading).
 *   2. Saved reads — articles you've started or saved. Capped at 20 so it
 *                    can't become a dumping ground — to add a new one, you
 *                    archive an old one. Closed by default. Pinned float
 *                    to the top.
 *                    Swipe left = archive (red). Swipe right = pin (gold).
 *                    Tap = read now.
 *   3. New reads   — unread RSS items, pure reverse-chrono. 20 at a time
 *                    with a "Load more" button. Closed by default.
 *                    Swipe left = dismiss (red). Swipe right = save (blue).
 *                    Tap = read now (also auto-saves if Saved has room).
 */
import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import {
  ArrowRight, ChevronDown, ChevronRight,
  X, Bookmark, Archive, Pin, RotateCcw,
  Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box,
} from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'

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

// Hard cap on Saved reads — keeps the list a curated shortlist, not a dump.
// To save a new article past this, the user archives an old one first.
const SAVED_CAP = 20

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
  pinned_at: string | null
}

interface ConsumingPayload {
  saved: ConsumingArticle[]
  new: ConsumingArticle[]
  recently_dismissed: ConsumingArticle[]
  recently_archived: ConsumingArticle[]
  new_has_more: boolean
  new_next_offset: number | null
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

const SWIPE_THRESHOLD_PX = 90

/**
 * A row that can be tapped to navigate and swiped left/right to trigger an
 * action. Drag-vs-tap distinction is handled by framer-motion. Backgrounds
 * reveal proportionally as the drag progresses — Gmail / iOS list style.
 */
function SwipeableArticleRow({
  article,
  onTap,
  onSwipeLeft,
  onSwipeRight,
  leftLabel,
  leftIcon: LeftIcon,
  leftColor,
  rightLabel,
  rightIcon: RightIcon,
  rightColor,
}: {
  article: ConsumingArticle
  onTap: () => void
  onSwipeLeft: () => void
  onSwipeRight: () => void
  leftLabel: string
  leftIcon: React.ElementType
  leftColor: string
  rightLabel: string
  rightIcon: React.ElementType
  rightColor: string
}) {
  const x = useMotionValue(0)
  const leftBgOpacity = useTransform(x, [-SWIPE_THRESHOLD_PX, -20, 0], [1, 0.25, 0])
  const rightBgOpacity = useTransform(x, [0, 20, SWIPE_THRESHOLD_PX], [0, 0.25, 1])
  const age = relativeAge(article.published_date || article.created_at)
  const isPinned = !!article.pinned_at

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x <= -SWIPE_THRESHOLD_PX) {
      haptic.medium()
      onSwipeLeft()
    } else if (info.offset.x >= SWIPE_THRESHOLD_PX) {
      haptic.medium()
      onSwipeRight()
    }
  }

  return (
    <div className="relative overflow-hidden border-b border-white/[0.04] last:border-b-0">
      {/* Right-swipe reveal (positive x) sits on the LEFT side of the row */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 left-0 flex items-center gap-2 px-5 text-[12px] font-medium uppercase tracking-wide text-white pointer-events-none"
        style={{ opacity: rightBgOpacity, background: rightColor }}
      >
        <RightIcon className="h-4 w-4" />
        <span>{rightLabel}</span>
      </motion.div>
      {/* Left-swipe reveal (negative x) sits on the RIGHT side */}
      <motion.div
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-center gap-2 px-5 text-[12px] font-medium uppercase tracking-wide text-white pointer-events-none justify-end"
        style={{ opacity: leftBgOpacity, background: leftColor }}
      >
        <span>{leftLabel}</span>
        <LeftIcon className="h-4 w-4" />
      </motion.div>

      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        onTap={onTap}
        style={{ x, touchAction: 'pan-y' }}
        whileTap={{ backgroundColor: 'rgba(255,255,255,0.025)' }}
        className="relative flex items-start gap-3 px-4 py-3 min-h-[64px] cursor-pointer bg-[var(--brand-bg,#0a0f1d)]"
      >
        {isPinned && (
          <span
            aria-hidden
            className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
            style={{ background: 'rgb(252, 211, 77)', boxShadow: '0 0 6px rgba(252, 211, 77, 0.7)' }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-[15px] leading-snug font-medium text-[var(--brand-text-primary)]"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.title || article.url}
          </p>
          <p className="text-[11px] text-[var(--brand-text-muted)] truncate mt-1">
            {[article.source, age, article.read_time_minutes ? `${article.read_time_minutes} min` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </motion.div>
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

/**
 * Inline "Recently hidden" panel — sits at the bottom of a dropdown.
 * Collapsed: shows a compact toggle with the count.
 * Expanded: lists each item muted, with a single Restore button.
 * The whole row is non-interactive except the Restore icon — keeps the
 * affordance unambiguous (no accidental reopens).
 */
function RecentlyHidden({
  label,
  items,
  open,
  onToggle,
  onRestore,
}: {
  label: string
  items: ConsumingArticle[]
  open: boolean
  onToggle: () => void
  onRestore: (article: ConsumingArticle) => void
}) {
  if (items.length === 0) return null
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <div className="border-t border-white/[0.04]">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors min-h-[36px]"
      >
        <Chevron className="h-3.5 w-3.5 text-[var(--brand-text-muted)] opacity-50" />
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--brand-text-muted)] opacity-70">
          {label}
        </span>
        <span className="ml-auto text-[11px] text-[var(--brand-text-muted)] opacity-60 tabular-nums">
          {items.length}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-1">
          {items.map(article => (
            <div
              key={article.id}
              className="flex items-center gap-2 py-1.5 text-[12px] text-[var(--brand-text-muted)] opacity-70"
            >
              <span className="flex-1 min-w-0 truncate">
                {article.title || article.url}
              </span>
              <button
                type="button"
                onClick={() => onRestore(article)}
                aria-label="Restore"
                className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--brand-text-muted)] hover:text-[var(--brand-text-primary)] hover:bg-white/[0.05] transition-colors flex-shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ConsumingWidget() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [activeItems, setActiveItems] = useState<ActiveItem[]>([])
  const [saved, setSaved] = useState<ConsumingArticle[]>([])
  const [feedReads, setFeedReads] = useState<ConsumingArticle[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // Both dropdowns closed by default. The widget is a compact peek; the
  // user opens whichever drawer they want.
  const [openSaved, setOpenSaved] = useState(false)
  const [openNew, setOpenNew] = useState(false)
  // Undo state — last 24h of swipe-left actions are recoverable from
  // within their respective dropdowns.
  const [recentlyDismissed, setRecentlyDismissed] = useState<ConsumingArticle[]>([])
  const [recentlyArchived, setRecentlyArchived] = useState<ConsumingArticle[]>([])
  const [showRecentlyDismissed, setShowRecentlyDismissed] = useState(false)
  const [showRecentlyArchived, setShowRecentlyArchived] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchAll = async () => {
      try {
        const [activeRes, consumingRes] = await Promise.all([
          // Top strip: active books, capped at 3.
          fetch('/api/lists?scope=items&resource=active-items&types=book&limit=3'),
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
          setRecentlyDismissed(data.recently_dismissed ?? [])
          setRecentlyArchived(data.recently_archived ?? [])
          setHasMore(!!data.new_has_more)
          setNextOffset(data.new_next_offset ?? null)
        }
      } catch {
        /* silent — widget hides itself when everything is empty */
      } finally {
        if (!cancelled) setLoaded(true)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [])

  const callConsumingAction = useCallback(async (
    action: 'dismiss' | 'save' | 'archive' | 'pin' | 'restore-dismiss' | 'restore-archive',
    id: string,
    extra?: Record<string, unknown>,
  ) => {
    try {
      await fetch(`/api/reading?resource=consuming&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...(extra ?? {}) }),
      })
    } catch {
      /* optimistic — local state already updated */
    }
  }, [])

  // New reads — swipe handlers
  const dismissNew = useCallback((id: string) => {
    const article = feedReads.find(r => r.id === id)
    setFeedReads(prev => prev.filter(r => r.id !== id))
    if (article) setRecentlyDismissed(prev => [article, ...prev])
    callConsumingAction('dismiss', id)
  }, [callConsumingAction, feedReads])

  const saveNew = useCallback((article: ConsumingArticle): boolean => {
    if (saved.length >= SAVED_CAP) {
      addToast({
        title: 'Saved is full',
        description: 'Archive an old one to keep this.',
      })
      return false
    }
    setFeedReads(prev => prev.filter(r => r.id !== article.id))
    setSaved(prev => [{ ...article, status: 'reading' }, ...prev])
    callConsumingAction('save', article.id)
    return true
  }, [callConsumingAction, saved.length, addToast])

  // Tap on a New read — opens the article and (if there's room) saves it.
  // The reader does not auto-promote status, so without the save the article
  // would reappear in New reads next visit. At cap we still open it but
  // leave it in New — the user must archive one to actually keep it.
  const openNewRead = useCallback((article: ConsumingArticle) => {
    saveNew(article)
    navigate(`/reading/${article.id}`)
  }, [saveNew, navigate])

  // Saved reads — swipe handlers
  const archiveSaved = useCallback((id: string) => {
    const article = saved.find(r => r.id === id)
    setSaved(prev => prev.filter(r => r.id !== id))
    if (article) setRecentlyArchived(prev => [article, ...prev])
    callConsumingAction('archive', id)
  }, [callConsumingAction, saved])

  // Restore handlers — bring a hidden item back into its parent list.
  const restoreDismiss = useCallback((article: ConsumingArticle) => {
    setRecentlyDismissed(prev => prev.filter(r => r.id !== article.id))
    setFeedReads(prev => [article, ...prev])
    callConsumingAction('restore-dismiss', article.id)
  }, [callConsumingAction])

  const restoreArchive = useCallback((article: ConsumingArticle) => {
    if (saved.length >= SAVED_CAP) {
      addToast({
        title: 'Saved is full',
        description: 'Archive an old one before restoring this.',
      })
      return
    }
    setRecentlyArchived(prev => prev.filter(r => r.id !== article.id))
    setSaved(prev => [{ ...article, status: 'reading' }, ...prev])
    callConsumingAction('restore-archive', article.id)
  }, [callConsumingAction, saved.length, addToast])

  const togglePinSaved = useCallback((article: ConsumingArticle) => {
    const willPin = !article.pinned_at
    const nowIso = new Date().toISOString()
    setSaved(prev => {
      const next = prev.map(r =>
        r.id === article.id ? { ...r, pinned_at: willPin ? nowIso : null } : r
      )
      return [...next].sort((a, b) => {
        if (!!b.pinned_at !== !!a.pinned_at) return b.pinned_at ? 1 : -1
        if (a.pinned_at && b.pinned_at) return b.pinned_at.localeCompare(a.pinned_at)
        return b.created_at.localeCompare(a.created_at)
      })
    })
    callConsumingAction('pin', article.id, { pinned: willPin })
  }, [callConsumingAction])

  const loadMoreNew = useCallback(async () => {
    if (loadingMore || nextOffset == null) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/reading?resource=consuming&new_offset=${nextOffset}&saved_limit=0`)
      if (!res.ok) return
      const data = (await res.json()) as ConsumingPayload
      setFeedReads(prev => [...prev, ...(data.new ?? [])])
      setHasMore(!!data.new_has_more)
      setNextOffset(data.new_next_offset ?? null)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, nextOffset])

  if (!loaded) return null

  const hasAnything = activeItems.length > 0 || saved.length > 0 || feedReads.length > 0
  if (!hasAnything) return null

  const shownActive = activeItems.slice(0, 3)

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
        {/* Top strip — up to 3 active books */}
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
        {(saved.length > 0 || recentlyArchived.length > 0) && (
          <>
            <DropdownHeader
              label="Saved reads"
              count={saved.length}
              open={openSaved}
              onClick={() => setOpenSaved(v => !v)}
            />
            {openSaved && (
              <div className="max-h-[60vh] overflow-y-auto border-t border-white/[0.04]">
                <AnimatePresence initial={false} mode="popLayout">
                  {saved.map(article => (
                    <motion.div
                      key={article.id}
                      layout
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, x: -200 }}
                      transition={{ duration: 0.18 }}
                    >
                      <SwipeableArticleRow
                        article={article}
                        onTap={() => navigate(`/reading/${article.id}`)}
                        onSwipeLeft={() => archiveSaved(article.id)}
                        onSwipeRight={() => togglePinSaved(article)}
                        leftLabel="Archive"
                        leftIcon={Archive}
                        leftColor="rgb(185, 28, 28)"
                        rightLabel={article.pinned_at ? 'Unpin' : 'Pin'}
                        rightIcon={Pin}
                        rightColor="rgb(180, 124, 12)"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                <RecentlyHidden
                  label="Recently archived"
                  items={recentlyArchived}
                  open={showRecentlyArchived}
                  onToggle={() => setShowRecentlyArchived(v => !v)}
                  onRestore={restoreArchive}
                />
              </div>
            )}
          </>
        )}

        {/* New reads dropdown */}
        {(feedReads.length > 0 || recentlyDismissed.length > 0) && (
          <>
            <DropdownHeader
              label="New reads"
              count={feedReads.length}
              open={openNew}
              onClick={() => setOpenNew(v => !v)}
            />
            {openNew && (
              <div className="max-h-[70vh] overflow-y-auto border-t border-white/[0.04]">
                <AnimatePresence initial={false} mode="popLayout">
                  {feedReads.map(article => (
                    <motion.div
                      key={article.id}
                      layout
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, x: -200 }}
                      transition={{ duration: 0.18 }}
                    >
                      <SwipeableArticleRow
                        article={article}
                        onTap={() => openNewRead(article)}
                        onSwipeLeft={() => dismissNew(article.id)}
                        onSwipeRight={() => saveNew(article)}
                        leftLabel="Dismiss"
                        leftIcon={X}
                        leftColor="rgb(185, 28, 28)"
                        rightLabel="Save"
                        rightIcon={Bookmark}
                        rightColor="rgb(29, 78, 216)"
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {hasMore && (
                  <button
                    type="button"
                    onClick={loadMoreNew}
                    disabled={loadingMore}
                    className="w-full px-4 py-3 text-[12px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] hover:bg-white/[0.025] disabled:opacity-50 transition-colors border-t border-white/[0.04]"
                  >
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                )}
                <RecentlyHidden
                  label="Recently dismissed"
                  items={recentlyDismissed}
                  open={showRecentlyDismissed}
                  onToggle={() => setShowRecentlyDismissed(v => !v)}
                  onRestore={restoreDismiss}
                />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
