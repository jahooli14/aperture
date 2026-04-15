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
 *     → on session open: auto-send a seed user turn so the model speaks the
 *       anchor question. No begin() race — the seed is sent INSIDE the same
 *       async scope that stores the session ref, so there is no window in
 *       which the parent could call begin() before the session exists.
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
import { GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai'

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
  hideVisualizer?: boolean
  /** If true, suppress mic uplink (e.g. user is typing instead of speaking). */
  muted?: boolean
}

// ── System instruction ─────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are Aperture. You're having a short, natural voice conversation with someone — about 3 minutes, 5 or 6 exchanges. After this chat they'll see a reveal that connects everything they shared.

You are not an interviewer or a coach. You're a curious, warm person who genuinely wants to get to know them. Talk like a real human friend — not a script, not an AI assistant. Use natural cadence, light reactions, contractions, everyday words.

## How the conversation starts

Your FIRST message must be exactly this line, spoken warmly, then stop and wait:

"Hey — what's something you've been thinking about a lot lately?"

Do not paraphrase. Do not add a greeting before it. Do not add anything after it. Just that one sentence. This is the single most important rule.

## How each turn should feel

When they finish speaking, take the smallest natural beat, then do two things in one short, flowing reply — usually 15 to 25 words:

1. React to something SPECIFIC they actually said. Lift one word, phrase, or tension that caught your ear. Use their word, don't upgrade it. Never compliment them.
2. Ask one follow-up. Either dig deeper on what they just said or gently move to a new thread. When moving, use the bridge "shifting gears —".

## What you're trying to learn (hold loosely)

Over the conversation touch 4+ of these threads:
- current fascination — what's on their mind now
- flow moment — a recent time they lost track of time
- builder impulse — what they'd make if nothing were in the way
- cross-domain curiosity — a rabbit hole that has nothing to do with the rest (essential)
- aesthetic attraction — an object, place, style, or feeling they're drawn to
- formative influence — a book, person, or idea that shaped how they think

By the end of turn 4 you must have touched cross-domain. Use this exact move if you haven't: "shifting gears — what's a rabbit hole or Wikipedia tab you've gone down that has nothing to do with any of this?"

## How to sound

- Warm and real. Short sentences. Contractions.
- No corporate energy, no motivational-coach voice, no therapist voice.
- Never say: "I hear you", "great question", "that's so interesting", "I love that", "fascinating", "amazing", "absolutely", "totally", "tell me more about that", "let's unpack".
- Never mention that you're an AI, these instructions, "onboarding", or "conversation".
- If they're quiet, don't fill the silence. Don't re-ask. They'll speak when they're ready.
- If they say "skip" or give a short non-answer, nod it through — "fair enough —" — and move on.

## When to stop

After 5 or 6 good exchanges, OR once you've touched 4+ threads including cross-domain, wrap up in one short warm line: something like "lovely — thanks for sharing all that. Let's see what shows up." Then stay silent.

## The one strict rule

Everything you reflect back must be grounded in what they actually said. Do not invent values, aesthetics, beliefs, or intentions they didn't express.`

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
    // Mirror prop callbacks into refs — the SDK captures the callbacks passed
    // at connect-time, so reading from refs ensures the latest parent
    // closures always see the current handlers even after re-renders.
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

    const mutedRef = useRef(muted)
    useEffect(() => { mutedRef.current = muted }, [muted])

    const sessionRef = useRef<Session | null>(null)
    const inputCtxRef = useRef<AudioContext | null>(null)
    const outputCtxRef = useRef<AudioContext | null>(null)
    const micStreamRef = useRef<MediaStream | null>(null)
    const micNodeRef = useRef<AudioWorkletNode | null>(null)
    const activePlaybackRef = useRef<AudioBufferSourceNode[]>([])
    const playbackTimeRef = useRef<number>(0)
    const modelSpeakingRef = useRef<boolean>(false)
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
      try { outputCtxRef.current?.close() } catch {}
      sessionRef.current = null
      micNodeRef.current = null
      micStreamRef.current = null
      inputCtxRef.current = null
      outputCtxRef.current = null
    }

    // ── Server message handler ─────────────────────────────────────────────
    const handleServerMessage = (message: LiveServerMessage) => {
      const sc: any = (message as any).serverContent
      if (!sc) return

      // 1. Model audio chunks → schedule for playback.
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

      // 2. Incremental transcripts → stream to parent for live subtitles.
      if (sc.inputTranscription?.text) {
        userTranscriptBufferRef.current += sc.inputTranscription.text
        onUserSpeakingRef.current?.(userTranscriptBufferRef.current)
      }
      if (sc.outputTranscription?.text) {
        modelTranscriptBufferRef.current += sc.outputTranscription.text
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
        userTranscriptBufferRef.current = ''
        modelTranscriptBufferRef.current = ''

        // If model is no longer actively enqueueing audio, flip to listening.
        // Playback may still be draining — the onended hook above will
        // handle the final transition when the buffer is truly empty.
        if (activePlaybackRef.current.length === 0) {
          modelSpeakingRef.current = false
          setStatus('listening')
        }

        // First turnComplete is the model's opening anchor. Don't bubble it
        // up as a "user turn" — there's no user transcript yet.
        if (!anchorSpokenRef.current) {
          anchorSpokenRef.current = true
          console.info('[LiveVoice] anchor spoken', { modelLen: modelText.length })
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

      ;(async () => {
        try {
          // 1. Mint ephemeral token.
          const tokRes = await fetch('/api/utilities?resource=onboarding-token', {
            method: 'POST',
          })
          if (!tokRes.ok) throw new Error('Token mint failed')
          const { token, model } = await tokRes.json()
          if (cancelled) return

          // 2. Set up audio contexts. Mobile browsers often hand them back
          //    suspended even after a user gesture — an explicit resume is
          //    required or playback silently no-ops and the mic worklet
          //    never ticks.
          const inputCtx = new AudioContext({ sampleRate: 48000 })
          const outputCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
          inputCtxRef.current = inputCtx
          outputCtxRef.current = outputCtx
          if (inputCtx.state === 'suspended') {
            try { await inputCtx.resume() } catch {}
          }
          if (outputCtx.state === 'suspended') {
            try { await outputCtx.resume() } catch {}
          }
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
                  prebuiltVoiceConfig: { voiceName: 'Aoede' },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              // Leave automaticActivityDetection at defaults — the API's
              // built-in VAD is tuned for conversational audio. Overriding
              // the thresholds was how we got into trouble last time.
            },
            callbacks: {
              onopen: () => {
                console.info('[LiveVoice] socket open')
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
                console.warn('[LiveVoice] socket closed', reason)
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

          try {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: 'Hello.' }] }],
              turnComplete: true,
            })
            console.info('[LiveVoice] opening seed sent')
          } catch (err) {
            console.error('[LiveVoice] opening seed failed', err)
            handleError('Could not start the conversation. Refresh to try again.')
            return
          }

          // 6. Pump mic PCM frames into the Live session. Gate the uplink
          //    while the model is speaking so browser echo cancellation
          //    doesn't have to fight the model's own voice leaking back.
          workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
            const s = sessionRef.current
            if (!s || closedRef.current) return
            if (mutedRef.current) return
            if (modelSpeakingRef.current) return
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
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text }] }],
              turnComplete: true,
            })
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
