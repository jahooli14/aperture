import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ViewMode } from './LineList'

/**
 * The story's header: whose turn it is, which view you're in, and the ways
 * into the sheets. Search collapses into an icon until you want it, because
 * a search field sitting open is a search field always slightly in the way.
 */
export function StoryToolbar({
  title,
  canWrite,
  waitingOn,
  mode,
  onModeChange,
  search,
  onSearchChange,
  matchCount,
  onOpenSheet,
}: {
  title: string
  canWrite: boolean
  waitingOn: string | null
  mode: ViewMode
  onModeChange: (mode: ViewMode) => void
  search: string
  onSearchChange: (value: string) => void
  matchCount: number | null
  onOpenSheet: (sheet: 'writers' | 'stats' | 'index') => void
}) {
  const [searching, setSearching] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-paper/92 backdrop-blur">
      <div className="mx-auto max-w-reading px-4">
        <div className="flex items-center gap-3 pb-2 pt-3">
          <Link to="/" aria-label="All stories" className="-ml-1 p-1 text-muted hover:text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="display min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
          {canWrite ? (
            <span className="pill" style={{ background: 'rgb(var(--accent))', color: 'rgb(var(--accent-ink))' }}>
              Your turn
            </span>
          ) : (
            <span className="pill border border-rule text-muted">{waitingOn ?? 'Anyone'}</span>
          )}
        </div>

        {searching ? (
          <div className="flex items-center gap-2 pb-2.5">
            <input
              autoFocus
              className="field py-2 text-sm"
              placeholder="Find a word, a name, a place…"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            {matchCount !== null && (
              <span className="whitespace-nowrap text-xs tabular-nums text-muted">
                {matchCount} {matchCount === 1 ? 'line' : 'lines'}
              </span>
            )}
            <button
              className="text-xs font-medium text-muted hover:text-ink"
              onClick={() => {
                onSearchChange('')
                setSearching(false)
              }}
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pb-2.5">
            <div className="segmented" role="group" aria-label="How to view the story">
              <button aria-pressed={mode === 'thread'} onClick={() => onModeChange('thread')}>
                Thread
              </button>
              <button aria-pressed={mode === 'read'} onClick={() => onModeChange('read')}>
                Read
              </button>
            </div>
            <div className="flex items-center gap-0.5">
              <ToolbarButton onClick={() => setSearching(true)} label="Search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                </svg>
              </ToolbarButton>
              <ToolbarButton onClick={() => onOpenSheet('index')}>Index</ToolbarButton>
              <ToolbarButton onClick={() => onOpenSheet('stats')}>So far</ToolbarButton>
              <ToolbarButton onClick={() => onOpenSheet('writers')}>Writers</ToolbarButton>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

function ToolbarButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="whitespace-nowrap rounded px-2 py-1.5 text-xs font-medium text-muted hover:text-ink"
    >
      {children}
    </button>
  )
}
