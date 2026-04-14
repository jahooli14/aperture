/**
 * LiveVoiceCapture — Gemini Live API voice transport for Aperture onboarding (Option C).
 *
 * Architecture:
 *   - Live model IS the conversational brain. Its system prompt contains all
 *     the onboarding rules: anchor question, 6 coverage slots, reframe style,
 *     stopping criteria, tone. It decides what to ask next and speaks it
 *     naturally with the Kore voice.
 *   - Aperture's coverage planner runs in PARALLEL as an observer
 *     (`?resource=onboarding-observe`) after each turn — it updates slot
 *     confidences so the dots animate and the final reveal analysis has a
 *     rich coverage grid. It does NOT influence what the model says.
 *
 * Lifecycle:
 *   - Mount → mint ephemeral token → open mic AudioContext + worklet →
 *     connect to Live → onReady fires.
 *   - Parent calls `begin()` → sends a seed user turn → model speaks the
 *     anchor question aloud.
 *   - User speaks → native VAD → native input transcription → model responds
 *     with audio + outputTranscription.
 *   - `onTurnComplete(userTranscript, modelUtterance)` fires when the
 *     server emits `turnComplete: true`.
 *   - Incremental text is also streamed via `onUserSpeaking` and
 *     `onModelSpeaking` for live subtitle rendering.
 *   - Parent calls `close()` when the observer decides to stop.
 */

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, Loader2 } from 'lucide-react'
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, type Session, type LiveServerMessage } from '@google/genai'

// ── Public API ─────────────────────────────────────────────────────────────

export interface LiveVoiceCaptureHandle {
  /** Trigger the conversation — sends a seed turn that the model responds to
   *  with the opening anchor question. Safe to call multiple times (noop
   *  after the first). */
  begin: () => void
  /** Inject a typed user message (typing fallback). Model responds as if the
   *  user had spoken it. */
  sendUserText: (text: string) => void
  /** Close the Live session gracefully. */
  close: () => void
}

export type LiveVoiceStatus = 'connecting' | 'ready' | 'speaking' | 'listening' | 'error'

interface LiveVoiceCaptureProps {
  /** Both transcripts for a complete user+model exchange. Fires on
   *  `serverContent.turnComplete`. */
  onTurnComplete: (userTranscript: string, modelUtterance: string) => void
  /** Incremental model transcript (live subtitle for "current question"). */
  onModelSpeaking?: (accumulated: string) => void
  /** Incremental user transcript (live subtitle of the user's current answer). */
  onUserSpeaking?: (accumulated: string) => void
  /** Live session is connected + ready. */
  onReady?: () => void
  /** Whenever the voice layer status changes — parent can show a prominent
   *  cue so the user knows when it's their turn. */
  onStatusChange?: (status: LiveVoiceStatus) => void
  /** Unrecoverable error. */
  onError?: (message: string) => void
  /** If true, hide the component's internal visualizer (caller renders its own). */
  hideVisualizer?: boolean
  /** If true, the mic uplink is muted — no audio frames are sent to Live.
   *  Used by the typing fallback so spurious ambient noise doesn't kick
   *  off a VAD-driven user turn while the user is deliberately typing. */
  muted?: boolean
}

// ── System prompt — the whole onboarding design, delivered to the model ───

