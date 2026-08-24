/**
 * AttentionSlot — the attention budget (SPEC.md).
 *
 * Five things can want the screen on open: a deferred close-out, the
 * monthly mirror, the live-project re-ask, a composite proposal, a morph
 * proposal, and today's spark. Five surfaces competing is how "guide, not
 * menu" dies, so this renders AT MOST ONE, in fixed priority order, and
 * whatever loses is not queued behind the winner -- it waits for another
 * day or is dropped, never stacks into a notification tray.
 *
 * Mounted on HomePage (additive, above the untouched old surface) because
 * that's what "on app open" actually means -- confining this to /session
 * would only fire it when the user was already about to start a session,
 * which defeats the point of a spark being the reward for opening the app
 * at all.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../../stores/useSessionStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { VoiceInput } from '../VoiceInput'

const secondaryTextStyle = { color: 'var(--brand-text-secondary)', opacity: 0.7 }
const borderStyle = { borderColor: 'var(--glass-border-bold)' }
const primaryButtonStyle = {
  background: 'rgba(var(--brand-primary-rgb), 0.12)',
  border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
  color: 'rgb(var(--brand-primary-rgb))',
}
const accentTextStyle = { color: 'rgb(var(--brand-primary-rgb))' }

type SlotKind = 'closeout' | 'mirror' | 'reask' | 'composite' | 'morph' | 'spark' | 'different-thing' | null

interface ReaskSuggestion {
  project_id: string
  title: string
}

interface MirrorRow {
  project_id: string
  title: string
  minutes: number
  is_live: boolean
}

interface Proposal {
  id: string
  kind: 'morph' | 'composite'
  project_id: string | null
  project_id_2: string | null
  proposed_text: string
}

interface Spark {
  id: string
  type: string
  text: string
  project_id: string | null
}

const MIRROR_SEEN_KEY_PREFIX = 'aperture-mirror-seen-'

function mirrorSeenThisMonth(): boolean {
  const key = MIRROR_SEEN_KEY_PREFIX + new Date().toISOString().slice(0, 7)
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return true // fail closed -- never nag if storage is unavailable
  }
}

function markMirrorSeen() {
  const key = MIRROR_SEEN_KEY_PREFIX + new Date().toISOString().slice(0, 7)
  try {
    localStorage.setItem(key, '1')
  } catch {
    // Storage unavailable -- the mirror will just show again next open, harmless.
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function MirrorSlot({ rows, onDismiss }: { rows: MirrorRow[]; onDismiss: () => void }) {
  const [missingText, setMissingText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const maxMinutes = Math.max(1, ...rows.map(r => r.minutes))

  const submitMissing = async () => {
    if (!missingText.trim()) return onDismiss()
    setSubmitting(true)
    try {
      // Free text -- the server parses which project and how long via
      // retro-parser.ts, so a correction like "did 2 hours on the decks
      // last night" lands on the right project with the right duration,
      // not a guessed one.
      await fetch('/api/sessions?resource=log-retro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: missingText }),
      })
    } finally {
      setSubmitting(false)
      onDismiss()
    }
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-base font-medium">This month</p>
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.project_id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{r.title}{r.is_live && <span style={accentTextStyle}> · live</span>}</span>
              <span className="tabular-nums">{Math.round(r.minutes / 60 * 10) / 10}h</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.minutes / maxMinutes) * 100}%`, background: 'rgb(var(--brand-primary-rgb))' }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm" style={secondaryTextStyle}>Anything missing?</p>
      <VoiceInput onTranscript={setMissingText} maxDuration={20} />
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={submitting}
          onClick={submitMissing}
        >
          {missingText ? 'Add it' : 'All good'}
        </button>
      </div>
    </div>
  )
}

function ProposalSlot({ proposal, onResolved }: { proposal: Proposal; onResolved: () => void }) {
  const [busy, setBusy] = useState(false)

  const act = async (action: 'accept' | 'reject') => {
    setBusy(true)
    try {
      await fetch(`/api/proposals?resource=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal_id: proposal.id }),
      })
    } finally {
      setBusy(false)
      onResolved()
    }
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-xs uppercase tracking-wide" style={{ ...secondaryTextStyle, opacity: 0.5 }}>
        {proposal.kind === 'morph' ? 'A shift, maybe' : 'A bridge, maybe'}
      </p>
      <p className="text-base">{proposal.proposed_text}</p>
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={busy}
          onClick={() => act('accept')}
        >
          Take it
        </button>
        <button
          className="flex-1 py-2 rounded-lg border text-sm disabled:opacity-50"
          style={borderStyle}
          disabled={busy}
          onClick={() => act('reject')}
        >
          That's not it
        </button>
      </div>
    </div>
  )
}

function SparkSlot({ spark, onResolved }: { spark: Spark; onResolved: () => void }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const respond = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/sparks?resource=respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spark_id: spark.id, response_text: text }),
      })
    } finally {
      setSubmitting(false)
      onResolved()
    }
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-base">{spark.text}</p>
      <VoiceInput onTranscript={setText} maxDuration={30} />
      {text && (
        <button
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={submitting}
          onClick={respond}
        >
          Done
        </button>
      )}
    </div>
  )
}

function ReaskSlot({ suggestion, onResolved }: { suggestion: ReaskSuggestion; onResolved: () => void }) {
  const { declareLive } = useSessionStore()
  const [busy, setBusy] = useState(false)

  const act = async (accept: boolean) => {
    setBusy(true)
    try {
      if (accept) await declareLive(suggestion.project_id)
    } finally {
      setBusy(false)
      onResolved()
    }
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-base">You've been on {suggestion.title}. Make that the live one?</p>
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={busy}
          onClick={() => act(true)}
        >
          Yes
        </button>
        <button
          className="flex-1 py-2 rounded-lg border text-sm disabled:opacity-50"
          style={borderStyle}
          disabled={busy}
          onClick={() => act(false)}
        >
          No, keep it as is
        </button>
      </div>
    </div>
  )
}

/**
 * The different-thing quota's nudge (SPEC.md). Lowest priority by design —
 * only ever shown when the spark generator had nothing (silence), and only
 * from day 20 of the month (different-thing.ts). Encouragement, not a
 * debt: no streak, no "you missed it" if the month runs out unused.
 */
