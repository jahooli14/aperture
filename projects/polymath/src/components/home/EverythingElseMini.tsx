/**
 * EverythingElseMini — one swipeable row combining "still warm" (recently
 * touched) and "the queue" (pinned Up Next), replacing what used to be two
 * separate 2-up grid sections. Still warm first, then queue, so the more
 * immediately relevant projects come first without a swipe.
 *
 * Each card already carries its own category — "2d ago" vs "#1 in queue"
 * in the meta line, glass vs ghost material — so nothing extra (a tag
 * pill, an icon) is needed to tell the two groups apart.
 */

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useRecentNonPriorityProjects, useUpNextMiniProjects } from '../../stores/useProjectStore'
import { ProjectMiniCard } from './ProjectMiniCard'
import { ProjectIdeasHome } from './ProjectIdeasHome'

function relative(dateStr?: string): string {
  if (!dateStr) return 'not started yet'
  const ms = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(ms / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function EverythingElseMini() {
  const recent = useRecentNonPriorityProjects(2)
  const upNext = useUpNextMiniProjects().slice(0, 2)
  // "Suggest a project" was three taps down — behind the answer card's
  // "or steer it", then "browse the full deck" — which is a long way to
  // bury the harness's most distinctive move. It belongs at the end of
  // this row: you swipe past what already exists, and the last card is
  // the one that offers something that doesn't yet.
  //
  // Which also means this row is never empty, so there's no longer an
  // empty state to hide: a shelf with nothing warm on it is exactly when
  // a suggestion is worth the most.
  const [showIdeas, setShowIdeas] = useState(false)

  return (
    <div className="space-y-3">
    // scroll-pl-4 matters: with `snap-mandatory`, the browser snaps the
    // first card's start edge to the SCROLLPORT edge, which ignores
    // padding-left — so the row's px-4 got eaten and card one sat flush
    // against the screen. scroll-padding moves the snap line itself.
    // items-stretch + h-full on the card (not just the wrapper) is what
    // keeps a 2-line title and a 1-line title the same height; without it
    // the wrapper stretched but the card inside stayed content-sized.
    <div className="flex items-stretch gap-3 overflow-x-auto pb-2 -mx-4 px-4 scroll-pl-4 scroll-pr-4 snap-x snap-mandatory scrollbar-hide">
      {recent.map(p => (
        <div key={p.id} className="flex-shrink-0 w-[70vw] max-w-[260px] snap-start flex">
          <ProjectMiniCard project={p} variant="glass" meta={relative(p.last_active || p.updated_at)} />
        </div>
      ))}
      {upNext.map(p => (
        <div key={p.id} className="flex-shrink-0 w-[70vw] max-w-[260px] snap-start flex">
          <ProjectMiniCard
            project={p}
            variant="ghost"
            meta={p.up_next_position != null ? `#${p.up_next_position} in queue` : 'in queue'}
          />
        </div>
      ))}

      {/* Dashed rather than glass or ghost: the other cards are projects
          that exist, this one isn't a project at all yet. */}
      <div className="flex-shrink-0 w-[70vw] max-w-[260px] snap-start flex">
        <button
          onClick={() => setShowIdeas(v => !v)}
          aria-expanded={showIdeas}
          className="w-full h-full rounded-2xl px-4 py-4 text-left flex flex-col justify-between transition-colors"
          style={{
            border: '1px dashed rgba(var(--brand-primary-rgb), 0.30)',
            background: showIdeas ? 'rgba(var(--brand-primary-rgb), 0.06)' : 'transparent',
          }}
        >
          <Sparkles size={16} style={{ color: 'rgba(var(--brand-primary-rgb), 0.75)' }} />
          <span className="text-[15px] leading-snug font-medium">
            {showIdeas ? 'Hide suggestions' : 'Suggest a project'}
          </span>
        </button>
      </div>
        </div>

        {showIdeas && <ProjectIdeasHome startExpanded />}
    </div>
  )
}
