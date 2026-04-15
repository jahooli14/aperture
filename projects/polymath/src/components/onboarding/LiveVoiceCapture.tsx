/**
 * LiveVoiceCapture — Gemini Live API voice transport for Aperture onboarding.
 *
 * Clean-room rewrite — follows the documented Google Gen AI SDK pattern for
 * bidirectional audio conversations. Deliberately minimal: no observer
 * parallelism in here, no deferred-onReady races, no short-form begin()
 * experiments. If the voice stops working, fix it HERE — do not layer
 * another patch on top.
 *
 * Reference: https://ai.google.dev/gemini-api/docs/live-api/get-started-sdk
 *            https://ai.google.dev/gemini-api/docs/live-guide
 *
 * Lifecycle:
 *   mount
 *     → mint ephemeral token from /api/utilities?resource=onboarding-token
 *     → open AudioContext (input 48k, output 24k) + mic worklet @ 16kHz PCM
 *     → ai.live.connect with AUDIO response modality + transcription enabled
 *     → on session open: auto-send a seed user turn via sendRealtimeInput
 *       so the model speaks the anchor question. sendClientContent is NOT
 *       used — per the Live API docs, sendClientContent is reserved for
 *       seeding initial CONTEXT HISTORY and rejects new-turn content with
 *       "Request contains an invalid argument". Use sendRealtimeInput for
 *       all text/audio/video input during a live session.
 *     → pump mic PCM into sendRealtimeInput (gated while the model is
 *       generating audio so we don't feed the model its own voice).
 *     → receive model audio chunks → schedule on the output AudioContext.
 *     → receive transcription deltas → stream to parent via onModelSpeaking /
 *       onUserSpeaking.
 *     → on serverContent.turnComplete: flush buffered transcripts to parent
 *       via onTurnComplete.
 *   unmount / close()
 *     → tear down session + audio contexts + mic tracks.
 */

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Mic, Loader2 } from 'lucide-react'
import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, type Session, type LiveServerMessage } from '@google/genai'

// ── Public API ─────────────────────────────────────────────────────────────

export interface LiveVoiceCaptureHandle {
  /** Ensure the conversation has started. Safe to call from anywhere — the
   *  seed is auto-sent on connection regardless, so this is now a no-op
   *  outside of the retry case. Kept for interface compatibility. */
  begin: () => void
  /** Inject a typed user message (typing fallback). */
  sendUserText: (text: string) => void
  /** Close the Live session gracefully. */
  close: () => void
}

export type LiveVoiceStatus = 'connecting' | 'ready' | 'speaking' | 'listening' | 'error'

interface LiveVoiceCaptureProps {
  onTurnComplete: (userTranscript: string, modelUtterance: string) => void
  onModelSpeaking?: (accumulated: string) => void
  onUserSpeaking?: (accumulated: string) => void
  onReady?: () => void
  onStatusChange?: (status: LiveVoiceStatus) => void
  onError?: (message: string) => void
  /** Fires on every significant lifecycle event — token mint, socket open,
   *  seed sent, audio received, turn complete, errors. Used to surface an
   *  on-screen diagnostic log when voice fails silently (mobile browsers
   *  without a console). Events are short human-readable tags. */
  onDiagnostic?: (event: string) => void
  hideVisualizer?: boolean
  /** If true, suppress mic uplink (e.g. user is typing instead of speaking). */
  muted?: boolean
  /** Pre-unlocked AudioContext from a user gesture. Required for reliable
   *  audio playback on iOS Safari — the context must be created + resumed
   *  synchronously inside a tap handler or playback silently no-ops. If
   *  omitted, a new context is created here (fine on desktop). The parent
   *  retains ownership and we will NOT close it on teardown. */
  outputAudioContext?: AudioContext | null
}

// ── System instruction ─────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are Aperture. You're having a short, natural voice conversation with someone — about 3 minutes, 5 or 6 exchanges. After this chat they'll see a reveal that connects everything they shared.

You are not an interviewer or a coach. You're a curious, warm person who genuinely wants to get to know them. Talk like a real human friend — not a script, not an AI assistant. Use natural cadence, light reactions, contractions, everyday words.

## How the conversation starts

Your FIRST message must be exactly this line, spoken warmly, then stop and wait:

"Hey — what's something you've been thinking about a lot lately?"

