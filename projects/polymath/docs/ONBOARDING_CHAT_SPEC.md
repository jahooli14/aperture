# Aperture — Contextual Onboarding Chat Spec

> User-facing brand: **Aperture**. Internal codebase: Polymath.

## Goal

Replace the static 5-voice-question onboarding with an adaptive, two-way voice chat that gathers dense enough signal for the post-onboarding reveal (drawer projects + Weekly Intersections) to feel personal and specific. Target: ~3 minutes, but driven by coverage, not a visible timer.

## Implementation status (phased)

**V1 (shipped in this branch):** Full adaptive planner + coverage grid + dots + skip handling + typing fallback + per-turn foundational memory saves. Voice stack is the existing MediaRecorder → Gemini transcribe pipeline, and the reframe is spoken via browser SpeechSynthesis. All server-side logic is final.

**V2 (follow-up):** Replace the voice layer only (record/transcribe/TTS) with a direct Gemini Live API client (`gemini-3.1-flash-live-preview`) for audio-to-audio with native VAD and sub-second turn latency. Swap target: `OnboardingChatPage` + (new) `LiveVoiceCapture` component. Planner, coverage, reframe prompts, dots, skip, typing, analysis are unchanged between V1 and V2.

Why phased: Vercel serverless doesn't play nicely with persistent WebSockets, and the codebase had zero Live API / WS precedent. V1 is a solid working product (~2s stop-to-speak latency); V2 is a focused, isolated upgrade of the audio transport.

## Model stack

All IDs verified against https://ai.google.dev/gemini-api/docs/models on 2026-04-13.

**Hard rule: never hardcode model IDs.** All references resolve through `api/_lib/models.ts` (central `MODELS` export). The Live model is added there as `MODELS.FLASH_LIVE`. `MODELS.PRO` is added as a reserved escape hatch but unused in v1.

| Role | Model | Why |
|---|---|---|
| Conversational loop (audio-in / audio-out, VAD, reframe + segue) | `gemini-3.1-flash-live-preview` | Native audio, low latency, built-in turn detection |
| Coverage planner (between turns: slot updates, next move, stop-or-continue) | `gemini-3.1-flash-lite-preview` | Cheapest/fastest for structured JSON decisions |
| Post-session analysis (`/api/utilities?resource=analyze`) | `gemini-3-flash-preview` | Upgrade from deprecated `gemini-2.0-flash-lite` — richer `OnboardingAnalysis` |
| Escape hatch (if a user session looks exceptionally rich and we want a deeper first_insight) | `gemini-3.1-pro-preview` | Reserved — off by default. Enable behind a per-session flag if we later find flash quality is the bottleneck |

`thinkingLevel: "minimal"` on the Live model for lowest latency. Re-verify IDs at implementation time per CLAUDE.md rule.

## Flow

