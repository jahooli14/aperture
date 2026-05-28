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
import { motion, AnimatePresence, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion'
import {
  ArrowRight, ChevronDown, ChevronRight,
  X, Bookmark, Archive, Pin, RotateCcw, WifiOff, Plus, Settings2,
  Film, Music, Monitor, Book, MapPin, Gamepad2, Calendar, FileText, Quote, Box,
} from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { useToast } from '../ui/toast'
import { readingDb } from '../../lib/db'
import { useRSSStore } from '../../stores/useRSSStore'
import { FeedSearchSheet } from '../reading/FeedSearchSheet'

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

// Cache key for the consuming payload in Dexie's dashboard table.
// Stale-while-revalidate: paint the cached state immediately, then refresh
// from network if we're online. Used for offline tube-reading.
const CONSUMING_CACHE_KEY = 'consuming-payload-v1'

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
// Touches that start within this many pixels of the left edge are treated
// as iOS back-gesture territory — we don't fire a swipe action so we don't
// fight the native gesture.
const EDGE_SAFE_PX = 16

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
  showHint = false,
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
  showHint?: boolean
}) {
  const x = useMotionValue(0)
  const leftBgOpacity = useTransform(x, [-SWIPE_THRESHOLD_PX, -20, 0], [1, 0.25, 0])
  const rightBgOpacity = useTransform(x, [0, 20, SWIPE_THRESHOLD_PX], [0, 0.25, 1])
  const age = relativeAge(article.published_date || article.created_at)
  const isPinned = !!article.pinned_at

  // One-time discoverability nudge: a gentle peek both ways teaches that
  // rows swipe for quick actions. Transform-only and a single row, so it
  // stays cheap on Android. Gated by the parent via localStorage.
  useEffect(() => {
    if (!showHint) return
    const controls = animate(x, [0, 40, 0, -40, 0], {
      duration: 1.7,
      times: [0, 0.22, 0.46, 0.68, 1],
      ease: 'easeInOut',
    })
    return () => controls.stop()
  }, [showHint, x])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    // info.point.x is the release position, info.offset.x is the
    // displacement since drag start, so the starting x is the difference.
    // If the gesture began at the very left edge, iOS may have wanted the
    // back gesture — skip our action and let the native one win cleanly.
    const startX = info.point.x - info.offset.x
    if (startX < EDGE_SAFE_PX) return
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
  // Arm the one-time swipe hint the first time a reads dropdown is opened.
  const [swipeHintArmed, setSwipeHintArmed] = useState(false)
  // Undo state — last 24h of swipe-left actions are recoverable from
  // within their respective dropdowns.
  const [recentlyDismissed, setRecentlyDismissed] = useState<ConsumingArticle[]>([])
  const [recentlyArchived, setRecentlyArchived] = useState<ConsumingArticle[]>([])
  const [showRecentlyDismissed, setShowRecentlyDismissed] = useState(false)
  const [showRecentlyArchived, setShowRecentlyArchived] = useState(false)
  // Add-feed bottom sheet — opened from the inline "+ Add feed" button at
  // the bottom of New reads. Shared with /rss page.
  const [addFeedOpen, setAddFeedOpen] = useState(false)
  const fetchFeeds = useRSSStore(s => s.fetchFeeds)
  const feeds = useRSSStore(s => s.feeds)
  // Prime the feeds store so the sheet can show "already subscribed" badges
  // and so /rss has fresh data when the user navigates.
  useEffect(() => { fetchFeeds() }, [fetchFeeds])

  // The swipe actions on reads are invisible until you swipe. The first time
  // a user opens either reads dropdown, peek the top row once so the gesture
  // is discoverable. Remember it per-device so we never nag.
  useEffect(() => {
    if (!(openSaved || openNew)) return
    try {
      if (localStorage.getItem('consuming-swipe-hint-seen')) return
      localStorage.setItem('consuming-swipe-hint-seen', '1')
    } catch { /* private mode — just show it this once */ }
    setSwipeHintArmed(true)
  }, [openSaved, openNew])
  // navigator.onLine plus event listeners. Drives the "offline" badge and
  // disables Load more / shows stale data freely.
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )
  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const applyPayload = (data: ConsumingPayload, activeItemsFresh?: ActiveItem[]) => {
      setSaved(data.saved ?? [])
      setFeedReads(data.new ?? [])
      setRecentlyDismissed(data.recently_dismissed ?? [])
      setRecentlyArchived(data.recently_archived ?? [])
      setHasMore(!!data.new_has_more)
      setNextOffset(data.new_next_offset ?? null)
      if (activeItemsFresh !== undefined) setActiveItems(activeItemsFresh)
    }

    const fetchAll = async () => {
      // 1. Stale-while-revalidate: paint the cached state immediately so the
      // user sees content even on slow networks or offline.
      try {
        const cached = await readingDb.getDashboard(CONSUMING_CACHE_KEY)
        if (cached && !cancelled) {
          applyPayload(cached as ConsumingPayload, cached.activeItems ?? [])
          setLoaded(true)
        }
      } catch { /* cache miss is fine */ }

      // 2. Offline: cache is all we get. Stop.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) setLoaded(true)
        return
      }

      // 3. Refresh from network.
      try {
        const [activeRes, consumingRes] = await Promise.all([
          fetch('/api/lists?scope=items&resource=active-items&types=book&limit=3'),
          fetch('/api/reading?resource=consuming'),
        ])
        if (cancelled) return

        let activeItemsFresh: ActiveItem[] = []
        if (activeRes.ok) {
          const rows = await activeRes.json()
          activeItemsFresh = rows.map((r: any) => ({
            listId: r.list_id,
            listTitle: r.list?.title ?? '',
            listType: r.list?.type ?? 'generic',
            itemId: r.id,
            itemContent: r.content,
          }))
        }

        let consumingFresh: ConsumingPayload | null = null
        if (consumingRes.ok) {
          consumingFresh = (await consumingRes.json()) as ConsumingPayload
          applyPayload(consumingFresh, activeItemsFresh)
        } else {
          // Endpoint failed but active-items succeeded — still update strip.
          setActiveItems(activeItemsFresh)
        }

        // 4. Persist the fresh payload to Dexie so the next cold start
        // (and any offline trips) reads recent state.
        if (consumingFresh) {
          try {
            await readingDb.cacheDashboard(CONSUMING_CACHE_KEY, {
              ...consumingFresh,
              activeItems: activeItemsFresh,
            })
          } catch { /* offline storage full / blocked — silent */ }

          // 5. Cache article CONTENT in readingDb.articles for the items
          // we just fetched. Targeted batch fetch via ?ids=... so we don't
          // pull every article in the user's library just to make 20 of
          // them readable offline.
          const idsToCache = [
            ...(consumingFresh.new ?? []).map(a => a.id),
            ...(consumingFresh.saved ?? []).map(a => a.id),
          ].filter(Boolean)
          if (idsToCache.length > 0) {
            fetch(`/api/reading?ids=${idsToCache.join(',')}`)
              .then(r => r.ok ? r.json() : null)
              .then(async (payload) => {
                if (!payload?.articles?.length) return
                const cached = payload.articles.map((a: any) => ({
                  ...a,
                  offline_available: true,
                  images_cached: false,
                  last_synced: new Date().toISOString(),
                }))
                await readingDb.articles.bulkPut(cached)
              })
              .catch(() => { /* widget still works from cache */ })
          }
        }
      } catch { /* silent — cached state already painted */ }

      if (!cancelled) setLoaded(true)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [])

  // Queue the action in Dexie's `operations` table so it gets replayed
  // when we're next online. Used for: offline at request time, network
  // error mid-request. Local state has already been updated optimistically;
  // this just ensures the server eventually catches up.
  const queueOp = useCallback(async (
    action: string,
    itemId: string,
    extra?: Record<string, unknown>,
  ) => {
    try {
      await readingDb.operations.add({
        type: 'consuming-action',
        table: 'reading_queue',
        action,
        item_id: itemId,
        extra: extra ?? null,
        timestamp: Date.now(),
        retries: 0,
      })
    } catch { /* queue full / blocked is non-fatal */ }
  }, [])

  const callConsumingAction = useCallback(async (
    action: 'dismiss' | 'save' | 'archive' | 'pin' | 'restore-dismiss' | 'restore-archive',
    id: string,
    extra?: Record<string, unknown>,
  ) => {
    // Offline at request time -> queue directly.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await queueOp(action, id, extra)
      return
    }
    try {
      const res = await fetch(`/api/reading?resource=consuming&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...(extra ?? {}) }),
      })
      // 5xx -> queue and retry later. 4xx -> drop (caller error or stale state).
      if (!res.ok && res.status >= 500) {
        await queueOp(action, id, extra)
      }
    } catch {
      // Network failure (DNS, CORS, fetch threw) — queue for retry.
      await queueOp(action, id, extra)
    }
  }, [queueOp])

  // Drain queued ops when online. Called on mount + every 'online' event.
  // Operations run in insertion order so dependent actions stay coherent
  // (e.g. archive then restore-archive on the same item replays in order).
  const replayQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    let ops: any[] = []
    try {
      ops = await readingDb.operations
        .where('type').equals('consuming-action')
        .sortBy('timestamp')
    } catch { return }
    for (const op of ops) {
      try {
        const body = JSON.stringify({ id: op.item_id, ...(op.extra ?? {}) })
        const res = await fetch(`/api/reading?resource=consuming&action=${op.action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        if (res.ok || res.status === 204) {
          await readingDb.operations.delete(op.id)
        } else if (res.status >= 400 && res.status < 500) {
          // 4xx is non-retryable (likely stale item id) — drop.
          await readingDb.operations.delete(op.id)
        } else if ((op.retries ?? 0) >= 3) {
          // Give up after 3 server-error retries.
          await readingDb.operations.delete(op.id)
        } else {
          await readingDb.operations.update(op.id, { retries: (op.retries ?? 0) + 1 })
        }
      } catch {
        // Lost network mid-drain — stop and leave the rest queued.
        break
      }
    }
  }, [])

  // Replay on mount + on 'online' transitions. Listener separate from the
  // isOnline state effect so the drain has its own concern.
  useEffect(() => {
    replayQueue()
    const onOnline = () => { replayQueue() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [replayQueue])

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
  // The reader's GET /api/reading?id= auto-promotes unread -> reading by
  // default, which would silently push the article into Saved even when
  // we explicitly blocked the save at cap. So at cap we pass
  // ?no_promote=true on the URL to honor the user's rule "archive one to
  // add a new one." The article stays in New reads; the user must
  // archive one to actually keep it.
  const openNewRead = useCallback((article: ConsumingArticle) => {
    const atCap = saved.length >= SAVED_CAP
    const saveSucceeded = saveNew(article)
    const suffix = !saveSucceeded && atCap ? '?no_promote=true' : ''
    navigate(`/reading/${article.id}${suffix}`)
  }, [saveNew, navigate, saved.length])

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
    if (loadingMore || nextOffset == null || !isOnline) return
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
  }, [loadingMore, nextOffset, isOnline])

  // Persist state to Dexie on changes so offline / cold-start visits paint
  // the user's most recent actions, not just the last server snapshot.
  // Side effects (network POSTs) silently fail offline and get reconciled
  // when the network refetch overwrites cache on next online visit.
  useEffect(() => {
    if (!loaded) return
    readingDb.cacheDashboard(CONSUMING_CACHE_KEY, {
      saved,
      new: feedReads,
      recently_dismissed: recentlyDismissed,
      recently_archived: recentlyArchived,
      new_has_more: hasMore,
      new_next_offset: nextOffset,
      activeItems,
    }).catch(() => { /* cache write failure is non-critical */ })
  }, [loaded, saved, feedReads, recentlyDismissed, recentlyArchived, hasMore, nextOffset, activeItems])

  // Loading state — render a low-key skeleton so the "now consuming"
  // section header in HomePage doesn't sit above empty air for the ~500ms
  // before the network resolves. The skeleton mirrors the eventual card
  // dimensions so the page doesn't reflow when content arrives.
  if (!loaded) {
    return (
      <section className="pb-8">
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.025), rgba(15,24,41,0.35))',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="px-4 py-3.5 min-h-[60px] border-b border-white/[0.04]">
            <div className="h-3 w-1/2 rounded shimmer" />
            <div className="h-2 w-1/3 rounded shimmer mt-2 opacity-60" />
          </div>
          <div className="px-4 py-3 min-h-[44px]">
            <div className="h-3 w-1/4 rounded shimmer opacity-60" />
          </div>
        </div>
      </section>
    )
  }

  const hasAnything = activeItems.length > 0 || saved.length > 0 || feedReads.length > 0
  // Zero-state with no feeds: show a minimal CTA so the user can subscribe.
  // Without this they'd see the "now consuming" header in HomePage with
  // nothing below it.
  if (!hasAnything && feeds.length === 0) {
    return (
      <section className="pb-8">
        <div
          className="relative rounded-2xl overflow-hidden p-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.035), rgba(15,24,41,0.45))',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p className="text-[14px] text-[var(--brand-text-secondary)] mb-3">
            Subscribe to a feed to start seeing headlines here.
          </p>
          <button
            type="button"
            onClick={() => setAddFeedOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-[13px] font-medium text-[var(--brand-text-primary)] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first feed
          </button>
        </div>
        <FeedSearchSheet
          open={addFeedOpen}
          onOpenChange={setAddFeedOpen}
          onSubscribed={() => fetchFeeds()}
        />
      </section>
    )
  }
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
                  {saved.map((article, idx) => (
                    <motion.div
                      key={article.id}
                      layout
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, x: -200 }}
                      transition={{ duration: 0.18 }}
                    >
                      <SwipeableArticleRow
                        article={article}
                        showHint={swipeHintArmed && openSaved && idx === 0}
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
                {!isOnline && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-200/80">
                    <WifiOff className="h-3.5 w-3.5" />
                    <span>You're offline — showing the last cached batch.</span>
                  </div>
                )}
                <AnimatePresence initial={false} mode="popLayout">
                  {feedReads.map((article, idx) => (
                    <motion.div
                      key={article.id}
                      layout
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, x: -200 }}
                      transition={{ duration: 0.18 }}
                    >
                      <SwipeableArticleRow
                        article={article}
                        showHint={swipeHintArmed && openNew && !openSaved && idx === 0}
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
                    disabled={loadingMore || !isOnline}
                    className="w-full px-4 py-3 text-[12px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] hover:bg-white/[0.025] disabled:opacity-50 transition-colors border-t border-white/[0.04]"
                  >
                    {!isOnline ? 'Offline — connect to fetch more' : loadingMore ? 'Loading…' : 'Load more'}
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

        {/* Widget footer — quick "+ Add feed" opens the inline sheet,
            "All reading" jumps to /reading (queue / unread / archived
            tabs), "Manage" goes to /rss for unsubscribe / toggle. Always
            visible when the widget renders. */}
        <div className="flex items-center border-t border-white/[0.04]">
          <button
            type="button"
            onClick={() => setAddFeedOpen(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] opacity-70 hover:opacity-100 hover:bg-white/[0.025] transition-all"
          >
            <Plus className="h-3 w-3" />
            <span>Add feed</span>
          </button>
          <div className="h-5 w-px bg-white/[0.05]" aria-hidden />
          <Link
            to="/reading"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] opacity-70 hover:opacity-100 hover:bg-white/[0.025] transition-all"
          >
            <span>All reading</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
          <div className="h-5 w-px bg-white/[0.05]" aria-hidden />
          <Link
            to="/rss"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] opacity-70 hover:opacity-100 hover:bg-white/[0.025] transition-all"
          >
            <Settings2 className="h-3 w-3" />
            <span>Manage</span>
          </Link>
        </div>
      </div>

      <FeedSearchSheet
        open={addFeedOpen}
        onOpenChange={setAddFeedOpen}
        onSubscribed={() => {
          // Refresh the consuming surface so newly-subscribed items appear.
          // A second-level effect would handle this cleaner; for now just
          // a soft refetch via the existing endpoint.
          fetch('/api/reading?resource=consuming').then(async (res) => {
            if (!res.ok) return
            const data = await res.json()
            setSaved(data.saved ?? saved)
            setFeedReads(data.new ?? feedReads)
            setHasMore(!!data.new_has_more)
            setNextOffset(data.new_next_offset ?? null)
          }).catch(() => {})
        }}
      />
    </section>
  )
}