Do not paraphrase, rewrite, shorten, lengthen, or substitute synonyms. Do not add a greeting before it. Do not add anything after it. Just that one sentence. This is the single most important rule.

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

Everything you reflect back must be grounded in what they actually said — their words, not upgrades of their words. Do not make up values, aesthetics, beliefs, or intentions they didn't express. If you can't ground it, ask a small clarifier instead of pretending.`

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
    { onTurnComplete, onModelSpeaking, onUserSpeaking, onReady, onStatusChange, onError, onDiagnostic, hideVisualizer = false, muted = false, outputAudioContext = null },
    ref,
  ) {
    // Mirror prop callbacks into refs — the SDK captures the callbacks passed
    // at connect-time, so reading from refs ensures the latest parent
    // closures always see the current handlers even after re-renders.
    const onTurnCompleteRef = useRef(onTurnComplete)
    const onModelSpeakingRef = useRef(onModelSpeaking)
    const onUserSpeakingRef = useRef(onUserSpeaking)
    const onReadyRef = useRef(onReady)
    const onStatusChangeRef = useRef(onStatusChange)
    const onErrorRef = useRef(onError)
    const onDiagnosticRef = useRef(onDiagnostic)
    useEffect(() => { onTurnCompleteRef.current = onTurnComplete }, [onTurnComplete])
    useEffect(() => { onModelSpeakingRef.current = onModelSpeaking }, [onModelSpeaking])
    useEffect(() => { onUserSpeakingRef.current = onUserSpeaking }, [onUserSpeaking])
    useEffect(() => { onReadyRef.current = onReady }, [onReady])
    useEffect(() => { onStatusChangeRef.current = onStatusChange }, [onStatusChange])
    useEffect(() => { onErrorRef.current = onError }, [onError])
    useEffect(() => { onDiagnosticRef.current = onDiagnostic }, [onDiagnostic])

    const diag = (event: string) => {
      console.info('[LiveVoice]', event)
      onDiagnosticRef.current?.(event)
    }

    const mutedRef = useRef(muted)
    useEffect(() => { mutedRef.current = muted }, [muted])

    const sessionRef = useRef<Session | null>(null)
    const inputCtxRef = useRef<AudioContext | null>(null)
    const outputCtxRef = useRef<AudioContext | null>(null)
    // Whether we own the output context (and are responsible for closing it)
    // vs. the parent supplied it (keep it alive across remounts for iOS).
    const outputCtxOwnedRef = useRef<boolean>(false)
    const micStreamRef = useRef<MediaStream | null>(null)
    const micNodeRef = useRef<AudioWorkletNode | null>(null)
    const activePlaybackRef = useRef<AudioBufferSourceNode[]>([])
    const playbackTimeRef = useRef<number>(0)
    const modelSpeakingRef = useRef<boolean>(false)
    // Whether the model has actually produced audio or transcription in the
    // current turn. Guards the anchor-detection flip so a stray server-side
    // turnComplete (keepalive, transient reset) can't silently consume the
    // anchor slot and eat the first real user turn.
    const modelProducedOutputRef = useRef<boolean>(false)
    const userTranscriptBufferRef = useRef<string>('')
    const modelTranscriptBufferRef = useRef<string>('')
    const anchorSpokenRef = useRef<boolean>(false)
    const closedRef = useRef<boolean>(false)

    const [status, setStatusRaw] = useState<LiveVoiceStatus>('connecting')
    const statusRef = useRef<LiveVoiceStatus>('connecting')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const setStatus = (s: LiveVoiceStatus) => {
      if (statusRef.current === s) return
      statusRef.current = s
      setStatusRaw(s)
      onStatusChangeRef.current?.(s)
    }

    // ── Audio output ────────────────────────────────────────────────────────
    const enqueueOutputAudio = (pcm: Int16Array) => {
      const ctx = outputCtxRef.current
      if (!ctx || closedRef.current) return
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
        // When the very last chunk in flight finishes, mark the model as
        // done speaking so the mic uplink re-opens.
        if (activePlaybackRef.current.length === 0) {
          modelSpeakingRef.current = false
          if (statusRef.current === 'speaking') setStatus('listening')
        }
      }
    }

    const stopAllPlayback = () => {
      for (const s of activePlaybackRef.current) {
        try { s.stop() } catch {}
        try { s.disconnect() } catch {}
      }
      activePlaybackRef.current = []
      playbackTimeRef.current = outputCtxRef.current?.currentTime || 0
    }

    const handleError = (msg: string) => {
      setErrorMsg(msg)
      setStatus('error')
      onErrorRef.current?.(msg)
    }

    const teardown = () => {
      closedRef.current = true
      stopAllPlayback()
      try { sessionRef.current?.close() } catch {}
      try { micNodeRef.current?.disconnect() } catch {}
      try { micStreamRef.current?.getTracks().forEach(t => t.stop()) } catch {}
      try { inputCtxRef.current?.close() } catch {}
      // Only close the output context if WE created it. If the parent
      // supplied a pre-unlocked context (iOS gesture-unlock path), closing
      // it would kick us back to the suspended state on reconnect.
      if (outputCtxOwnedRef.current) {
        try { outputCtxRef.current?.close() } catch {}
      }
      sessionRef.current = null
      micNodeRef.current = null
      micStreamRef.current = null
      inputCtxRef.current = null
      outputCtxRef.current = null
      outputCtxOwnedRef.current = false
    }

    // ── Server message handler ─────────────────────────────────────────────
    const handleServerMessage = (message: LiveServerMessage) => {
      const m: any = message as any

      // Diagnostic fanout — the SDK occasionally delivers non-serverContent
      // frames (setupComplete, errors, tool calls, usage metadata) that
      // the old code silently dropped. If setup failed or the model
      // rejected our config, we need to SEE it, not swallow it.
      if (m.setupComplete) {
        diag('setup-complete')
      }
      if (m.error) {
        const detail = m.error?.message || JSON.stringify(m.error).slice(0, 120)
        diag(`server-error: ${detail}`)
        handleError(`Voice service error: ${detail}`)
        return
      }
      if (m.goAway) {
        diag(`go-away: ${m.goAway?.timeLeft || 'now'}`)
      }

      const sc: any = m.serverContent
      if (!sc) return

      // 1. Model audio chunks → schedule for playback.
      const parts = sc.modelTurn?.parts as Array<any> | undefined
      if (parts) {
        let audioCount = 0
        let textCount = 0
        for (const p of parts) {
          const inline = p.inlineData
          if (inline?.data && inline.mimeType?.startsWith('audio/pcm')) {
            const pcm = base64ToInt16Array(inline.data)
            enqueueOutputAudio(pcm)
            modelSpeakingRef.current = true
            modelProducedOutputRef.current = true
            audioCount++
            if (statusRef.current !== 'speaking') setStatus('speaking')
          } else if (p.text) {
            // If the model falls back to text (e.g. responseModalities
            // wasn't honored, or model/config mismatch), flag it loudly —
            // we will NEVER get audio for that turn.
            textCount++
            modelProducedOutputRef.current = true
            modelTranscriptBufferRef.current += p.text
            onModelSpeakingRef.current?.(modelTranscriptBufferRef.current)
          }
        }
        if (audioCount === 0 && textCount > 0) {
          diag(`WARN text-only response (no audio) text=${textCount}`)
        } else if (audioCount > 0 && !anchorSpokenRef.current) {
          // First time we've heard actual audio from the model.
          diag(`audio-chunk #1 bytes=${parts.length}`)
        }
      }

      // 2. Incremental transcripts → stream to parent for live subtitles.
      if (sc.inputTranscription?.text) {
        userTranscriptBufferRef.current += sc.inputTranscription.text
        onUserSpeakingRef.current?.(userTranscriptBufferRef.current)
      }
      if (sc.outputTranscription?.text) {
        modelTranscriptBufferRef.current += sc.outputTranscription.text
        modelProducedOutputRef.current = true
        onModelSpeakingRef.current?.(modelTranscriptBufferRef.current)
      }

      // 3. User interrupted the model → kill outgoing playback.
      if (sc.interrupted) {
        stopAllPlayback()
        modelSpeakingRef.current = false
        setStatus('listening')
      }

      // 4. Turn complete → hand the accumulated transcripts to the parent.
      if (sc.turnComplete) {
        const user = userTranscriptBufferRef.current.trim()
        const modelText = modelTranscriptBufferRef.current.trim()
        const modelSpokeThisTurn = modelProducedOutputRef.current || modelText.length > 0
        userTranscriptBufferRef.current = ''
        modelTranscriptBufferRef.current = ''
        modelProducedOutputRef.current = false

        // If model is no longer actively enqueueing audio, flip to listening.
        // Playback may still be draining — the onended hook above will
        // handle the final transition when the buffer is truly empty.
        if (activePlaybackRef.current.length === 0) {
          modelSpeakingRef.current = false
          setStatus('listening')
        }

        // First turnComplete where the model actually spoke is the anchor.
        // Swallow it — there's no user transcript yet. Crucially we do NOT
        // flip `anchorSpokenRef` on stray server-initiated turnCompletes
        // (keepalive, transient reset, empty protocol frames) — doing so
        // would silently consume the anchor slot and eat the first real
        // user turn.
        if (!anchorSpokenRef.current) {
          if (modelSpokeThisTurn) {
            anchorSpokenRef.current = true
            console.info('[LiveVoice] anchor spoken', { modelLen: modelText.length })
          } else {
            console.warn('[LiveVoice] ignoring stray turnComplete before anchor spoken')
          }
          return
        }
        if (!user) {
          // Empty user turn (VAD false-positive from ambient noise). Ignore.
          return
        }

        onTurnCompleteRef.current(user, modelText)
      }
    }

    // ── Connect ─────────────────────────────────────────────────────────────
    useEffect(() => {
      let cancelled = false
      closedRef.current = false
      anchorSpokenRef.current = false
      modelSpeakingRef.current = false
      modelProducedOutputRef.current = false

      ;(async () => {
        try {
          // 1. Mint ephemeral token.
          diag('token-mint-start')
          const tokRes = await fetch('/api/utilities?resource=onboarding-token', {
            method: 'POST',
          })
          if (!tokRes.ok) {
            const body = await tokRes.text().catch(() => '')
            throw new Error(`Token mint ${tokRes.status}: ${body.slice(0, 80)}`)
          }
          const { token, model } = await tokRes.json()
          diag(`token-minted model=${model}`)
          if (cancelled) return

          // 2. Set up audio contexts. If the parent supplied a pre-unlocked
          //    output context (iOS gesture path), reuse it — creating a new
          //    one here would be outside the gesture tick and silently
          //    remain suspended on iOS Safari. Otherwise construct our own.
          const inputCtx = new AudioContext({ sampleRate: 48000 })
          inputCtxRef.current = inputCtx
          if (outputAudioContext) {
            outputCtxRef.current = outputAudioContext
            outputCtxOwnedRef.current = false
            diag(`output-ctx reused state=${outputAudioContext.state}`)
          } else {
            outputCtxRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
            outputCtxOwnedRef.current = true
            diag(`output-ctx created state=${outputCtxRef.current.state}`)
          }
          const outputCtx = outputCtxRef.current
          if (inputCtx.state === 'suspended') {
            try { await inputCtx.resume() } catch {}
          }
          if (outputCtx.state === 'suspended') {
            try { await outputCtx.resume() } catch {}
          }
          diag(`ctx-resumed in=${inputCtx.state} out=${outputCtx.state}`)
          // Reset playback scheduler — the previous mount's playbackTime may
          // be in the past relative to a reused context's currentTime.
          playbackTimeRef.current = outputCtx.currentTime
          await inputCtx.audioWorklet.addModule('/onboarding-mic-worklet.js')

          // 3. Request mic permission.
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
          diag('mic-acquired')

          const sourceNode = inputCtx.createMediaStreamSource(stream)
          const workletNode = new AudioWorkletNode(inputCtx, 'onboarding-mic-processor')
          micNodeRef.current = workletNode
          sourceNode.connect(workletNode)

          // 4. Connect to the Live API. We use v1alpha for ephemeral token
          //    support. The config shape below mirrors the docs exactly —
          //    do not add `as any` casts; if a field is rejected, the SDK's
          //    type error is the signal that the API has changed.
          const ai = new GoogleGenAI({
            apiKey: token,
            httpOptions: { apiVersion: 'v1alpha' },
          })

          const session = await ai.live.connect({
            model,
            config: {
              responseModalities: [Modality.AUDIO],
              systemInstruction: SYSTEM_INSTRUCTION,
              speechConfig: {
                voiceConfig: {
                  // Aoede — softer, warmer "thoughtful friend" voice.
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              // Custom VAD tuned for a reflective 3-minute chat where people
              // pause mid-thought. The defaults are ~800ms of silence, which
              // cut users off mid-sentence in dogfood. HIGH start sensitivity
              // picks up softly-begun speech; LOW end + 1800ms silence lets
              // people think before they finish.
              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
                  endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                  prefixPaddingMs: 300,
                  silenceDurationMs: 1800,
                },
              },
            },
            callbacks: {
              onopen: () => {
                diag('socket-open')
              },
              onmessage: (message: LiveServerMessage) => {
                handleServerMessage(message)
              },
              onerror: (e: any) => {
                const detail = e?.message || e?.reason || e?.code || (typeof e === 'string' ? e : '')
                diag(`socket-error: ${detail || 'unknown'}`)
                handleError(detail ? `Live error: ${detail}` : 'Live session error (check console)')
              },
              onclose: (e: any) => {
                const reason = e?.reason || e?.code || ''
                diag(`socket-close: ${reason || 'no-reason'}`)
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

          // 5. Signal ready to the parent and auto-trigger the opening turn.
          //    By sending the seed in the SAME async scope that stored the
          //    session, we eliminate the begin()-before-ready race entirely.
          //    The system instruction tells the model exactly what to say
          //    on the first turn, so any nudge is enough — the content of
          //    the seed message is irrelevant.
          setStatus('ready')
          onReadyRef.current?.()

          // Seed via sendRealtimeInput — this is the documented API for
          // new user messages on an audio session. `sendClientContent` is
          // reserved for seeding initial CONTEXT history (requires the
          // `initial_history_in_client_content` flag in history_config)
          // and WILL be rejected with "Request contains an invalid
          // argument" if used for new turns. The diagnostic log from a
          // previous iteration of this file showed exactly that failure
          // mode — setup-complete arrived, then the socket immediately
          // closed on our sendClientContent call.
          try {
            session.sendRealtimeInput({ text: 'Hello.' })
            diag('seed-sent (sendRealtimeInput)')
          } catch (err: any) {
            diag(`seed-failed: ${err?.message || 'unknown'}`)
            handleError('Could not start the conversation. Refresh to try again.')
            return
          }

          // 6. Pump mic PCM frames into the Live session. Gate the uplink
          //    whenever Aperture is audible. Browser echo cancellation is
          //    imperfect, and the model's own voice leaking back as "user
          //    input" makes it interrupt itself or loop on its own tail.
          //
          //    We gate on TWO signals: `modelSpeakingRef` (currently
          //    generating) OR `activePlaybackRef.length > 0` (queued audio
          //    still playing out of the output context). The second check
          //    is essential because turnComplete fires as soon as the model
          //    FINISHES GENERATING — the scheduled AudioBufferSource nodes
          //    are still playing for up to a few hundred ms after that.
          //    Without this gate, the mic opens during that tail and the
          //    Live model hears itself finishing its own sentence.
          workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            const s = sessionRef.current
            if (!s || closedRef.current) return
            if (mutedRef.current) return
            if (modelSpeakingRef.current) return
            if (activePlaybackRef.current.length > 0) return
            try {
              s.sendRealtimeInput({
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
          diag(`init-failed: ${err?.message || 'unknown'}`)
          // Ensure any partial resources we allocated before the failure
          // (AudioContexts, mic tracks, worklet node) are released. Without
          // this, a token-mint or getUserMedia failure leaves the page with
          // an open AudioContext + mic stream until the user navigates away.
          teardown()
          handleError(err?.message || 'Failed to start voice session')
        }
      })()

      return () => {
        cancelled = true
        teardown()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Imperative handle ──────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        // Kept for interface compatibility — the seed is auto-sent on
        // connection now, so this is a no-op in the happy path.
        begin: () => {},
        sendUserText: (text: string) => {
          const session = sessionRef.current
          if (!session || !text) return
          try {
            // Use sendRealtimeInput for user text during the conversation —
            // sendClientContent is only for seeding initial history and
            // will close the socket with "invalid argument" otherwise.
            session.sendRealtimeInput({ text })
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

    // ── Visual ─────────────────────────────────────────────────────────────
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
