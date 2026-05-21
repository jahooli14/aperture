/**
 * FeedsPage — RSS feed management.
 *
 * Lists current subscriptions with enable/disable toggle and unsubscribe.
 * "Add feed" button opens the FeedSearchSheet (shared with the home
 * Consuming widget's inline add affordance).
 *
 * Lives at /rss to match the existing "Manage feeds" link in ReadingPage.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Rss, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { useRSSStore } from '../stores/useRSSStore'
import { useToast } from '../components/ui/toast'
import { useConfirmDialog } from '../components/ui/confirm-dialog'
import { FeedSearchSheet } from '../components/reading/FeedSearchSheet'
import { SubtleBackground } from '../components/SubtleBackground'
import { format } from 'date-fns'

export function FeedsPage() {
  const navigate = useNavigate()
  const { feeds, loading, fetchFeeds, updateFeed, unsubscribeFeed, syncFeeds, syncing } = useRSSStore()
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    fetchFeeds()
  }, [fetchFeeds])

  const handleToggle = async (id: string, enabled: boolean) => {
    setPendingId(id)
    try {
      await updateFeed({ id, enabled: !enabled })
    } catch (e) {
      addToast({
        title: 'Could not update feed',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      })
    } finally {
      setPendingId(null)
    }
  }

  const handleUnsubscribe = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'Unsubscribe?',
      description: `${title} will be removed. Articles already in your queue stay.`,
      confirmText: 'Unsubscribe',
      variant: 'destructive',
    })
    if (!ok) return
    try {
      await unsubscribeFeed(id)
      addToast({ title: 'Unsubscribed', variant: 'success' })
    } catch (e) {
      addToast({
        title: 'Could not unsubscribe',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      })
    }
  }

  const handleSync = async () => {
    try {
      const result = await syncFeeds()
      addToast({
        title: 'Synced',
        description: `${result.articlesAdded} new article${result.articlesAdded === 1 ? '' : 's'}`,
        variant: 'success',
      })
    } catch (e) {
      addToast({
        title: 'Sync failed',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <SubtleBackground />
      <div className="min-h-screen pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-3">
          <header className="page-masthead">
            <div className="page-masthead-text">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-[var(--brand-text-muted)] hover:text-[var(--brand-text-secondary)] transition-colors mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <h1 className="page-hero">Feeds.</h1>
              <div className="page-eyebrow">
                {feeds.length} subscribed
              </div>
            </div>
            <div className="page-masthead-actions">
              <button
                onClick={handleSync}
                disabled={syncing || feeds.length === 0}
                aria-label="Sync feeds"
                title="Sync feeds"
                className="masthead-action press-spring disabled:opacity-50"
              >
                <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setSheetOpen(true)}
                aria-label="Add feed"
                className="masthead-action press-spring"
                style={{
                  background: 'rgba(var(--brand-primary-rgb), 0.12)',
                  borderColor: 'rgba(var(--brand-primary-rgb), 0.35)',
                }}
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </header>

          {loading && feeds.length === 0 && (
            <div className="flex items-center gap-2 text-[13px] text-[var(--brand-text-muted)] py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading feeds…</span>
            </div>
          )}

          {!loading && feeds.length === 0 && (
            <div className="text-center py-16 px-4">
              <Rss className="h-10 w-10 mx-auto text-[var(--brand-text-muted)] opacity-40 mb-4" />
              <h3 className="page-hero-sm mb-2">No feeds yet.</h3>
              <p className="text-sm text-[var(--brand-text-muted)] leading-relaxed mb-6">
                Subscribe to a few sources and they'll show up in <em>now consuming</em> on the home.
              </p>
              <button
                onClick={() => setSheetOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-primary text-[var(--brand-text-primary)] font-medium"
              >
                <Plus className="h-4 w-4" />
                Add your first feed
              </button>
            </div>
          )}

          {feeds.length > 0 && (
            <ul className="space-y-2 mt-4">
              {feeds.map(feed => {
                const isPending = pendingId === feed.id
                const lastFetched = feed.last_fetched_at
                  ? format(new Date(feed.last_fetched_at), "MMM d, h:mm a")
                  : 'never'
                return (
                  <li
                    key={feed.id}
                    className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.025] border border-white/[0.05]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] font-medium truncate ${feed.enabled ? 'text-[var(--brand-text-primary)]' : 'text-[var(--brand-text-muted)] line-through'}`}>
                        {feed.title}
                      </p>
                      {feed.description && (
                        <p className="text-[12px] text-[var(--brand-text-muted)] mt-0.5"
                           style={{
                             display: '-webkit-box',
                             WebkitLineClamp: 2,
                             WebkitBoxOrient: 'vertical',
                             overflow: 'hidden',
                           }}
                        >
                          {feed.description}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--brand-text-muted)] opacity-60 mt-1 truncate">
                        Last synced {lastFetched}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Enable / disable toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(feed.id, feed.enabled)}
                        disabled={isPending}
                        aria-label={feed.enabled ? 'Pause feed' : 'Resume feed'}
                        className="relative inline-flex items-center h-6 w-11 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                        style={{
                          background: feed.enabled ? 'rgba(var(--brand-primary-rgb), 0.5)' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <span
                          className="absolute h-5 w-5 rounded-full bg-white transition-transform"
                          style={{
                            transform: feed.enabled ? 'translateX(22px)' : 'translateX(2px)',
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnsubscribe(feed.id, feed.title)}
                        aria-label="Unsubscribe"
                        className="h-8 w-8 rounded-md flex items-center justify-center text-[var(--brand-text-muted)] hover:text-red-400 hover:bg-white/[0.05] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <FeedSearchSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubscribed={() => fetchFeeds()}
      />
      {confirmDialog}
    </>
  )
}