```
[Welcome card — see "Hook & welcome copy" section]
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

Design principle: **concrete episodic prompts > abstract self-rating.** Voice rewards "tell me about a time when…" framing; it surfaces values, capability and taste implicitly and produces much denser signal than direct questions like "what are your values?". Slots chosen accordingly — each is a multi-signal slot designed to yield data the reveal actually consumes.

| Slot | What we're learning | Reveal impact |
|---|---|---|
| `current_fascination` | What's alive right now (anchor) | First-insight seed; drawer heat signals |
| `flow_moment` | A recent time they were in flow | **Multi-signal**: capability + taste + domain in one answer. "Why you" statement on project reveal. |
| `builder_impulse` | Something they'd make given freedom | `project_suggestions` quality |
| `cross_domain_curiosity` | Interest far from main thread | **Critical for Weekly Intersections novelty** |
| `constraint_blocker` | What's in the way right now | Catalyst matching in drawer |
| `formative_influence` | Book / person / idea that shaped them | Intersection fuel (becomes graph nodes); intellectual lineage; also captures social signal implicitly (often *who* they admire) |

**Slots dropped from earlier draft:** `hidden_capability` (awkward to ask, capability comes out organically in `flow_moment`) and `social_signal` (weak alone — social context usually surfaces inside `formative_influence` or `builder_impulse`).

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

### Skip handling

Skipping is allowed but never leaves a coverage hole. Three paths for opting out of a question:

1. Say "skip" / "pass"
2. Very short non-answer ("dunno", "nothing", < 2s)
3. Press "skip this one" in the typing fallback

Behaviour:
- Planner marks that slot as `attempt_1` (not filled) and picks a *different* slot for the next turn.
- The skipped slot is re-queued with a **reworded angle** for a later turn (planner gets `attempts_history` and must generate a materially different phrasing).
- After 2 failed attempts on the same slot, mark `abandoned` and stop asking. Post-analysis still runs; reveal may be slightly thinner for that user, but they won't feel harassed.

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

## Hook & welcome copy

The user doesn't yet know what itch Aperture scratches. They arrive with a vague feeling — scattered thoughts, too many half-formed ideas, a sense of being intellectually busy but directionless. The hook has to **name that feeling** and promise a concrete payoff, without over-explaining the mechanism.

Three candidate sets, ranked by my preference:

**A. "Connections hiding in what you already care about."** *(preferred)*
> *The connections hiding in what you already care about.*
> *Talk for a few minutes. Aperture finds the patterns you've been missing.*
> CTA: **Start talking**

Strength: concrete promise ("connections", "patterns"), doesn't over-claim, "already care about" flatters the user. Keeps 3-min-ish framing without putting a literal timer anywhere.

**B. "A map of what's on your mind."**
> *A map of what's on your mind.*
> *A few minutes of talking. A clearer picture of where you're headed.*
> CTA: **Begin**

Strength: "map" is visually evocative and matches the intersections UI. "Where you're headed" speaks to direction anxiety.

**C. "You've got loose ends. Let's tie them together."**
> *You've got a mind full of loose ends.*
> *Three minutes of talking. Aperture ties them together.*
> CTA: **Start**

Strength: punchier, more emotional. Risk: slightly more casual than the rest of the app's tone.

### Locked hook (v1)

> **The hidden depth of your curiosity.**
> *A few minutes of talking. Aperture maps the connections.*
> CTA: **Start talking**

Rationale: "curiosity" is the single most accurate word for what Aperture actually indexes — intellectual territory, not life priorities (family, relationships) which the app doesn't model. Pairs "hidden depth" cleanly to carry the curiosity pull the owner was after, without over-promising a personality verdict.

### Chosen voice

Default to **Kore** on the Live API — warm, grounded, gender-neutral-ish, fits the reflective tone. Not final; easy to swap once we dogfood. Voice is a single string constant in the Live session config so changing it is a one-line edit.

### No visible timer

3 minutes is marketing copy on the welcome screen only. Internally the planner targets ~5 turns but lets rich threads breathe. Hard 4-min safety ceiling is invisible.

### Typing fallback

Small, low-emphasis "type instead" text link below the mic (not a toggle, not a button). Tapping it swaps the waveform for a textarea plus a "skip this one" micro-link. Submit = Enter. Same planner pipeline; reframe plays as TTS audio + on-screen text just like the voice path, and the mic returns for the next turn by default (user can stay typing if they prefer — choice is sticky within the session but resets on the next question).

## Existing infra we reuse

- `/src/hooks/useMediaRecorderVoice.ts` — keep for fallback, but primary path is Live API websocket
- `/src/components/VoiceInput.tsx` — waveform already built
- `/api/utilities?resource=analyze` — **upgrade** to take richer input (full transcript + coverage grid) rather than 5 discrete responses
- `OnboardingAnalysis` type — extend to carry `coverage_grid`, `grounding_phrases`, `slot_transcripts`
- `memories` table — **every turn is saved as its own foundational memory** (not concatenated). `memory_type: 'foundational'`, tagged with the slot it filled (`slot:flow_moment` etc.), and embedded individually. Rationale: per-turn memories feed the knowledge-lake search used elsewhere in the app at higher resolution — the planner's reframe + the question that prompted the answer both go into `metadata.onboarding_context` so future retrieval has full context.

## Infra built in V1

- `api/onboarding-chat.ts` — planner endpoint (`?action=start` / `?action=turn`)
- `api/_lib/onboarding/coverage.ts` — slot catalogue, planner prompt, JSON validation, grid mutation helpers, stopping heuristic
- `api/utilities.ts` — `handleAnalyze` extended to accept `coverage_grid` alongside the legacy `responses` payload
- `src/pages/OnboardingChatPage.tsx` — replaces `OnboardingPage.tsx` (deleted)
- `src/components/onboarding/CoverageDots.tsx` — the random-permutation dot constellation
- `src/types.ts` — `CoverageSlot`, `CoverageGrid`, `OnboardingTurn`, `PlannerDecision`
- `api/_lib/models.ts` — adds `MODELS.FLASH_LIVE` (reserved for V2) + `MODELS.PRO` (reserved escape hatch)

## Infra to build in V2

- `src/components/onboarding/LiveVoiceCapture.tsx` — Live API websocket client (drop-in replacement for `VoiceInput` in the turn loop)
- `api/onboarding-ephemeral-token.ts` — mints short-lived auth tokens so the client can connect to Gemini Live API directly without exposing `GEMINI_API_KEY`
- Tear down browser SpeechSynthesis usage in `OnboardingChatPage` (Live model emits audio natively)
- Merge reframe + next-question into a single Live-model system-prompt-driven utterance (the planner's text decision becomes a tool-call side channel)

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
