/**
 * Chat Primitives
 *
 * Shared building blocks for the two AI chat surfaces — Focus (portfolio
 * triage, home) and Guide (per-project). Both used to hand-roll the same
 * bubble/card/button markup with slightly different pixel values each
 * time; this file is the one place that visual language lives now, so a
 * change to how a proposal card looks only has to happen once.
 *
 * Deliberately just markup + style, no chat logic — each surface still
 * owns its own message state, API calls, and what a proposal means.
 */

import { type ReactNode } from 'react'
import { Check, X, Pencil, RotateCcw } from 'lucide-react'

/** The user's own message bubble — identical in both chats. */
export function UserBubble({ content, onEdit }: { content: string; onEdit?: () => void }) {
  return (
    <div className="flex justify-end group">
      {onEdit && (
        <button
          onClick={onEdit}
          aria-label="Edit and resend"
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity self-center mr-1.5 p-1 rounded-lg"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      <p
        className="text-[15px] leading-[1.65] px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%]"
        style={{ background: 'rgba(var(--brand-primary-rgb),0.08)', border: '1px solid rgba(var(--brand-primary-rgb),0.1)', color: 'var(--brand-text-primary)', opacity: 0.85 }}
      >
        {content}
      </p>
    </div>
  )
}

/** Confirm action — the one "do the thing" button every proposal card has.
 *  `destructive` swaps the accent color to the shared red used for delete/
 *  bury-style actions, so every irreversible action reads the same way. */
export function ConfirmButton({ onClick, disabled, destructive, busy, busyLabel, children }: {
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  busy?: boolean
  busyLabel?: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 min-h-[36px] px-3 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
      style={{
        background: destructive ? 'rgba(239,68,68,0.18)' : 'rgba(var(--brand-primary-rgb),0.18)',
        color: destructive ? 'rgb(248,113,113)' : 'rgb(var(--brand-primary-rgb))',
        border: `1px solid ${destructive ? 'rgba(239,68,68,0.4)' : 'rgba(var(--brand-primary-rgb),0.4)'}`,
      }}
    >
      {busy ? (busyLabel || 'Working…') : children}
    </button>
  )
}

/** Skip/dismiss — the quiet X that always sits to the left of Confirm. */
export function DismissButton({ onClick, ariaLabel = 'Skip' }: { onClick: () => void; ariaLabel?: string }) {
  return (
    <button
      onClick={onClick}
      className="h-9 w-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/[0.08] text-[var(--brand-text-muted)]"
      aria-label={ariaLabel}
    >
      <X className="h-4 w-4" />
    </button>
  )
}

/** A proposal that's been applied. */
export function ResolvedBadge({ children = 'Done' }: { children?: ReactNode }) {
  return (
    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--brand-text-muted)' }}>
      <Check className="h-3 w-3" /> {children}
    </span>
  )
}

/** A proposal the user skipped — shown collapsed to a single struck-through line. */
export function DismissedRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', opacity: 0.4 }}>
      <X className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--brand-text-muted)' }} />
      <p className="text-[12px] leading-snug line-through truncate" style={{ color: 'var(--brand-text-muted)' }}>{label}</p>
    </div>
  )
}

/** Outer card every live (not yet resolved/dismissed) proposal renders
 *  inside — task op, action, goal update, note. One background/border
 *  pair, `destructive` swaps it to the shared red. */
export function ProposalCard({ destructive, children }: { destructive?: boolean; children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 px-3 py-3 rounded-xl"
      style={{
        background: destructive ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${destructive ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {children}
    </div>
  )
}

/** Sits under the very last guide reply once it's fully settled — the only
 *  way to redo a reply that missed the mark used to be dismissing every
 *  card and retyping the whole message. */
export function RegenerateRow({ onRegenerate }: { onRegenerate: () => void }) {
  return (
    <button
      onClick={onRegenerate}
      className="flex items-center gap-1.5 px-1 py-1 rounded-lg transition-colors hover:bg-white/[0.05] text-[11px] font-medium"
      style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}
    >
      <RotateCcw className="h-3 w-3" /> Try again
    </button>
  )
}
