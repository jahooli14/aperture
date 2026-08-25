import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { PageHeader } from '../components/PageHeader'
import { LineList, type ViewMode } from '../components/LineList'
import { Composer } from '../components/Composer'
import { InviteSheet } from '../components/InviteSheet'
import { StoryStats } from '../components/StoryStats'
import type { Line, StoryDetail } from '../lib/types'

const VIEW_MODE_KEY = 'relay:view-mode'

export default function StoryPage() {
  const { id } = useParams<{ id: string }>()
  const { session } = useAuth()
  const userId = session?.user?.id ?? ''

  const [detail, setDetail] = useState<StoryDetail | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'none' | 'writers' | 'stats'>('none')
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

  async function addLine(body: string, chapterTitle?: string) {
    if (!id) return
    const { line } = await api.addLine(id, body, chapterTitle)
    setLines((current) => [...current, line])
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
    void load()
  }

  async function skip() {
    if (!id) return
    await api.skipTurn(id).catch(() => {})
    void load()
  }

  function jumpToChapter(position: number) {
    setSheet('none')
    requestAnimationFrame(() => {
      document.getElementById(`line-${position}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  if (error) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Story" back="/" />
        <p className="mx-auto max-w-reading px-4 py-8 text-sm text-red-700 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Story" back="/" />
        <p className="mx-auto max-w-reading px-4 py-8 text-sm text-muted">Loading…</p>
      </div>
    )
  }

  const { story, members, stats, whose_turn, can_write } = detail
  const upNext = members.find((m) => m.user_id === whose_turn)
  const waitingOn = can_write ? null : upNext ? upNext.display_name : null
  const isOwner = members.find((m) => m.user_id === userId)?.role === 'owner'

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={story.title}
        back="/"
        subtitle={
          can_write ? (
            <span className="font-medium text-accent">Your turn</span>
          ) : waitingOn ? (
            `Waiting on ${waitingOn}`
          ) : (
            'Anyone can go next'
          )
        }
        actions={
          <div className="flex items-center gap-1">
            <button
              className="rounded px-2 py-1.5 text-xs text-muted hover:text-ink"
              onClick={() => setMode(mode === 'thread' ? 'read' : 'thread')}
            >
              {mode === 'thread' ? 'Read' : 'Thread'}
            </button>
            <button
              className="rounded px-2 py-1.5 text-xs text-muted hover:text-ink"
              onClick={() => setSheet('stats')}
            >
              So far
            </button>
            <button
              className="rounded px-2 py-1.5 text-xs text-muted hover:text-ink"
              onClick={() => setSheet('writers')}
            >
              Writers
            </button>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-reading flex-1 px-4">
        <LineList lines={lines} members={members} mode={mode} currentUserId={userId} />
        <div ref={endRef} className="h-2" />
      </main>

      <div className="sticky bottom-0 border-t border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto max-w-reading">
          <Composer canWrite={can_write} waitingOn={waitingOn} onSubmit={addLine} />
          {!can_write && story.turn_mode === 'rotation' && (
            <button
              className="mx-auto mb-3 block text-xs text-muted underline hover:text-ink"
              onClick={skip}
            >
              They're away — skip their turn
            </button>
          )}
        </div>
      </div>

      {sheet === 'writers' && (
        <InviteSheet
          story={story}
          members={members}
          isOwner={isOwner}
          onClose={() => setSheet('none')}
        />
      )}
      {sheet === 'stats' && (
        <StoryStats
          stats={stats}
          members={members}
          onJumpToChapter={jumpToChapter}
          onClose={() => setSheet('none')}
        />
      )}
    </div>
  )
}
