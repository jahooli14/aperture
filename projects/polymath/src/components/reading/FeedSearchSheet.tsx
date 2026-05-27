/**
 * Feed search sheet — mobile bottom sheet for subscribing to RSS feeds.
 *
 * Search-first: type a publication name or topic (e.g. "tldr", "design")
 * and we hit the Feedly discover endpoint. Tap a result to subscribe.
 * If the input looks like a URL we subscribe to it directly without
 * waiting on search.
 *
 * Reused by FeedsPage and ConsumingWidget so both entry points open the
 * same UI.
 */
import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Loader2, Check, Rss } from 'lucide-react'
import { useRSSStore } from '../../stores/useRSSStore'
import { useToast } from '../ui/toast'
import { PRESET_FEEDS } from '../../types/rss'
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from '../ui/bottom-sheet'

interface DiscoverResult {
  title: string
  description?: string | null
  feed_url: string
  site_url?: string | null
  favicon_url?: string | null
  subscribers?: number
  topics?: string[]
}

function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^https?:\/\//i.test(trimmed)) return true
  // Also catch bare domains like "example.com/feed.xml"
  return /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(trimmed) && trimmed.includes('.')
}

function formatSubscribers(count?: number): string | null {
  if (!count || count < 100) return null
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M readers`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k readers`
  return `${count} readers`
}

interface FeedSearchSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubscribed?: () => void
}

