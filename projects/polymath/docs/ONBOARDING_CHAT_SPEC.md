# Aperture — Contextual Onboarding Chat Spec

> User-facing brand: **Aperture**. Internal codebase: Polymath.

## Goal

Replace the static 5-voice-question onboarding with an adaptive, two-way voice chat that gathers dense enough signal for the post-onboarding reveal (drawer projects + Weekly Intersections) to feel personal and specific. Target: ~3 minutes, but driven by coverage, not a visible timer.

## Model stack

| Role | Model | Why |
|---|---|---|
| Conversational loop (audio-in / audio-out, VAD, reframe + segue) | `gemini-3.1-flash-live-preview` | Native audio, low latency, built-in turn detection |
| Coverage planner (between turns: which slot to target next, stop-or-continue) | `gemini-3.1-flash-lite-preview` | Cheapest/fastest text model for structured JSON decisions |
| Post-session analysis (existing `/api/utilities?resource=analyze`) | `gemini-2.5-flash` | Upgrade from deprecated `gemini-2.0-flash-lite` for richer `OnboardingAnalysis` output |

`thinkingLevel: "minimal"` on the Live model for lowest latency. All model IDs to be verified against Google AI docs at implementation time (per CLAUDE.md rule).

## Flow

```
[Welcome card: "Aperture in 3 minutes" CTA]
        ↓
[Anchor question — spoken + on-screen]
        ↓
┌──────────── turn loop ────────────┐
│ User speaks → waveform            │
│ VAD end-of-turn                   │
│ Transcript fades in (1s, read)    │
│ Reframe + (deepen | pivot) utter. │
│ Planner updates coverage grid     │
│ Dot lights up (randomized slot)   │
│ Stop? → reveal. Else → next turn. │
└───────────────────────────────────┘
        ↓
[Existing post-analysis → RevealSequence]
```

## Anchor question (always first, always the same)

> *"What's alive for you at the moment — something you keep circling back to?"*

## Coverage grid

Six slots. Planner maintains `confidence` 0-1 per slot, updated each turn.

| Slot | What we're learning | Reveal impact |
|---|---|---|
| `current_fascination` | What's on their mind right now | First insight seed; drawer heat signals |
| `builder_impulse` | What they'd make given freedom | `project_suggestions` quality |
| `constraint_blocker` | What's in the way | Catalyst matching in drawer |
| `hidden_capability` | Unexpected skill | "Why you" statement on project reveal |
| `cross_domain_curiosity` | Interest far from main thread | **Critical for Weekly Intersections novelty** |
| `social_signal` | Who for / with | Project framing, collaboration hints |

### Planner contract (after each turn)

Input: full transcript so far + current coverage grid.
Output:

```json
{
  "slot_updates": { "current_fascination": 0.9, "builder_impulse": 0.35 },
  "depth_signal": "high" | "medium" | "low",
  "next_move": "deepen" | "pivot" | "stop",
  "next_slot_target": "cross_domain_curiosity",
  "grounding_phrases": ["minimalist streak", "retired but want to learn welding"],
  "reframe_mode": "orientation" | "tension" | "micro_clarify" | "deepen"
}
```

### Stopping rule

```
stop IF:
  ≥4 slots ≥ 0.6 confidence
  AND cross_domain_curiosity ≥ 0.6 (or 2 pivot attempts already made)
  AND last turn depth_signal ≠ "high"

continue IF:
  any critical slot (current_fascination, cross_domain_curiosity) unfilled
  OR depth_signal == "high" AND under 4-min hard ceiling
```

### Cross-domain enforcement

- After turn 3, if `cross_domain_curiosity < 0.4`, planner MUST pivot to it next turn.
- If user deflects twice ("nothing comes to mind"), mark as attempted and release the hold so we don't badger.

## Reframe modes (prompt for Live model)

The reframe must be grounded in phrases actually present in the transcript. The planner tells the Live model which mode to use.

1. **`orientation`** — name an operative value/aesthetic.
   *"There's a minimalist streak in how you're framing that."*

2. **`tension`** — note an interesting combination or edge.
   *"That's a late-career pivot toward something physical — unusual."*

3. **`micro_clarify`** — transcript too thin, ask a probing clarifier (doesn't count as a full turn).
   *"What would make it feel like yours?"*

4. **`deepen`** — stay on the thread.
   *"Say more about the welding part — what draws you to working with your hands?"*

Pivot turns append a segue ("Shifting gears —"); deepen turns don't.

### Hallucination guardrail

Planner returns `grounding_phrases[]`. If empty, reframe_mode is forced to `micro_clarify`. Never invent a value or intent.

## UX state machine

| State | Visual | Audio |
|---|---|---|
| `idle` | Anchor question text + mic button | Anchor question TTS on first entry |
| `listening` | Large waveform, no text | User's voice streams to Live API |
| `processing` | Waveform collapses to pill; transcript fades in (1s) | — |
| `reframing` | Transcript dims; reframe+next-Q text types out | Live model speaks reframe + next Q |
| `settling` | Dot lights up (random unlit index); waveform returns | — |
| `complete` | Transition to RevealSequence | Soft chime |

### Coverage dots

- 6 dots across bottom.
- At session start, build a random permutation of dot indices 0-5 and assign to slots.
- When a slot crosses 0.6, its assigned dot lights (soft bloom, ~400ms).
- No labels, no ordering hints.

### No visible timer

3 minutes is marketing copy on the welcome screen only. Internally the planner targets ~5 turns but lets rich threads breathe. Hard 4-min safety ceiling is invisible.

### Typing fallback

Small "type instead" link below mic. Opens text input. Same planner pipeline, no audio.

## Existing infra we reuse

- `/src/hooks/useMediaRecorderVoice.ts` — keep for fallback, but primary path is Live API websocket
- `/src/components/VoiceInput.tsx` — waveform already built
- `/api/utilities?resource=analyze` — **upgrade** to take richer input (full transcript + coverage grid) rather than 5 discrete responses
- `OnboardingAnalysis` type — extend to carry `coverage_grid`, `grounding_phrases`, `slot_transcripts`
- `memories` table — each turn still saved as a foundational memory with `memory_type: 'foundational'` and tags for which slot it filled

## New infra to build

- `api/onboarding-chat.ts` — Live API session broker + planner loop
- `api/_lib/onboarding/coverage.ts` — planner prompt + grid state machine
- `api/_lib/onboarding/reframe.ts` — reframe prompt + mode dispatcher
- `src/pages/OnboardingChatPage.tsx` — replaces `OnboardingPage.tsx`
- `src/components/onboarding/CoverageDots.tsx` — the random-permutation dot constellation
- `src/components/onboarding/LiveVoiceCapture.tsx` — Live API websocket client with state machine

## Rollout

Full cutover. Old 5-question flow and `OnboardingPage.tsx` are removed. Feature flag not needed since onboarding only runs once per user and this is pre-reveal (low blast radius).

## Out of scope for v1

- Multi-language support (English only)
- User choosing voice personality
- Resuming interrupted sessions (if they bail, they restart)
- Mid-session "undo my last answer"

## Success criteria

- P50 onboarding completion time: 2.5-3.5 min
- ≥4 of 6 coverage slots filled at 0.6+ in ≥90% of sessions
- Cross-domain slot filled in ≥85% of sessions
- `first_insight` in `OnboardingAnalysis` cites at least 2 distinct coverage slots (measurable via planner grounding phrases)
- Qualitative: reveal feels "for me" not "generic" (dogfood test)
