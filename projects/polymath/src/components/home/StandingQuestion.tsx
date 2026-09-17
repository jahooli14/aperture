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
import { api } from '../../lib/apiClient'

export interface StandingQuestionSpark {
  id: string
  type: string
  text: string
  project_id: string | null
  projects?: { title: string } | null
}

/** Every spark is a question now. The one kind that wasn't -- the
 *  forgotten-project offer, "you set down X N months ago" -- is gone:
 *  elapsed time is a fact about the calendar, not a reason to care, and it
 *  only ever appeared when the channel had found no insight at all. */
export function isStandingQuestion(spark: { type: string } | null | undefined): boolean {
  return !!spark
}

const quietActionStyle = { color: 'var(--brand-text-secondary)', opacity: 0.45 }

export function StandingQuestion() {
  const [spark, setSpark] = useState<StandingQuestionSpark | null>(null)
  const [answering, setAnswering] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [rerolling, setRerolling] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // The regular bar has a high floor and a high ceiling on purpose — see
  // CLAUDE.md. Once a reroll comes back with nothing under it, this offers
  // one deliberate way past it rather than leaving "nothing else worth
  // asking yet" as the end of the road. A second, explicit tap, so the
  // corpus never runs out of *something* to ask even when it's run out of
  // the good stuff — handy for a demo, or just a slow week.
  const [offerCreative, setOfferCreative] = useState(false)
  // The one question back. A computed fact can be true and still be out of
  // date — "you gave up on it in January" is arithmetic, whether that is
  // still how they think about it is only knowable from them. Two turns,
  // never more: this gets answered on a walk or not at all.
  const [followUp, setFollowUp] = useState<string | null>(null)
  const [followUpText, setFollowUpText] = useState('')
  const [asking, setAsking] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // AttentionSlot's own fallback chain hits this exact same endpoint
        // on the same home render -- api.get's cache+dedup (apiClient.ts)
        // means whichever of the two asks first is the only one that
        // actually goes over the network.
        const data = await api.get('utilities?resource=today') as { spark: StandingQuestionSpark | null }
        if (cancelled) return
        if (isStandingQuestion(data.spark)) setSpark(data.spark)
        setLoaded(true)
      } catch {
        // Offline — the question simply isn't shown. It'll still be there.
      }
    })()
    return () => { cancelled = true }
  }, [])

  /** Save their turns and close the card. */
  const save = async (turns: string[]) => {
    if (!spark) return
    setSubmitting(true)
    try {
      // No inner .catch here. It used to swallow everything -- a 401, a 500
      // from either insert, a timeout -- and then show "Saved." anyway, which
      // also made the outer catch unreachable. Answering is the one thing
      // this card exists for; claiming it worked when it didn't is the worst
      // thing it can do, because the user has no other copy of what they said.
      const data = await api.post('utilities?resource=respond', {
        spark_id: spark.id, response_text: turns[0], turns,
      }) as { project_title?: string; processed?: boolean }
      haptic.success()
      setReceipt(
        data.project_title
          ? `Saved. It'll be there next time you sit down to ${data.project_title}.`
          : 'Saved.'
      )
    } catch {
      haptic.error()
      // The text stays in the box, so it can be sent again.
      setNote("That didn't send. Your answer is still here — try again.")
      setSubmitting(false)
    }
  }

  const respond = async () => {
    if (!text.trim() || !spark) return
    // Ask one thing back before saving — but never let that stand between
    // them and a saved answer. If the follow-up call fails or has nothing
    // to ask, this just saves, which is exactly what it did before.
    setAsking(true)
    try {
      const data = await api.post('utilities?resource=spark-followup', {
        spark_id: spark.id, answer: text,
      }) as { question?: string | null }
      if (data.question) {
        haptic.light()
        setFollowUp(data.question)
        setAsking(false)
        return
      }
    } catch {
      // Nothing to ask, or could not ask. Save what they said.
    }
    setAsking(false)
    await save([text])
  }

  const reroll = async (creative = false) => {
    setRerolling(true)
    setNote(null)
    try {
      const data = await api.post('utilities?resource=reroll-spark', { creative }) as {
        rerolled?: boolean
        spark?: StandingQuestionSpark
      }
      if (data.rerolled && data.spark) {
        haptic.light()
        setSpark(data.spark)
        setAnswering(false)
        setText('')
        setOfferCreative(false)
      } else if (!creative) {
        // Honest about silence rather than pretending to think — and the
        // question you had is still there. Offer the looser pass instead
        // of just repeating "nothing else" forever.
        setNote('Nothing else worth asking yet.')
        setOfferCreative(true)
      } else {
        // Even the looser pass found nothing grounded in anything real —
        // that's a genuinely empty corpus, not a high bar.
        setNote('Really nothing to work with right now.')
        setOfferCreative(false)
      }
    } catch (err) {
      // A rejected request and an unreachable one are different problems and
      // only one of them is worth retrying. Saying "couldn't reach the
      // server" for both sent four days of debugging at the network when the
      // server was answering every time -- with a 500, because `mull` was
      // missing from the sparks type constraint.
      const status = (err as { status?: number } | null)?.status
      setNote(
        status && status >= 500
          ? 'Something broke writing that one.'
          : "Couldn't reach the server."
      )
    } finally {
      setRerolling(false)
    }
  }

  // Nothing standing. This used to render nothing at all, which hid the one
  // control that fixes it: questions are baked by a daily cron, so a silent
  // bake — or a question you just answered — left no question and no way to
  // ask for one until tomorrow. An empty block with a way in is the whole
  // difference between a feature that works on demand and one you wait for.
  if (!spark) {
    if (!loaded) return null
    return (
      <div className="pb-3.5 mb-4">
        <p
          className="text-[10px] font-medium uppercase tracking-[0.3em] mb-1.5"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.32 }}
        >
          to mull
        </p>
        <button
          className="text-[13px] italic transition-opacity hover:opacity-80 disabled:opacity-35"
          style={{ color: 'var(--brand-text-secondary)', opacity: 0.5, fontFamily: 'var(--brand-font-serif)' }}
          disabled={rerolling}
          onClick={() => reroll()}
        >
          {rerolling ? 'thinking…' : 'give me something to think about'}
        </button>
        {note && (
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.4 }}>
            {note}
          </p>
        )}
        {offerCreative && (
          <button
            className="text-[12px] mt-1.5 transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ color: 'var(--brand-text-secondary)', opacity: 0.6, textDecoration: 'underline' }}
            disabled={rerolling}
            onClick={() => reroll(true)}
          >
            {rerolling ? 'thinking…' : 'get more creative'}
          </button>
        )}
      </div>
    )
  }

  if (receipt) {
    return (
      <div className="pb-3 mb-4">
        <p className="text-[12px]" style={{ color: 'var(--brand-text-secondary)', opacity: 0.6 }}>{receipt}</p>
      </div>
    )
  }

  const projectTitle = spark.projects?.title ?? null

  return (
    <div className="pb-3.5 mb-4">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.3em] mb-1.5"
        style={{ color: 'var(--brand-text-secondary)', opacity: 0.32 }}
      >
        {projectTitle ? `to mull · ${projectTitle}` : 'to mull'}
      </p>

      {/* Deliberately the quietest, softest text on the card — this is the
          thing you read on the way past, not the thing you act on, and it
          has to recede under the project below it. Italic serif instead of
          the UI sans, lower contrast, roomier line height: a thought held
          loosely rather than an instruction. */}
      <p
        className="text-[14px] leading-[1.6] italic font-light"
        style={{
          color: 'var(--brand-text-secondary)',
          opacity: 0.68,
          fontFamily: 'var(--brand-font-serif)',
          textWrap: 'pretty',
        }}
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
            onClick={() => reroll()}
          >
            {rerolling ? 'thinking…' : 'ask me something else'}
          </button>
          {offerCreative && (
            <>
              <span style={{ color: 'var(--brand-text-secondary)', opacity: 0.25 }}>·</span>
              <button
                className="text-[12px] transition-opacity hover:opacity-90 disabled:opacity-30"
                style={quietActionStyle}
                disabled={rerolling}
                onClick={() => reroll(true)}
              >
                {rerolling ? 'thinking…' : 'get more creative'}
              </button>
            </>
          )}
        </div>
      )}

      {note && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--brand-text-secondary)', opacity: 0.45 }}>
          {note}
        </p>
      )}

      {/* The one question back. Skipping is a first-class option and sits
          next to Done, not hidden — a follow-up they cannot escape is worse
          than no follow-up, and their first answer is already safe either
          way (it saves whichever button they press). */}
      {followUp && (
        <div className="mt-3">
          <p
            className="text-[13px] leading-[1.45] mb-2"
            style={{ color: 'var(--brand-text-secondary)', textWrap: 'pretty' }}
          >
            {followUp}
          </p>
          <VoiceInput onTranscript={setFollowUpText} maxDuration={30} />
          <div className="flex items-center gap-3 mt-2">
            <button
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50"
              style={{
                background: 'rgba(var(--brand-primary-rgb), 0.12)',
                border: '1px solid rgba(var(--brand-primary-rgb), 0.32)',
                color: 'rgb(var(--brand-primary-rgb))',
              }}
              disabled={submitting}
              onClick={() => save(followUpText.trim() ? [text, followUpText] : [text])}
            >
              {submitting ? 'Saving…' : 'Done'}
            </button>
            <button
              className="text-[12px] transition-opacity hover:opacity-90 disabled:opacity-30"
              style={quietActionStyle}
              disabled={submitting}
              onClick={() => save([text])}
            >
              skip
            </button>
          </div>
        </div>
      )}

      {answering && !followUp && (
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
                disabled={submitting || asking}
                onClick={respond}
              >
                {asking ? 'One sec…' : submitting ? 'Saving…' : 'Done'}
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
