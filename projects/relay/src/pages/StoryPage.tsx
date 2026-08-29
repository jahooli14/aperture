import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { LineList, type ViewMode } from '../components/LineList'
import { Composer } from '../components/Composer'
import { InviteSheet } from '../components/InviteSheet'
import { StoryStats } from '../components/StoryStats'
import { IndexSheet } from '../components/IndexSheet'
import { StoryToolbar } from '../components/StoryToolbar'
import { queueLine } from '../lib/outbox'
import { useOutbox, useReadPosition, useTimezoneSync } from '../lib/story-hooks'
import type { IndexEntry, Line, StoryDetail } from '../lib/types'

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
  const [search, setSearch] = useState('')
  const [indexNames, setIndexNames] = useState<IndexEntry[]>([])
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

  // Names the index already knows, so they can be tapped in the prose without
  // opening the sheet. Absent index or no key: nothing changes.
  useEffect(() => {
    if (!id) return
    api
      .getIndex(id)
      .then(({ index }) => setIndexNames(index ? [...index.people, ...index.places] : []))
      .catch(() => setIndexNames([]))
  }, [id])

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

  const [queued, setQueued] = useOutbox(id, load)

  const readPosition = detail?.members.find((m) => m.user_id === userId)?.last_read_position ?? 0
  useReadPosition(id, lines, readPosition)
  useTimezoneSync(id)

  useEffect(() => {
    if (lines.length === 0 || hasScrolled.current) return
    hasScrolled.current = true
    endRef.current?.scrollIntoView()
  }, [lines])

  const visibleLines = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (needle.length < 2) return lines
    return lines.filter((line) => line.body.toLowerCase().includes(needle))
  }, [lines, search])

  /**
   * The line appears the moment you send it and the turn moves with it. If the
   * send fails the placeholder is pulled back out; if it failed because there
   * was no connection, the line is kept and goes out when there is one.
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
      setQueued(null)
    } catch (e) {
      setLines((current) => current.filter((item) => item.id !== placeholderId))
      setDetail((current) => (current ? { ...current, can_write: true } : current))
      if (!navigator.onLine) {
        queueLine({ storyId: id, body, chapterTitle })
        setQueued(body)
        return
      }
      throw e
    } finally {
      void load()
    }
  }

  async function mark(line: Line) {
    if (!id) return
    setLines((current) =>
      current.map((item) =>
        item.id === line.id
          ? {
              ...item,
              marked_by_me: !item.marked_by_me,
              marks: (item.marks ?? 0) + (item.marked_by_me ? -1 : 1),
            }
          : item
      )
    )
    await api.markLine(id, line.id).catch(() => void load())
  }

  async function edit(line: Line) {
    if (!id) return
    const next = window.prompt('Fix your line', line.body)
    if (next === null || !next.trim() || next === line.body) return
    try {
      const { line: updated } = await api.editLine(id, line.id, next.trim())
      setLines((current) => current.map((item) => (item.id === line.id ? { ...item, ...updated } : item)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not edit that line')
    }
  }

  function jumpToLine(position: number) {
    setSheet('none')
    setSearch('')
    setLandedOn(position)
    requestAnimationFrame(() => {
      document.getElementById(`line-${position}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setTimeout(() => setLandedOn(null), 2600)
  }

  if (error && !detail) return <Shell title="Story"><p className="px-4 py-10 text-sm text-red-700 dark:text-red-400">{error}</p></Shell>
  if (!detail) return <Shell title="Story"><p className="px-4 py-10 text-sm text-muted">Loading…</p></Shell>

  const { story, members, stats, whose_turn, can_write } = detail
  const upNext = members.find((m) => m.user_id === whose_turn)
  const waitingOn = can_write ? null : upNext ? upNext.display_name : null
  const isOwner = members.find((m) => m.user_id === userId)?.role === 'owner'
  const lastLine = lines[lines.length - 1] ?? null
  const unread = lastLine && readPosition > 0 && lastLine.position > readPosition ? readPosition + 1 : null

  return (
    <div className="flex min-h-dvh flex-col">
      <StoryToolbar
        title={story.title}
        canWrite={can_write}
        waitingOn={waitingOn}
        mode={mode}
        onModeChange={setMode}
        search={search}
        onSearchChange={setSearch}
        matchCount={search.trim().length >= 2 ? visibleLines.length : null}
        onOpenSheet={setSheet}
      />

      {unread && !search && (
        <button className="resume" onClick={() => jumpToLine(unread)}>
          Pick up where you left off — line {unread}
        </button>
      )}

      {error && <p className="mx-auto max-w-reading px-4 pt-3 text-sm text-red-700 dark:text-red-400">{error}</p>}

      <main className="mx-auto w-full max-w-reading flex-1 px-4 pb-4">
        <LineList
          lines={visibleLines}
          members={members}
          mode={mode}
          currentUserId={userId}
          landedOn={landedOn}
          highlight={search}
          indexNames={indexNames}
          onMark={mark}
          onEdit={edit}
          onOpenName={() => setSheet('index')}
        />
        <div ref={endRef} className="h-2" />
      </main>

      <div className="sticky bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-reading">
          <Composer
            storyId={story.id}
            canWrite={can_write}
            waitingOn={waitingOn}
            queuedBody={queued}
            previousLine={lastLine ? { body: lastLine.body, display_name: lastLine.display_name } : null}
            onSubmit={addLine}
          />
          {!can_write && story.turn_mode === 'rotation' && (
            <button
              className="mx-auto mb-3 block text-xs text-faint underline hover:text-ink"
              onClick={async () => {
                await api.skipTurn(story.id).catch(() => {})
                void load()
              }}
            >
              They're away — skip their turn
            </button>
          )}
        </div>
      </div>

      {sheet === 'writers' && (
        <InviteSheet story={story} members={members} isOwner={isOwner} onClose={() => setSheet('none')} />
      )}
      {sheet === 'stats' && (
        <StoryStats
          stats={stats}
          members={members}
          lines={lines}
          printHref={`/story/${story.id}/print`}
          onJumpToChapter={jumpToLine}
          onClose={() => setSheet('none')}
        />
      )}
      {sheet === 'index' && id && (
        <IndexSheet storyId={id} onJumpToLine={jumpToLine} onClose={() => setSheet('none')} />
      )}
    </div>
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
