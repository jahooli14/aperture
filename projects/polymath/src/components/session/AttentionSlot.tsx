/**
 * AttentionSlot — the attention budget (SPEC.md).
 *
 * Things that can want the screen on open: a deferred close-out, the
 * monthly mirror, the live-project re-ask, a composite proposal, a morph
 * proposal, and today's spark. Competing surfaces are how "guide, not
 * menu" dies, so this renders AT MOST ONE, in fixed priority order, and
 * whatever loses is not queued behind the winner -- it waits for another
 * day or is dropped, never stacks into a notification tray. It renders
 * NOTHING at all while a session is being planned or run.
 *
 * The monthly "something different" quota used to be the last slot here.
 * It moved onto the answer card's chat row: it isn't a different kind of
 * thing from steering, it's steering the app started, and giving it a
 * third box with its own buttons made it compete with the answer.
 *
 * Mounted on HomePage directly beneath the answer box, because "on app
 * open" is what a spark is the reward for -- confining it to a separate
 * route would only fire it when the user was already about to start a
 * session. It goes BELOW the answer box, never above the masthead where
 * the first cut put it: the answer box is the one thing you act on, this
 * is the one thing the app gets to say back, and stacking a second card
 * above the header read as broken chrome rather than as a second voice.
 *
 * Every slot in here answers with one statement and one action. None of
 * them may render a list of things to pick from -- that's the menu the
 * whole spec exists to avoid.
 */

import { useEffect, useState } from 'react'
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

type SlotKind = 'closeout' | 'mirror' | 'reask' | 'composite' | 'morph' | 'spark' | null

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
      await fetch('/api/utilities?resource=log-retro', {
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
      await fetch(`/api/utilities?resource=${action}`, {
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

/**
 * The 'forgotten' spark is the last branch of the stale router (see
 * api/_lib/forgotten.ts). It's the one spark type whose useful answer isn't
 * words -- it's putting the project back in play -- so it gets an action
 * instead of a microphone. Still one statement, one action, one quiet out.
 */
function ForgottenSlot({ spark, onResolved }: { spark: Spark; onResolved: () => void }) {
  const { declareLive } = useSessionStore()
  const [busy, setBusy] = useState(false)

  const makeLive = async () => {
    if (!spark.project_id) return onResolved()
    setBusy(true)
    try {
      await declareLive(spark.project_id)
      await useProjectStore.getState().fetchProjects()
    } finally {
      setBusy(false)
      onResolved()
    }
  }

  return (
    <div className="glass-card p-6 space-y-3">
      <p className="text-base">{spark.text}</p>
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={busy || !spark.project_id}
          onClick={makeLive}
        >
          Make it live
        </button>
        <button
          className="px-4 py-2 rounded-lg border text-sm disabled:opacity-50"
          style={borderStyle}
          disabled={busy}
          onClick={onResolved}
        >
          Not now
        </button>
      </div>
    </div>
  )
}

/** How long the "here's what that did" line stays up before the slot
 *  clears itself. Long enough to read, short enough that it never becomes
 *  another thing to dismiss. */
const SPARK_RECEIPT_MS = 4000

function SparkSlot({ spark, onResolved }: { spark: Spark; onResolved: () => void }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  const respond = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/utilities?resource=respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spark_id: spark.id, response_text: text }),
      })
      const data = await res.json().catch(() => ({}))
      // Say what answering actually did. Not a streak, not a point -- the
      // real mechanism: it goes in the corpus, and the session briefing
      // reads the corpus, so the next sitting on that project starts
      // somewhere different because of this. Only names a project when the
      // spark actually had one; otherwise it stays quiet rather than
      // dressing up a vaguer claim.
      setReceipt(data?.project_title
        ? `In. It'll be there next time you sit down with ${data.project_title}.`
        : 'In.')
      setSubmitting(false)
      setTimeout(onResolved, SPARK_RECEIPT_MS)
    } catch {
      setSubmitting(false)
      onResolved()
    }
  }

  if (receipt) {
    return (
      <div className="glass-card p-6">
        <p className="text-sm" style={secondaryTextStyle}>{receipt}</p>
      </div>
    )
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
export function AttentionSlot() {
  const { pendingCloseout, checkPendingCloseout, closeoutForPending } = useSessionStore()
  // During a session there is exactly one thing on screen. The budget is
  // for what the app says on OPEN — interrupting the hour it just helped
  // you start is the worst possible moment for any of it.
  const sessionRunning = useSessionStore(s => s.active != null || s.plan != null)
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
        const mirror = await getJson<{ rows: MirrorRow[] }>('/api/utilities?resource=mirror')
        if (cancelled) return
        if (mirror && mirror.rows.length > 0) {
          setMirrorRows(mirror.rows)
          setKind('mirror')
          markMirrorSeen()
          return
        }
      }

      const reaskResult = await getJson<{ suggestion: ReaskSuggestion | null }>('/api/utilities?resource=live-reask')
      if (cancelled) return
      if (reaskResult?.suggestion) {
        setReask(reaskResult.suggestion)
        setKind('reask')
        return
      }

      const proposals = await getJson<{ proposals: Proposal[] }>('/api/utilities?resource=pending')
      if (cancelled) return
      if (proposals && proposals.proposals.length > 0) {
        const composite = proposals.proposals.find(p => p.kind === 'composite')
        const chosen = composite ?? proposals.proposals[0]
        setProposal(chosen)
        setKind(chosen.kind)
        return
      }

      const sparkResult = await getJson<{ spark: Spark | null }>('/api/utilities?resource=today')
      if (cancelled) return
      if (sparkResult?.spark) {
        setSpark(sparkResult.spark)
        setKind('spark')
        return
      }

    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [])

  if (sessionRunning || resolved || !kind) return null

  if (kind === 'closeout' && pendingCloseout) {
    return (
      <div className="glass-card p-6 space-y-3 mt-5 mb-4">
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
      <div className="mt-5 mb-4">
        <MirrorSlot rows={mirrorRows} onDismiss={() => setResolved(true)} />
      </div>
    )
  }

  if (kind === 'reask' && reask) {
    return (
      <div className="mt-5 mb-4">
        <ReaskSlot suggestion={reask} onResolved={() => setResolved(true)} />
      </div>
    )
  }

  if ((kind === 'morph' || kind === 'composite') && proposal) {
    return (
      <div className="mt-5 mb-4">
        <ProposalSlot proposal={proposal} onResolved={() => setResolved(true)} />
      </div>
    )
  }

  if (kind === 'spark' && spark) {
    return (
      <div className="mt-5 mb-4">
        {spark.type === 'forgotten' ? (
          <ForgottenSlot spark={spark} onResolved={() => setResolved(true)} />
        ) : (
          <SparkSlot spark={spark} onResolved={() => setResolved(true)} />
        )}
      </div>
    )
  }

  return null
}
