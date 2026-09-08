/**
 * The standing question — the app's diffuse-thinking half.
 *
 * A session is focused time: you sit down, you work, you stop. This is the
 * other mode. One question about one project, put in front of you when you
 * open the app and left there for days, so it can be carried around and
 * answered on a walk rather than at a desk. Nothing here is a task and
 * nothing is due.
 *
 * It sits at the TOP of the answer card, above the session, and stays small:
 * a label, a line, and a quiet row of two. It's the thing you read on the way
 * past, not the thing you act on — the session below it is the action, and
 * this must never grow big enough to compete with it. Reading it and doing
 * nothing is the normal outcome.
 */

import { useEffect, useState } from 'react'
import { VoiceInput } from '../VoiceInput'
import { haptic } from '../../utils/haptics'

export interface StandingQuestionSpark {
  id: string
  type: string
  text: string
  project_id: string | null
  projects?: { title: string } | null
}

/** Attention-slot kinds that are proposals, not questions — those stay in
 *  the attention slot, which is built for one-off interruptions. */
const PROPOSAL_TYPES = new Set(['forgotten'])

export function isStandingQuestion(spark: { type: string } | null | undefined): boolean {
  return !!spark && !PROPOSAL_TYPES.has(spark.type)
}

const quietActionStyle = { color: 'var(--brand-text-secondary)', opacity: 0.55 }

export function StandingQuestion() {
  const [spark, setSpark] = useState<StandingQuestionSpark | null>(null)
  const [answering, setAnswering] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rerolling, setRerolling] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/utilities?resource=today')
        if (!res.ok) return
        const data = await res.json() as { spark: StandingQuestionSpark | null }
        if (cancelled) return
        if (isStandingQuestion(data.spark)) setSpark(data.spark)
      } catch {
        // Offline — the question simply isn't shown. It'll still be there.
      }
    })()
    return () => { cancelled = true }
  }, [])

  const respond = async () => {
    if (!text.trim() || !spark) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/utilities?resource=respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spark_id: spark.id, response_text: text }),
      })
      const data = await res.json().catch(() => ({})) as { project_title?: string }
      haptic.success()
      setReceipt(
        data.project_title
          ? `Saved. It'll be there next time you sit down to ${data.project_title}.`
          : 'Saved.'
      )
    } catch {
      setSubmitting(false)
    }
  }

  const reroll = async () => {
    setRerolling(true)
    setNote(null)
    try {
      const res = await fetch('/api/utilities?resource=reroll-spark', { method: 'POST' })
      const data = await res.json().catch(() => ({})) as {
        rerolled?: boolean
        spark?: StandingQuestionSpark
      }
      if (data.rerolled && data.spark) {
        haptic.light()
        setSpark(data.spark)
        setAnswering(false)
        setText('')
      } else {
        // Honest about silence rather than pretending to think — and the
        // question you had is still there.
        setNote('Nothing else worth asking yet.')
      }
    } catch {
      setNote("Couldn't reach the server.")
    } finally {
      setRerolling(false)
    }
  }

  if (!spark) return null

  if (receipt) {
    return (
      <div className="pb-3 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
        <p className="text-[12px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.7 }}>{receipt}</p>
      </div>
    )
  }

  const projectTitle = spark.projects?.title ?? null

  return (
    <div className="pb-3.5 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.09)' }}>
      <p
        className="text-[10px] font-bold uppercase tracking-[0.28em] mb-1.5"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}
      >
        {projectTitle ? `to mull · ${projectTitle}` : 'to mull'}
      </p>

      <p
        className="text-[14px] leading-[1.45]"
        style={{ color: 'var(--brand-text-secondary)', textWrap: 'pretty' }}
      >
        {spark.text}
      </p>

      {/* Two quiet words, not two buttons. Answering is opt-in — the voice
          box only appears once you've got something to say, so the resting
          state of this whole block is three lines. */}
      {!answering && (
        <div className="flex items-center gap-3 mt-2">
          <button
            className="text-[12px] transition-opacity hover:opacity-90"
            style={quietActionStyle}
            onClick={() => setAnswering(true)}
          >
            answer it
          </button>
          <span style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}>·</span>
          <button
            className="text-[12px] transition-opacity hover:opacity-90 disabled:opacity-30"
            style={quietActionStyle}
            disabled={rerolling}
            onClick={reroll}
          >
            {rerolling ? 'thinking…' : 'ask me something else'}
          </button>
        </div>
      )}

      {note && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}>
          {note}
        </p>
      )}

      {answering && (
        <div className="mt-2.5">
          <VoiceInput onTranscript={setText} maxDuration={30} />
          <div className="flex items-center gap-3 mt-2">
            {text && (
              <button
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
                style={{
                  background: 'rgba(var(--brand-primary-rgb), 0.12)',
                  border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
                  color: 'rgb(var(--brand-primary-rgb))',
                }}
                disabled={submitting}
                onClick={respond}
              >
                {submitting ? 'Saving…' : 'Done'}
              </button>
            )}
            <button
              className="text-[12px] transition-opacity hover:opacity-90"
              style={quietActionStyle}
              onClick={() => { setAnswering(false); setText('') }}
            >
              leave it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
