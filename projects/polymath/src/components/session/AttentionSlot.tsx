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

import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../../stores/useSessionStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { VoiceInput } from '../VoiceInput'
import { api } from '../../lib/apiClient'

const secondaryTextStyle = { color: 'var(--brand-text-secondary)', opacity: 0.7 }
const borderStyle = { borderColor: 'var(--glass-border-bold)' }
/**
 * The quiet way out.
 *
 * Every slot in here is one statement and one action — and each one used to
 * put its decline in a bordered rectangle the same height and width as the
 * action, so the card asked you to choose between two buttons instead of
 * offering you one. Same tap, same effect, no competition: the out is a
 * line of text under the action, which is how the home card, the reader and
 * the project page all do it.
 */
const quietOutClass = 'w-full text-[12px] py-1.5 transition-opacity hover:opacity-90 disabled:opacity-30'
const quietOutStyle = { color: 'var(--brand-text-secondary)', opacity: 0.5 }
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
    // Storage unavailable -- getItem above almost always fails the same
    // way (they're not independently broken in practice), and
    // mirrorSeenThisMonth already fails closed on that, so this doesn't
    // reopen the mirror on every future open; it just has nothing to save.
  }
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    // Routed through apiClient's api.get, not a bare fetch, so its
    // cache+dedup covers `resource=today` -- StandingQuestion (rendered on
    // the same home page, inside the answer card) hits that exact endpoint
    // too, and used to always cost a second network round trip for it.
    return await api.get(url.replace(/^\/api\//, '')) as T
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
      await api.post('utilities?resource=log-retro', { text: missingText })
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
      await api.post(`utilities?resource=${action}`, { proposal_id: proposal.id })
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
      <div className="space-y-1">
        <button
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={busy}
          onClick={() => act('accept')}
        >
          Take it
        </button>
        {/* Still one tap and still recorded — rejecting is what sets the
            cooldown — it just isn't a second rectangle arguing with the
            first one. */}
        <button className={quietOutClass} style={quietOutStyle} disabled={busy} onClick={() => act('reject')}>
          that's not it
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
  const receiptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Navigating away mid-receipt used to leave the timeout running and call
  // onResolved (a setState on the parent) after this component had already
  // unmounted.
  useEffect(() => () => {
    if (receiptTimeoutRef.current) clearTimeout(receiptTimeoutRef.current)
  }, [])

  const respond = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const data = await api.post('utilities?resource=respond', {
        spark_id: spark.id, response_text: text,
      }).catch(() => ({})) as { project_title?: string }
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
      receiptTimeoutRef.current = setTimeout(onResolved, SPARK_RECEIPT_MS)
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
      if (accept) {
        await declareLive(suggestion.project_id)
      } else {
        // Recorded against the project so the answer survives this open —
        // and this device.
        await api.post('utilities?resource=live-reask', { project_id: suggestion.project_id }).catch(() => {})
      }
    } finally {
      setBusy(false)
      onResolved()
    }
  }

  return (
    <div className="glass-card p-6 space-y-3">
      {/* A statement and an action, not a question with a Yes and a No
          sitting at identical weight — which is the one shape CLAUDE.md
          names outright as the thing never to build. */}
      <p className="text-base">You've been on {suggestion.title} more than anything else.</p>
      <div className="space-y-1">
        <button
          className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={busy}
          onClick={() => act(true)}
        >
          Make it the live one
        </button>
        <button className={quietOutClass} style={quietOutStyle} disabled={busy} onClick={() => act(false)}>
          or leave it as is
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
  const closing = useSessionStore(s => s.closing)
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
      // Five sequential API calls, and the whole slot renders null during a
      // session anyway -- there is no reason to spend them competing with
      // the hour they'd interrupt.
      if (sessionRunning) return
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

      // No client-side timer: the server drops a project you've already
      // answered for, so a suggestion arriving here is one you haven't seen.
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

      // Only the proposal-shaped spark stays here. The question types moved
      // to the answer card as the standing question, where they get to sit
      // for days instead of being one open's interruption — showing them in
      // both places would just be the same question twice.

    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [sessionRunning])

  if (sessionRunning || resolved || !kind) return null

  if (kind === 'closeout' && pendingCloseout) {
    return (
      <div className="glass-card p-6 space-y-3 mt-5 mb-4">
        <p className="text-base">
          You did some time on {pendingCloseout.projects?.title ?? 'a project'} — where'd you get to?
        </p>
        <VoiceInput onTranscript={t => setCloseoutText(c => (c ? `${c} ${t}` : t))} maxDuration={30} />
        {/* Voice was the only way to answer this. A mic that won't start,
            a room you can't talk in, or just preferring to type left the
            question unanswerable — and every other close-out in the app
            offers the keyboard. */}
        <textarea
          value={closeoutText}
          onChange={e => setCloseoutText(e.target.value)}
          placeholder="Did: ... Next: ..."
          rows={2}
          className="w-full rounded-xl px-3 py-2 text-sm bg-transparent border resize-none outline-none"
          style={{ ...borderStyle, color: 'var(--brand-text-primary)' }}
        />
        <div className="space-y-1">
          <button
            className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={primaryButtonStyle}
            disabled={!closeoutText.trim() || closing}
            onClick={async () => {
              await closeoutForPending(closeoutText.trim())
              setResolved(true)
            }}
          >
            {closing ? 'Saving…' : 'Save'}
          </button>
          {/* Skip used to hide this card and nothing else, so the session
              stayed open on the server and the question came back on the
              very next home open, and the one after that, until it aged
              out. Nothing to report IS an answer: it closes the session
              with an empty close-out, exactly as the contract's own
              "Skip — nothing to report" does. Styled as the quiet way out
              rather than a bordered button of equal weight to Save. */}
          <button
            className={quietOutClass}
            style={quietOutStyle}
            disabled={closing}
            onClick={async () => {
              await closeoutForPending('')
              setResolved(true)
            }}
          >
            or skip it
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
        <SparkSlot spark={spark} onResolved={() => setResolved(true)} />
      </div>
    )
  }

  return null
}
