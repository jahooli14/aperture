import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { LineList, type ViewMode } from '../components/LineList'
import { Composer } from '../components/Composer'
import { InviteSheet } from '../components/InviteSheet'
import { StoryStats } from '../components/StoryStats'
import { IndexSheet } from '../components/IndexSheet'
import type { Line, StoryDetail } from '../lib/types'

const VIEW_MODE_KEY = 'relay:view-mode'
type Sheet = 'none' | 'writers' | 'stats' | 'index'

export default function StoryPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const userId = session?.user?.id ?? ''

  const [detail, setDetail] = useState<StoryDetail | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>('none')
  const [landedOn, setLandedOn] = useState<number | null>(null)
  const [mode, setMode] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'thread'
  )

  const endRef = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [storyDetail, { lines: loaded }] = await Promise.all([api.getStory(id), api.listLines(id)])
      setDetail(storyDetail)
      setLines(loaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that story')
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Realtime is a nudge, not a source of truth: a new row means "go and look",
  // and the API stays the only thing that decides what you're allowed to see.
  useEffect(() => {
    if (!id) return
    const channel = supabase
      .channel(`story-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'relay', table: 'lines', filter: `story_id=eq.${id}` },
        () => void load()
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [id, load])

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }, [mode])

  useEffect(() => {
    if (lines.length === 0 || hasScrolled.current) return
    hasScrolled.current = true
    endRef.current?.scrollIntoView()
  }, [lines])

  /**
   * The line appears the moment you send it, and the turn moves on with it.
   * Waiting for the server before showing your own words is what makes a
   * writing app feel like paperwork. If the send fails the placeholder is
   * pulled back out and the Composer puts your text back in the box.
   */
  async function addLine(body: string, chapterTitle?: string) {
    if (!id) return

    const placeholderId = `pending-${Date.now()}`
    const optimistic: Line = {
      id: placeholderId,
      author_id: userId,
      body,
      position: (lines[lines.length - 1]?.position ?? 0) + 1,
      created_at: new Date().toISOString(),
      chapter_title: chapterTitle ?? null,
      display_name: 'You',
      pending: true,
    }

    setLines((current) => [...current, optimistic])
    setDetail((current) => (current ? { ...current, can_write: false } : current))
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))

    try {
      const { line } = await api.addLine(id, body, chapterTitle)
      setLines((current) => current.map((item) => (item.id === placeholderId ? line : item)))
    } catch (e) {
      setLines((current) => current.filter((item) => item.id !== placeholderId))
      setDetail((current) => (current ? { ...current, can_write: true } : current))
      throw e
    } finally {
      void load()
    }
  }

  async function skip() {
    if (!id) return
    await api.skipTurn(id).catch(() => {})
    void load()
  }

  function jumpToLine(position: number) {
    setSheet('none')
    setLandedOn(position)
    requestAnimationFrame(() => {
      document.getElementById(`line-${position}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setTimeout(() => setLandedOn(null), 2600)
  }

  if (error) {
    return <Shell title="Story"><p className="px-4 py-10 text-sm text-red-700 dark:text-red-400">{error}</p></Shell>
  }
  if (!detail) {
    return <Shell title="Story"><p className="px-4 py-10 text-sm text-muted">Loading…</p></Shell>
  }

  const { story, members, stats, whose_turn, can_write } = detail
  const upNext = members.find((m) => m.user_id === whose_turn)
  const waitingOn = can_write ? null : upNext ? upNext.display_name : null
  const isOwner = members.find((m) => m.user_id === userId)?.role === 'owner'
  const lastLine = lines[lines.length - 1] ?? null

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/92 backdrop-blur">
        <div className="mx-auto max-w-reading px-4">
          <div className="flex items-center gap-3 pb-2 pt-3">
            <Link to="/" aria-label="All stories" className="-ml-1 p-1 text-muted hover:text-ink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <h1 className="display min-w-0 flex-1 truncate text-lg font-semibold">{story.title}</h1>
            {can_write ? (
              <span className="pill" style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-ink))' }}>
                Your turn
              </span>
            ) : (
              <span className="pill border border-rule text-muted">{waitingOn ?? 'Anyone'}</span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pb-2.5">
            <div className="segmented" role="group" aria-label="How to view the story">
              <button aria-pressed={mode === 'thread'} onClick={() => setMode('thread')}>Thread</button>
              <button aria-pressed={mode === 'read'} onClick={() => setMode('read')}>Read</button>
            </div>
            <div className="flex items-center gap-1">
              <HeaderLink onClick={() => setSheet('index')}>Index</HeaderLink>
              <HeaderLink onClick={() => setSheet('stats')}>So far</HeaderLink>
              <HeaderLink onClick={() => setSheet('writers')}>Writers</HeaderLink>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-reading flex-1 px-4 pb-4">
        <LineList
          lines={lines}
          members={members}
          mode={mode}
          currentUserId={userId}
          landedOn={landedOn}
        />
        <div ref={endRef} className="h-2" />
      </main>

      <div className="sticky bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-reading">
          <Composer
            canWrite={can_write}
            waitingOn={waitingOn}
            previousLine={lastLine ? { body: lastLine.body, display_name: lastLine.display_name } : null}
            onSubmit={addLine}
          />
          {!can_write && story.turn_mode === 'rotation' && (
            <button className="mx-auto mb-3 block text-xs text-faint underline hover:text-ink" onClick={skip}>
              They're away — skip their turn
            </button>
          )}
        </div>
      </div>

      {sheet === 'writers' && (
        <InviteSheet story={story} members={members} isOwner={isOwner} onClose={() => setSheet('none')} />
      )}
      {sheet === 'stats' && (
        <StoryStats stats={stats} members={members} onJumpToChapter={jumpToLine} onClose={() => setSheet('none')} />
      )}
      {sheet === 'index' && id && (
        <IndexSheet storyId={id} onJumpToLine={jumpToLine} onClose={() => setSheet('none')} />
      )}
    </div>
  )
}

function HeaderLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded px-2 py-1.5 text-xs font-medium text-muted hover:text-ink">
      {children}
    </button>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-rule bg-paper/92 backdrop-blur">
        <div className="mx-auto flex max-w-reading items-center gap-3 px-4 py-3">
          <Link to="/" aria-label="Back" className="-ml-1 p-1 text-muted hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="display text-lg font-semibold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-reading">{children}</main>
    </div>
  )
}