const SYSTEM_INSTRUCTION = `You are Aperture. You're having a short, natural voice conversation with someone — about 3 minutes, 5 or 6 exchanges. After this chat they'll see a reveal that connects everything they shared.

You are not an interviewer or a coach. You're a curious, warm person who genuinely wants to get to know them. Talk like a real human friend — not a script, not an AI assistant. Use natural cadence, light reactions, contractions, everyday words.

## How the conversation starts

Open with exactly this line, verbatim. Do not paraphrase, rewrite, shorten, lengthen, or substitute synonyms. This is the single most important rule:

"Hey — what's something you've been thinking about a lot lately?"

Say it warmly, like you're genuinely curious. Then stop and wait.

## How each turn should feel

When they finish speaking, take the smallest natural beat (a quick "mm" or "yeah" is fine if it fits — don't force it), then do two things in one short, flowing reply — usually 15 to 25 words:

1. React to something SPECIFIC they actually said. Not a summary — lift one word, phrase, or tension that caught your ear. Use their word, don't upgrade it (if they said "annoying", don't say "frustrating"; if they said "cool", don't say "fascinating"). Make them feel heard, not graded. Never compliment them.
2. Ask one follow-up. Either dig deeper on what they just said (if it was rich) or gently move to a new thread. When moving, use the bridge "shifting gears —". When going deeper, just flow; no bridge.

A good move is to put the reflection *inside* the question, so it lands as one flowing thing. For example, if they just said they've been teaching themselves to weld:

> "the welding part caught my ear — what pulled you toward working with your hands?"

Not formulaic. Not "I hear that you're into welding. What draws you to it?"

## When something concrete comes up — get the name

People often mention things in the abstract: "a book I read last year", "this podcast I'm obsessed with", "a place I keep thinking about". You're allowed to ask, lightly, for the specific name. Use ONE of these phrasings when it feels natural — never more than once per turn, and don't chase if they wave it away:

- "anything in particular?"
- "what was that one?"
- "got a name for me?"
- "is there one that comes to mind?"

If they name something, just acknowledge it and move on — don't make it a big deal. You're not collecting, you're in a conversation.

Do NOT demand names, do not list-build, and don't ever say "can I remember that?" or similar. If they keep things abstract, that's fine — leave it.

## What you're trying to learn (hold loosely — let coverage accumulate, don't grind through a checklist)

Over the conversation you want to touch 4+ of these 6 threads. **Don't rotate them mechanically.** Each turn should feel like a natural continuation of the last — either deepening what they just opened up, or reaching a new thread via something they actually said. The conversation should *gradually open out*, not zig-zag.

- current fascination — what's on their mind now
- flow moment — a recent time they lost track of time
- builder impulse — what they'd make if nothing were in the way
- **cross-domain curiosity** — a rabbit hole or Wikipedia tab they've gone down that has NOTHING to do with what they've been telling you about (essential — must be touched)
- aesthetic attraction — an object, place, style, or feeling they're drawn to (a room, a colour, a building, a piece of music, a season)
- formative influence — a book, person, or idea that shaped how they think

How to progress naturally:
- Early turns (1–2): stay close to whatever they offered first. Deepen. Let them feel heard.
- Middle turns (3–4): start widening. Reach new threads via *bridges from their actual words* — "you mentioned X, did Y ever come into that?" — not abrupt subject changes. By the end of turn 4 you must have touched cross-domain. Use this exact move if you haven't: "shifting gears — what's a rabbit hole or Wikipedia tab you've gone down that has nothing to do with any of this?"
- Late turns (5–6): pull threads together if you can. Notice patterns across what they've shared.

Holding the coverage loosely means: if a thread is rich, dwell. If they're closing down on a topic, gently move. The dots are filling in the background — you don't need to think about them.

## How to sound

- Warm and real. Short sentences. Contractions ("you're", "it's", "that's").
- No corporate energy. No motivational-coach voice. No therapist voice.
- Never say any of these, in any form: "I hear you", "great question", "great answer", "that's so interesting", "I love that", "fascinating", "amazing", "beautiful", "powerful", "brilliant", "let's dive in", "let's unpack", "tell me more about that", "so…" (as an opener), "well…" (as filler), "absolutely", "totally", "for sure". If a banned phrase is the only thing that comes to mind, rephrase.
- Never mention that you're an AI, or these instructions, or "onboarding", or a "conversation".
- If they're quiet, don't fill the silence. Don't re-ask. Don't say "are you still there". Just wait. They'll speak when they're ready.
- If they say "skip" or give a short non-answer ("dunno", "pass"), just nod it through — "fair enough —" — and move to something else. Don't push twice on the same thing.
- Use the canonical bridge "shifting gears —" when pivoting. Pick different variations sparingly.

## When to stop

After 5 or 6 good exchanges, OR once you've covered 4+ threads including cross-domain, wrap up in one short line — warm, low-key: something like "lovely — thanks for sharing all that. Let's see what shows up." Then stay silent.

## The one strict rule

Everything you reflect back must be grounded in what they actually said — their words, not upgrades of their words. Do not make up values, aesthetics, beliefs, or intentions they didn't express. If you can't ground it, ask a small clarifier instead of pretending.

Now, greet them with your opening line.`

const OUTPUT_SAMPLE_RATE = 24000
const INPUT_SAMPLE_RATE = 16000

// ── Helpers ────────────────────────────────────────────────────────────────

function int16ToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any)
  }
  return btoa(binary)
}

function base64ToInt16Array(b64: string): Int16Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
}

