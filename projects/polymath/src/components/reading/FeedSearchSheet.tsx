/**
 * Feed search sheet — mobile bottom sheet for subscribing to RSS feeds.
 *
 * Search-first: type a topic (e.g. "design") and we hit the Feedly discover
 * endpoint. Tap a result to subscribe. URL-paste is tucked behind a small
 * disclosure for users who already know the feed URL.
 *
 * Reused by FeedsPage and ConsumingWidget so both entry points open the
 * same UI.
 */
import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Loader2, Link as LinkIcon, Check } from 'lucide-react'
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
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [subscribingUrl, setSubscribingUrl] = useState<string | null>(null)

  // Reset when closed so reopening doesn't show stale state.
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setShowUrlInput(false)
      setUrlValue('')
    }
  }, [open])

  // Debounced search.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await discoverFeeds(trimmed)
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query, discoverFeeds])

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

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--brand-text-muted)] opacity-70 pointer-events-none" />
            <input
              type="search"
              placeholder="Search by topic — design, climate, football…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-3 py-2.5 text-[15px] rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-muted)] focus:outline-none focus:border-white/[0.18]"
            />
          </div>

          <div className="min-h-[120px]">
            {searching && (
              <div className="flex items-center gap-2 text-[13px] text-[var(--brand-text-muted)] py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Searching…</span>
              </div>
            )}

            {!searching && query.trim() && results.length === 0 && (
              <p className="text-[13px] text-[var(--brand-text-muted)] py-2">
                Nothing found. Try a different word, or paste the feed URL below.
              </p>
            )}

            {!searching && !query.trim() && (
              <div className="space-y-4 py-1">
                <p className="text-[12px] text-[var(--brand-text-muted)]">
                  Suggested feeds — or search a topic above, or paste a URL below.
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

            <ul className="space-y-1.5">
              {results.map((r) => {
                const already = existingUrls.has(r.feed_url)
                const isLoading = subscribingUrl === r.feed_url
                return (
                  <li key={r.feed_url}>
                    <button
                      type="button"
                      disabled={already || isLoading}
                      onClick={() => handleSubscribe(r.feed_url)}
                      className="flex items-start gap-3 w-full text-left p-3 rounded-lg bg-white/[0.025] hover:bg-white/[0.05] disabled:opacity-50 disabled:hover:bg-white/[0.025] transition-colors"
                    >
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
                        {r.site_url && (
                          <p className="text-[10px] text-[var(--brand-text-muted)] opacity-60 mt-1 truncate">
                            {r.site_url.replace(/^https?:\/\//, '').replace(/^www\./, '')}
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
          </div>

          {/* URL paste — tucked behind a disclosure */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowUrlInput(v => !v)}
              className="flex items-center gap-2 text-[12px] text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] transition-colors"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              <span>{showUrlInput ? 'Hide URL input' : 'Got a feed URL?'}</span>
            </button>

            {showUrlInput && (
              <form
                onSubmit={(e) => { e.preventDefault(); handleSubscribe(urlValue) }}
                className="mt-3 flex gap-2"
              >
                <input
                  type="url"
                  placeholder="https://example.com/feed.xml"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  className="flex-1 px-3 py-2 text-[14px] rounded-lg bg-white/[0.04] border border-white/[0.08] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-text-muted)] focus:outline-none focus:border-white/[0.18]"
                />
                <button
                  type="submit"
                  disabled={!urlValue.trim() || subscribingUrl === urlValue.trim()}
                  className="px-4 py-2 text-[13px] font-medium rounded-lg bg-brand-primary text-[var(--brand-text-primary)] disabled:opacity-50 transition-opacity"
                >
                  {subscribingUrl === urlValue.trim() ? 'Adding…' : 'Add'}
                </button>
              </form>
            )}
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