function DifferentThingSlot({ onResolved }: { onResolved: () => void }) {
  const navigate = useNavigate()
  const projects = useProjectStore(s => s.projects)
  const candidates = projects.filter(p => p.state !== 'harvested' && p.state !== 'live').slice(0, 4)

  if (candidates.length === 0) return null

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-base">An hour on something you wouldn't usually do?</p>
      <div className="space-y-2">
        {candidates.map(p => (
          <button
            key={p.id}
            className="w-full text-left px-4 py-2 rounded-lg border text-sm"
            style={borderStyle}
            onClick={() => navigate(`/session?project_id=${p.id}&source=different-thing`)}
          >
            {p.title}
          </button>
        ))}
      </div>
      <button className="text-sm underline" style={accentTextStyle} onClick={onResolved}>
        Not today
      </button>
    </div>
  )
}

export function AttentionSlot() {
  const { pendingCloseout, checkPendingCloseout, closeoutForPending } = useSessionStore()
  const [kind, setKind] = useState<SlotKind>(null)
  const [mirrorRows, setMirrorRows] = useState<MirrorRow[]>([])
  const [reask, setReask] = useState<ReaskSuggestion | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [spark, setSpark] = useState<Spark | null>(null)
  const [closeoutText, setCloseoutText] = useState('')
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      await checkPendingCloseout()
      if (cancelled) return
      if (useSessionStore.getState().pendingCloseout) {
        setKind('closeout')
        return
      }

      if (!mirrorSeenThisMonth()) {
        const mirror = await getJson<{ rows: MirrorRow[] }>('/api/sessions?resource=mirror')
        if (cancelled) return
        if (mirror && mirror.rows.length > 0) {
          setMirrorRows(mirror.rows)
          setKind('mirror')
          markMirrorSeen()
          return
        }
      }

      const reaskResult = await getJson<{ suggestion: ReaskSuggestion | null }>('/api/sessions?resource=live-reask')
      if (cancelled) return
      if (reaskResult?.suggestion) {
        setReask(reaskResult.suggestion)
        setKind('reask')
        return
      }

      const proposals = await getJson<{ proposals: Proposal[] }>('/api/proposals?resource=pending')
      if (cancelled) return
      if (proposals && proposals.proposals.length > 0) {
        const composite = proposals.proposals.find(p => p.kind === 'composite')
        const chosen = composite ?? proposals.proposals[0]
        setProposal(chosen)
        setKind(chosen.kind)
        return
      }

      const sparkResult = await getJson<{ spark: Spark | null }>('/api/sparks?resource=today')
      if (cancelled) return
      if (sparkResult?.spark) {
        setSpark(sparkResult.spark)
        setKind('spark')
        return
      }

      const quota = await getJson<{ done: boolean; should_nudge: boolean }>('/api/sessions?resource=different-thing-status')
      if (cancelled) return
      if (quota?.should_nudge) {
        setKind('different-thing')
      }
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [])

  if (resolved || !kind) return null

  if (kind === 'closeout' && pendingCloseout) {
    return (
      <div className="glass-card p-6 space-y-3 mb-4">
        <p className="text-base">
          You did some time on {pendingCloseout.projects?.title ?? 'a project'} — where'd you get to?
        </p>
        <VoiceInput onTranscript={setCloseoutText} maxDuration={30} />
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={primaryButtonStyle}
            disabled={!closeoutText}
            onClick={async () => {
              await closeoutForPending(closeoutText)
              setResolved(true)
            }}
          >
            Save
          </button>
          <button
            className="px-4 py-2 rounded-lg border text-sm"
            style={borderStyle}
            onClick={() => setResolved(true)}
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  if (kind === 'mirror') {
    return (
      <div className="mb-4">
        <MirrorSlot rows={mirrorRows} onDismiss={() => setResolved(true)} />
      </div>
    )
  }

  if (kind === 'reask' && reask) {
    return (
      <div className="mb-4">
        <ReaskSlot suggestion={reask} onResolved={() => setResolved(true)} />
      </div>
    )
  }

  if ((kind === 'morph' || kind === 'composite') && proposal) {
    return (
      <div className="mb-4">
        <ProposalSlot proposal={proposal} onResolved={() => setResolved(true)} />
      </div>
    )
  }

  if (kind === 'spark' && spark) {
    return (
      <div className="mb-4">
        <SparkSlot spark={spark} onResolved={() => setResolved(true)} />
      </div>
    )
  }

  if (kind === 'different-thing') {
    return (
      <div className="mb-4">
        <DifferentThingSlot onResolved={() => setResolved(true)} />
      </div>
    )
  }

  return null
}