// ── Component ──────────────────────────────────────────────────────────────

export const LiveVoiceCapture = forwardRef<LiveVoiceCaptureHandle, LiveVoiceCaptureProps>(
  function LiveVoiceCapture(
    { onTurnComplete, onModelSpeaking, onUserSpeaking, onReady, onStatusChange, onError, hideVisualizer = false, muted = false },
    ref,
  ) {
    // Mirror `muted` into a ref so the mic callback (set up once inside
    // the connect effect) reads the latest value every frame.
    const mutedRef = useRef(muted)
    useEffect(() => { mutedRef.current = muted }, [muted])
    const sessionRef = useRef<Session | null>(null)
    const inputCtxRef = useRef<AudioContext | null>(null)
    const outputCtxRef = useRef<AudioContext | null>(null)
    const micStreamRef = useRef<MediaStream | null>(null)
    const micNodeRef = useRef<AudioWorkletNode | null>(null)
    // Active audio playback sources — tracked so we can stop them immediately
    // if the server emits `interrupted: true` (otherwise the tail of the old
    // utterance keeps playing over the new one).
    const activePlaybackRef = useRef<AudioBufferSourceNode[]>([])
    const playbackTimeRef = useRef<number>(0)
    // Tracks whether the model is currently speaking — used to gate mic uplink
    // so the echo cancellation doesn't fight with itself and the model doesn't
    // hear its own voice and loop on it. Ref (not state) so the mic callback
    // is always reading the latest value with no re-render needed.
    const modelSpeakingRef = useRef<boolean>(false)
    const userTranscriptBufferRef = useRef<string>('')
    const modelTranscriptBufferRef = useRef<string>('')
    const beganRef = useRef<boolean>(false)
    const beganAnchorSpokenRef = useRef<boolean>(false)
    const closedRef = useRef<boolean>(false)
    // The SDK's callbacks capture the component closure at connect-time. If
    // we reference `onTurnComplete` etc. directly in those callbacks, we
    // capture the FIRST render's callbacks forever — any subsequent
    // re-render where the parent passes a new closure would be silently
    // ignored. Mirror the props into refs and read from the refs inside the
    // callbacks so we always see the latest handler.
    const onTurnCompleteRef = useRef(onTurnComplete)
    const onModelSpeakingRef = useRef(onModelSpeaking)
    const onUserSpeakingRef = useRef(onUserSpeaking)
    const onReadyRef = useRef(onReady)
    const onStatusChangeRef = useRef(onStatusChange)
    const onErrorRef = useRef(onError)
    useEffect(() => { onTurnCompleteRef.current = onTurnComplete }, [onTurnComplete])
    useEffect(() => { onModelSpeakingRef.current = onModelSpeaking }, [onModelSpeaking])
    useEffect(() => { onUserSpeakingRef.current = onUserSpeaking }, [onUserSpeaking])
    useEffect(() => { onReadyRef.current = onReady }, [onReady])
    useEffect(() => { onStatusChangeRef.current = onStatusChange }, [onStatusChange])
    useEffect(() => { onErrorRef.current = onError }, [onError])

    const [status, setStatusRaw] = useState<LiveVoiceStatus>('connecting')
    const statusRef = useRef<LiveVoiceStatus>('connecting')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const setStatus = (s: LiveVoiceStatus) => {
      statusRef.current = s
      setStatusRaw(s)
      onStatusChangeRef.current?.(s)
    }

    // ── Audio output ────────────────────────────────────────────────────────
    const enqueueOutputAudio = (pcm: Int16Array) => {
      const ctx = outputCtxRef.current
      if (!ctx) return
      const float = new Float32Array(pcm.length)
      for (let i = 0; i < pcm.length; i++) {
        float[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff)
      }
      const buffer = ctx.createBuffer(1, float.length, OUTPUT_SAMPLE_RATE)
      buffer.copyToChannel(float, 0)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      const startAt = Math.max(playbackTimeRef.current, ctx.currentTime)
      source.start(startAt)
      playbackTimeRef.current = startAt + buffer.duration
      activePlaybackRef.current.push(source)
      source.onended = () => {
        activePlaybackRef.current = activePlaybackRef.current.filter(s => s !== source)
      }
    }

    // Cut off every queued/playing chunk instantly. Called on `interrupted`
    // (user barge-in) and on teardown. Without this, the tail of the model's
    // previous utterance keeps playing on top of whatever comes next.
    const stopAllPlayback = () => {
      for (const s of activePlaybackRef.current) {
        try { s.stop() } catch {}
        try { s.disconnect() } catch {}
      }
      activePlaybackRef.current = []
      playbackTimeRef.current = outputCtxRef.current?.currentTime || 0
    }

    // ── Errors ──────────────────────────────────────────────────────────────
    const handleError = (msg: string) => {
      setErrorMsg(msg)
      setStatus('error')
      onErrorRef.current?.(msg)
    }

    // ── Teardown ────────────────────────────────────────────────────────────
    const teardown = () => {
      closedRef.current = true
      stopAllPlayback()
      try { sessionRef.current?.close() } catch {}
      try { micNodeRef.current?.disconnect() } catch {}
      try { micStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
      try { inputCtxRef.current?.close() } catch {}
      try { outputCtxRef.current?.close() } catch {}
      sessionRef.current = null
      micNodeRef.current = null
      micStreamRef.current = null
      inputCtxRef.current = null
      outputCtxRef.current = null
    }

    // ── Connect ─────────────────────────────────────────────────────────────
    useEffect(() => {
      let cancelled = false
      // Reset all per-connection flags. Without this, React StrictMode (or
      // any remount in dev) would leave `closedRef`/`beganRef` stuck from
      // the previous effect, silently breaking the second connection.
      closedRef.current = false
      beganRef.current = false
      beganAnchorSpokenRef.current = false
      modelSpeakingRef.current = false

      ;(async () => {
        try {
          // 1. Mint ephemeral token
          const tokRes = await fetch('/api/utilities?resource=onboarding-token', {
            method: 'POST',
          })
          if (!tokRes.ok) throw new Error('Token mint failed')
          const { token, model } = await tokRes.json()
          if (cancelled) return

          // 2. Audio contexts (relies on preceding user gesture)
          const inputCtx = new AudioContext({ sampleRate: 48000 })
          const outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
          inputCtxRef.current = inputCtx
          outputCtxRef.current = outputCtx
          await inputCtx.audioWorklet.addModule('/onboarding-mic-worklet.js')

          // 3. Mic — translate the browser's terse errors into something
          //    actionable. Permission denied is by far the most common failure
          //    and the generic "NotAllowedError" is not helpful on its own.
          let stream: MediaStream
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
          } catch (micErr: any) {
            const name = micErr?.name || ''
            if (name === 'NotAllowedError' || name === 'SecurityError') {
              throw new Error("Microphone access was blocked. Allow mic access in your browser's site settings, then reload.")
            }
            if (name === 'NotFoundError' || name === 'OverconstrainedError') {
              throw new Error('No microphone found — plug one in or pick a different input device.')
            }
            if (name === 'NotReadableError') {
              throw new Error("Your microphone is busy in another app. Close it there and try again.")
            }
            throw new Error(`Couldn't access the microphone${micErr?.message ? `: ${micErr.message}` : ''}.`)
          }
          if (cancelled) {
            stream.getTracks().forEach(t => t.stop())
            return
          }
          micStreamRef.current = stream

          const sourceNode = inputCtx.createMediaStreamSource(stream)
          const workletNode = new AudioWorkletNode(inputCtx, 'onboarding-mic-processor')
          micNodeRef.current = workletNode
          sourceNode.connect(workletNode)

          // 4. Connect to Live API
          const ai = new GoogleGenAI({
            apiKey: token,
            httpOptions: { apiVersion: 'v1alpha' },
          })

          // Some versions of the @google/genai SDK fire `onopen` synchronously
          // during the `await ai.live.connect(...)` promise — i.e. BEFORE we
          // get a chance to store the session ref. If that happens and we
          // immediately signal the parent via onReady, the parent's
          // begin() ends up running against a null sessionRef and does
          // nothing. Defer the ready signal until after the session is
          // stored; if onopen arrived early, fire the signal manually.
          let openedEarly = false

          const session = await ai.live.connect({
            model,
            config: {
              responseModalities: [Modality.AUDIO],
              systemInstruction: SYSTEM_INSTRUCTION,
              speechConfig: {
                voiceConfig: {
                  // Aoede — softer, warmer "thoughtful friend" voice. Kore
                  // previously sounded clipped and slightly robotic for a
                  // reflective conversation.
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  // HIGH start = detect user's voice quickly even if they begin softly.
                  // LOW end   = wait longer before deciding they've stopped speaking.
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 300,
                  // 1.8s of silence before we consider the user done. Long enough
                  // that they can pause mid-thought without being cut off, short
                  // enough that the reply doesn't feel delayed when they're
                  // actually finished.
                  silenceDurationMs: 1800,
                },
              },
            } as any,
            callbacks: {
              onopen: () => {
                if (cancelled) return
                console.info('[LiveVoice] session open')
                if (sessionRef.current) {
                  // Session already stored — safe to signal parent now.
                  setStatus('ready')
                  onReadyRef.current?.()
                } else {
                  // onopen fired DURING the connect await; defer the
                  // ready signal until sessionRef.current is set below.
                  openedEarly = true
                }
              },
              onmessage: (message: LiveServerMessage) => {
                handleServerMessage(message)
              },
              onerror: (e: any) => {
                console.error('[LiveVoice] socket error', e)
                const detail = e?.message || e?.reason || e?.code || (typeof e === 'string' ? e : '')
                handleError(detail ? `Live error: ${detail}` : 'Live session error (check console)')
              },
              onclose: (e: any) => {
                const reason = e?.reason || e?.code || ''
                console.warn('[LiveVoice] socket closed', reason, e)
                if (statusRef.current === 'connecting') {
                  handleError(reason ? `Connection closed: ${reason}` : 'Voice connection closed unexpectedly')
                }
              },
            },
          })

          if (cancelled) {
            session.close()
            return
          }
          sessionRef.current = session

          // If onopen fired during the await, the ready-signal was
          // deferred. Now that the session is stored, fire it.
          if (openedEarly) {
            console.info('[LiveVoice] firing deferred onReady (onopen arrived early)')
            setStatus('ready')
            onReadyRef.current?.()
          }

          // 5. Pump mic PCM into the Live session — but gate the uplink
          //    whenever Aperture is audible. Browser echo cancellation is
          //    imperfect, and the model's own voice leaking back as "user
          //    input" makes it interrupt itself or loop on its own tail.
          //
          //    We gate on TWO signals: modelSpeakingRef (currently
          //    generating) OR activePlaybackRef.length > 0 (queued audio
          //    still playing out of the output context). The second check
          //    is essential because turnComplete fires as soon as the
          //    model FINISHES GENERATING — the scheduled AudioBufferSource
          //    nodes are still playing for up to a few hundred ms after
          //    that. Without this gate, the mic opens during that tail
          //    and the Live model hears itself finishing its own sentence.
          workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            if (!sessionRef.current || closedRef.current) return
            if (mutedRef.current) return
            if (modelSpeakingRef.current) return
            if (activePlaybackRef.current.length > 0) return
            try {
              sessionRef.current.sendRealtimeInput({
                audio: {
                  data: int16ToBase64(event.data),
                  mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
                },
              })
            } catch (err) {
              console.error('[LiveVoice] sendRealtimeInput failed', err)
            }
          }
        } catch (err: any) {
          if (cancelled) return
          console.error('[LiveVoice] init failed', err)
          handleError(err?.message || 'Failed to start voice session')
        }
      })()

      return () => {
        cancelled = true
        teardown()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Server message handling ─────────────────────────────────────────────
    const handleServerMessage = (message: LiveServerMessage) => {
      const sc: any = (message as any).serverContent
      if (!sc) return

      // Model audio chunks
      const parts = sc.modelTurn?.parts as Array<any> | undefined
      if (parts) {
        for (const p of parts) {
          const inline = p.inlineData
          if (inline?.data && inline.mimeType?.startsWith('audio/pcm')) {
            const pcm = base64ToInt16Array(inline.data)
            enqueueOutputAudio(pcm)
            modelSpeakingRef.current = true
            if (statusRef.current !== 'speaking') setStatus('speaking')
          }
        }
      }

      // Incremental transcripts
      if (sc.inputTranscription?.text) {
        userTranscriptBufferRef.current += sc.inputTranscription.text
        onUserSpeakingRef.current?.(userTranscriptBufferRef.current)
      }
      if (sc.outputTranscription?.text) {
        modelTranscriptBufferRef.current += sc.outputTranscription.text
        onModelSpeakingRef.current?.(modelTranscriptBufferRef.current)
      }

      // User barged in. Kill the model's remaining playback so their voice
      // doesn't keep talking over the user, and re-open the mic uplink.
      if (sc.interrupted) {
        stopAllPlayback()
        modelSpeakingRef.current = false
        setStatus('listening')
      }

      // Turn complete — hand both transcripts to the parent.
      if (sc.turnComplete) {
        const user = userTranscriptBufferRef.current.trim()
        const modelText = modelTranscriptBufferRef.current.trim()
        console.info('[LiveVoice] turnComplete', {
          user_len: user.length,
          model_len: modelText.length,
          anchor_spoken: beganAnchorSpokenRef.current,
        })
        userTranscriptBufferRef.current = ''
        modelTranscriptBufferRef.current = ''
        modelSpeakingRef.current = false
        setStatus('listening')

        // Skip "empty user" turns: when the model finished speaking and VAD
        // never detected a real user utterance (just background noise or
        // silence), we don't want to process it or observe it as a turn —
        // that would make the model appear to "talk to itself" after
        // half-a-second of user silence.
        if (!user && !beganAnchorSpokenRef.current) {
          // This is the very first turnComplete after begin() — the model
          // has just finished speaking the anchor question. Mark that and
          // wait for the real user turn. Don't bubble it up as a "turn".
          beganAnchorSpokenRef.current = true
          return
        }
        if (!user) {
          // Subsequent empty turn (usually VAD firing on ambient noise with
          // no real speech). Ignore — don't call observer, don't disturb
          // the model. The user's next real utterance will start the next
          // turn naturally.
          return
        }

        onTurnCompleteRef.current(user, modelText)
      }
    }

    // ── Imperative handle ──────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        begin: () => {
          if (beganRef.current) return
          const session = sessionRef.current
          if (!session) {
            console.warn('[LiveVoice] begin() called before session ready — retry when onReady fires')
            return
          }
          beganRef.current = true
          try {
            // Seed an opening user turn. Keep it short and plausibly
            // human — the Live API responds most reliably to natural
            // speech-shaped seeds, not meta-instructions. The system
            // prompt is what pins the verbatim opener; the seed just
            // tips the model into its first reply.
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: "Hi." }],
                },
              ],
              turnComplete: true,
            } as any)
            console.info('[LiveVoice] begin seed sent')
          } catch (err) {
            console.error('[LiveVoice] begin failed', err)
            beganRef.current = false
            handleError('Could not start the conversation. Refresh to try again.')
          }
        },
        sendUserText: (text: string) => {
          const session = sessionRef.current
          if (!session || !text) return
          try {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text }] }],
              turnComplete: true,
            } as any)
            // Mirror the typed text into the user transcript buffer so the
            // parent sees it through onTurnComplete later.
            userTranscriptBufferRef.current += text
            onUserSpeakingRef.current?.(userTranscriptBufferRef.current)
          } catch (err) {
            console.error('[LiveVoice] sendUserText failed', err)
          }
        },
        close: () => {
          teardown()
        },
      }),
      [],
    )

    // ── Visual (tiny status pill) ──────────────────────────────────────────
    if (hideVisualizer && status !== 'error') return null

    if (status === 'error') {
      return (
        <div className="flex flex-col items-center gap-2 text-sm" style={{ color: 'var(--brand-danger, #dc2626)' }}>
          <Mic className="h-6 w-6 opacity-50" />
          <span>{errorMsg}</span>
        </div>
      )
    }
    if (status === 'connecting') {
      return (
        <div className="flex flex-col items-center gap-3 text-xs" style={{ color: 'var(--brand-text-secondary)' }}>
          <Loader2 className="h-5 w-5 animate-spin opacity-60" />
          <span className="opacity-60">Connecting voice…</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-3">
        <motion.div
          animate={{
            scale: status === 'listening' ? [1, 1.08, 1] : 1,
            opacity: status === 'speaking' ? 0.6 : 1,
          }}
          transition={{
            duration: status === 'listening' ? 1.6 : 0.3,
            repeat: status === 'listening' ? Infinity : 0,
            ease: 'easeInOut',
          }}
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: 'rgba(var(--brand-primary-rgb),0.12)',
            border: '1px solid rgba(var(--brand-primary-rgb),0.3)',
          }}
        >
          <Mic className="h-7 w-7" style={{ color: 'var(--brand-primary)' }} />
        </motion.div>
        <span
          className="text-[11px] uppercase tracking-wide opacity-50"
          style={{ color: 'var(--brand-text-secondary)' }}
        >
          {status === 'speaking' ? 'speaking' : 'listening'}
        </span>
      </div>
    )
  },
)
