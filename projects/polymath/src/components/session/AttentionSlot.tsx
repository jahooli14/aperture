/**
 * AttentionSlot — the attention budget (SPEC.md).
 *
 * The two things the app may put in front of you on open, in this order:
 *   1. a close-out you owe it (you worked, then closed the app without
 *      saying where you got to — worth more than anything the app can say);
 *   2. the monthly mirror, once, on the first open of the month.
 * It renders AT MOST ONE, and nothing at all while a session is running.
 * Whatever loses is not queued behind the winner.
 *
 * It used to hold four more: "make X your live project?", a project reshape,
 * a two-project mash-up and the weekly find from outside. The first was the
 * app second-guessing you; the reshape and mash-up are the same kind of
 * noticing the daily question already does (it looks for the same stall in
 * two projects, and a project that has drifted from what it says it is); and
 * the outside find moved into the answer card, under the question. One
 * voice, not six taking turns.
 *
 * Every slot here answers with one statement and one action. None renders a
 * list of things to pick from.
 */

import { useEffect, useState } from 'react'
import { useSessionStore } from '../../stores/useSessionStore'
import { VoiceInput } from '../VoiceInput'
import { api } from '../../lib/apiClient'

const secondaryTextStyle = { color: 'var(--brand-text-secondary)', opacity: 0.7 }
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

type SlotKind = 'closeout' | 'mirror' | null

interface MirrorRow {
  project_id: string
  title: string
  minutes: number
  is_live: boolean
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

  const [failed, setFailed] = useState(false)
  const submitMissing = async () => {
    if (!missingText.trim()) return onDismiss()
    setSubmitting(true)
    try {
      // Free text -- the server parses which project and how long via
      // retro-parser.ts, so a correction like "did 2 hours on the decks
      // last night" lands on the right project with the right duration,
      // not a guessed one.
      await api.post('utilities?resource=log-retro', { text: missingText })
      onDismiss()
    } catch {
      // Keep what they typed and say so, rather than closing on a lost note.
      setFailed(true)
    } finally {
      setSubmitting(false)
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
      {/* Talk or type -- same reasoning as the close-out below: voice being
          the only way in left a once-a-month correction unanswerable
          without a mic. */}
      <textarea
        value={missingText}
        onChange={e => setMissingText(e.target.value)}
        placeholder="Or type it..."
        rows={2}
        className="field w-full px-3 py-2 text-sm resize-none"
      />
      <div className="flex gap-2">
        <button
          className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={primaryButtonStyle}
          disabled={submitting}
          onClick={submitMissing}
        >
          {missingText ? 'Add it' : 'All good'}
        </button>
        {failed && <span className="text-[12px]" style={secondaryTextStyle}>That didn’t send. Try again.</span>}
      </div>
    </div>
  )
}

export function AttentionSlot() {
  const { pendingCloseout, checkPendingCloseout, closeoutForPending } = useSessionStore()
  const closing = useSessionStore(s => s.closing)
  // During a session there is exactly one thing on screen. The budget is
  // for what the app says on OPEN — interrupting the hour it just helped
  // you start is the worst possible moment for any of it.
  const sessionRunning = useSessionStore(s => s.active != null)
  const [kind, setKind] = useState<SlotKind>(null)
  const [mirrorRows, setMirrorRows] = useState<MirrorRow[]>([])
  const [closeoutText, setCloseoutText] = useState('')
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      // The slot renders null during a session anyway -- no reason to spend
      // calls competing with the hour it would interrupt.
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
          className="field w-full px-3 py-2 text-sm resize-none"
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

  return null
}
