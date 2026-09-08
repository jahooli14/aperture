/**
 * The standing question — the app's diffuse-thinking half.
 *
 * A session is focused time: you sit down, you work, you stop. This is the
 * other mode. It's one question about one project, put in front of you when
 * you open the app and left there for days, so it can be carried around and
 * answered on a walk rather than at a desk. Nothing here is a task and
 * nothing is due.
 *
 * It's the same spark the attention slot used to flash for a single open —
 * promoted to permanent space on the answer card and given a project name,
 * because a question you can't place is one you can't think about.
 *
 * Rules it keeps:
 *  - it never nags: leaving it alone is the normal case, and there's no
 *    badge, count or streak on it;
 *  - it says which project it belongs to, so it can be mulled;
 *  - answering is one voice note, or nothing at all.
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

export function StandingQuestion({ onAnswered }: { onAnswered?: () => void }) {
  const [spark, setSpark] = useState<StandingQuestionSpark | null>(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

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
      onAnswered?.()
    } catch {
      setSubmitting(false)
    }
  }

  if (!spark) return null

  if (receipt) {
    return (
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
        <p className="text-[13px]" style={{ color: 'var(--brand-text-secondary)' }}>{receipt}</p>
      </div>
    )
  }

  const projectTitle = spark.projects?.title ?? null

  return (
    <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.09)' }}>
      <p
        className="text-[10px] uppercase tracking-[0.18em] mb-1.5"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.55 }}
      >
        {projectTitle ? `to mull · ${projectTitle}` : 'to mull'}
      </p>

      <p className="text-[15px] leading-snug" style={{ color: 'var(--brand-text-primary)', textWrap: 'pretty' }}>
        {spark.text}
      </p>

      {/* No prompt to answer now. The voice box is there if the answer has
          already arrived; otherwise this is just something to carry. */}
      <div className="mt-3">
        <VoiceInput onTranscript={setText} maxDuration={30} />
      </div>

      {text && (
        <button
          className="w-full mt-2 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
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
    </div>
  )
}