export function FeedSearchSheet({ open, onOpenChange, onSubscribed }: FeedSearchSheetProps) {
  const subscribeFeed = useRSSStore(s => s.subscribeFeed)
  const discoverFeeds = useRSSStore(s => s.discoverFeeds)
  const existingFeeds = useRSSStore(s => s.feeds)
  const { addToast } = useToast()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DiscoverResult[]>([])
  const [searching, setSearching] = useState(false)
  const [subscribingUrl, setSubscribingUrl] = useState<string | null>(null)

  const trimmedQuery = query.trim()
  const queryIsUrl = looksLikeUrl(trimmedQuery)

  // Reset when closed so reopening doesn't show stale state.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
    }
  }, [open])

  // Debounced search. Skip if the input looks like a URL — Feedly won't
  // help there, the user can just hit Enter to subscribe directly.
  useEffect(() => {
    if (!trimmedQuery || queryIsUrl) {
      setResults([])
      setSearching(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await discoverFeeds(trimmedQuery)
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [trimmedQuery, queryIsUrl, discoverFeeds])

  const handleSubscribe = async (feedUrl: string) => {
    if (!feedUrl.trim()) return
    setSubscribingUrl(feedUrl)
    try {
      await subscribeFeed({ feed_url: feedUrl.trim() })
      addToast({ title: 'Subscribed', variant: 'success' })
      onSubscribed?.()
      onOpenChange(false)
    } catch (e) {
      addToast({
        title: 'Could not subscribe',
        description: e instanceof Error ? e.message : 'Try a different feed URL.',
        variant: 'destructive',
      })
    } finally {
      setSubscribingUrl(null)
    }
  }

  const existingUrls = new Set(existingFeeds.map(f => f.feed_url))

  // Group the verified preset feeds by category, preserving definition order.
  const presetGroups = useMemo(() => {
    const groups = new Map<string, typeof PRESET_FEEDS[number][]>()
    for (const feed of PRESET_FEEDS) {
      const list = groups.get(feed.category) ?? []
      list.push(feed)
      groups.set(feed.category, list)
    }
    return Array.from(groups.entries())
  }, [])

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>Add feed</BottomSheetTitle>
        </BottomSheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (queryIsUrl) handleSubscribe(trimmedQuery)
          }}
          className="space-y-4"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-text-muted)] opacity-70 pointer-events-none" />
            <input
              type="search"
              placeholder="Search — tldr, stratechery, design…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="w-full pl-10 pr-3 py-2.5 text-[15px] rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-muted)] focus:outline-none focus:border-white/[0.18]"
            />
          </div>

          <div className="min-h-[120px]">
            {queryIsUrl && (
              <button
                type="button"
                disabled={subscribingUrl === trimmedQuery}
                onClick={() => handleSubscribe(trimmedQuery)}
                className="flex items-start gap-3 w-full text-left p-3 rounded-lg bg-white/[0.025] hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
              >
                <div className="flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                  <Rss className="h-4 w-4 text-[var(--brand-text-secondary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-[var(--brand-text-primary)]">Subscribe to this URL</p>
                  <p className="text-[12px] text-[var(--brand-text-muted)] mt-0.5 truncate">{trimmedQuery}</p>
                </div>
                <div className="flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                  {subscribingUrl === trimmedQuery ? (
                    <Loader2 className="h-4 w-4 text-[var(--brand-text-secondary)] animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 text-[var(--brand-text-secondary)]" />
                  )}
                </div>
              </button>
            )}

            {!queryIsUrl && searching && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--brand-text-muted)] py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Searching…</span>
              </div>
            )}

            {!queryIsUrl && !searching && trimmedQuery && results.length === 0 && (
              <p className="text-[13px] text-[var(--brand-text-muted)] py-2">
                Nothing found for "{trimmedQuery}". Try a publication name, or paste the feed URL.
              </p>
            )}

            {!queryIsUrl && !searching && !trimmedQuery && (
              <div className="space-y-4 py-1">
                <p className="text-[12px] text-[var(--brand-text-muted)]">
                  Type a name above (tldr, stratechery, hacker news…) or paste a feed URL. Or pick from the curated list:
                </p>
                {presetGroups.map(([category, feeds]) => (
                  <div key={category} className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--brand-text-muted)] opacity-60 px-1">
                      {category}
                    </p>
                    {feeds.map((f) => {
                      const already = existingUrls.has(f.feed_url)
                      const isLoading = subscribingUrl === f.feed_url
                      return (
                        <button
                          key={f.feed_url}
                          type="button"
                          disabled={already || isLoading}
                          onClick={() => handleSubscribe(f.feed_url)}
                          className="flex items-start gap-3 w-full text-left p-3 rounded-lg bg-white/[0.025] hover:bg-white/[0.05] disabled:opacity-50 disabled:hover:bg-white/[0.025] transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[var(--brand-text-primary)] truncate">{f.title}</p>
                            <p className="text-[12px] text-[var(--brand-text-muted)] mt-0.5"
                               style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                              {f.description}
                            </p>
                          </div>
                          <div className="flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 text-[var(--brand-text-secondary)] animate-spin" />
                            ) : already ? (
                              <Check className="h-4 w-4 text-emerald-400" />
                            ) : (
                              <Plus className="h-4 w-4 text-[var(--brand-text-secondary)]" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}

            {!queryIsUrl && (
              <ul className="space-y-1.5">
                {results.map((r) => {
                  const already = existingUrls.has(r.feed_url)
                  const isLoading = subscribingUrl === r.feed_url
                  const subscribers = formatSubscribers(r.subscribers)
                  const host = r.site_url
                    ? r.site_url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
                    : null
                  return (
                    <li key={r.feed_url}>
                      <button
                        type="button"
                        disabled={already || isLoading}
                        onClick={() => handleSubscribe(r.feed_url)}
                        className="flex items-start gap-3 w-full text-left p-3 rounded-lg bg-white/[0.025] hover:bg-white/[0.05] disabled:opacity-50 disabled:hover:bg-white/[0.025] transition-colors"
                      >
                        <div className="flex-shrink-0 h-9 w-9 rounded-md overflow-hidden bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                          {r.favicon_url ? (
                            <img
                              src={r.favicon_url}
                              alt=""
                              className="h-full w-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          ) : (
                            <Rss className="h-4 w-4 text-[var(--brand-text-muted)] opacity-60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-[var(--brand-text-primary)] truncate">
                            {r.title}
                          </p>
                          {r.description && (
                            <p className="text-[12px] text-[var(--brand-text-muted)] mt-0.5"
                               style={{
                                 display: '-webkit-box',
                                 WebkitLineClamp: 2,
                                 WebkitBoxOrient: 'vertical',
                                 overflow: 'hidden',
                               }}
                            >
                              {r.description}
                            </p>
                          )}
                          {(host || subscribers) && (
                            <p className="text-[10px] text-[var(--brand-text-muted)] opacity-60 mt-1 truncate">
                              {host}
                              {host && subscribers && <span className="mx-1.5">·</span>}
                              {subscribers}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center bg-white/[0.04] border border-white/[0.06]">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 text-[var(--brand-text-secondary)] animate-spin" />
                          ) : already ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Plus className="h-4 w-4 text-[var(--brand-text-secondary)]" />
                          )}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </form>
      </BottomSheetContent>
    </BottomSheet>
  )
}
