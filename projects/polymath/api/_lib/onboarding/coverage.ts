/**
 * Onboarding coverage planner
 *
 * Runs after each user turn in the Aperture onboarding chat. Takes the
 * conversation so far + current coverage grid and returns a single JSON
 * decision: which slot to target next, what reframe to deliver, whether to
 * stop, and slot confidence updates.
 *
 * Combining planning + reframe generation into one call keeps the server hop
 * round-trip cheap — a single flash-lite call, not two.
 */

import { generateText } from '../gemini-chat.js'
import { MODELS } from '../models.js'
import type {
  CoverageGrid,
  CoverageSlot,
  CoverageSlotId,
  PlannerDecision,
} from '../../src/types'

// ── Slot catalogue ─────────────────────────────────────────────────────────

export const SLOT_CATALOGUE: Record<CoverageSlotId, {
  id: CoverageSlotId
  what_we_want: string
  angle_examples: string[]
}> = {
  current_fascination: {
    id: 'current_fascination',
    what_we_want: 'Something they\'re currently preoccupied with or keep circling back to — idea, project, question, hobby.',
    angle_examples: [
      'What\'s alive for you at the moment — something you keep circling back to?',
    ],
  },
  flow_moment: {
    id: 'flow_moment',
    what_we_want: 'A recent episode where they were in flow — concrete, episodic. Surfaces capability + taste + domain in one answer.',
    angle_examples: [
      'Tell me about a recent time when you lost track of time doing something — what was it?',
      'When was the last time you felt totally absorbed in what you were doing?',
    ],
  },
  builder_impulse: {
    id: 'builder_impulse',
    what_we_want: 'Something they\'d make, build, or create if time and money weren\'t the blocker. Surfaces project suggestions.',
    angle_examples: [
      'If you had a free weekend and unlimited budget, what would you make?',
      'What\'s an idea you keep coming back to — something you\'d love to try?',
    ],
  },
  cross_domain_curiosity: {
    id: 'cross_domain_curiosity',
    what_we_want: 'A curiosity or interest far from what they\'ve mentioned so far — the seed for novel intersections.',
    angle_examples: [
      'What\'s a topic you get curious about that has nothing to do with anything you\'ve mentioned so far?',
      'What\'s a completely unrelated rabbit hole you\'ve been down recently?',
    ],
  },
  constraint_blocker: {
    id: 'constraint_blocker',
    what_we_want: 'What\'s currently in the way of them doing more of what they want — time, skill, knowledge, access, courage.',
    angle_examples: [
      'What\'s the thing that\'s been getting in the way?',
      'If you imagine actually doing that — what stops you?',
    ],
  },
  formative_influence: {
    id: 'formative_influence',
    what_we_want: 'A book, person, or idea that shaped how they think. Becomes graph nodes; captures intellectual lineage.',
    angle_examples: [
      'What\'s a book, person, or idea that changed the way you see things?',
      'Is there someone whose way of thinking you\'ve borrowed?',
    ],
  },
}

export const ANCHOR_QUESTION =
  "What's alive for you at the moment — something you keep circling back to?"

// ── Grid lifecycle ─────────────────────────────────────────────────────────

function shufflePermutation<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function newCoverageGrid(): CoverageGrid {
  const slotIds = Object.keys(SLOT_CATALOGUE) as CoverageSlotId[]
  const slots = {} as Record<CoverageSlotId, CoverageSlot>
  for (const id of slotIds) {
    slots[id] = {
      id,
      status: 'unfilled',
      confidence: 0,
      grounding_phrases: [],
      attempts: 0,
    }
  }
  return {
    slots,
    turns: [],
    dot_order: shufflePermutation(slotIds),
    started_at: new Date().toISOString(),
    completed_at: null,
  }
}

// ── Stopping heuristic (client-side hint, not authoritative) ──────────────

const CRITICAL_SLOTS: CoverageSlotId[] = ['current_fascination', 'cross_domain_curiosity']
const FILL_THRESHOLD = 0.6
const MAX_HARD_CEILING_TURNS = 8

export function computeStoppingHint(grid: CoverageGrid, lastDepthSignal: 'high' | 'medium' | 'low' | null): {
  should_stop: boolean
  reason: string
} {
  if (grid.turns.length >= MAX_HARD_CEILING_TURNS) {
    return { should_stop: true, reason: 'hard_ceiling' }
  }

  const slotsFilled = Object.values(grid.slots).filter(
    s => s.confidence >= FILL_THRESHOLD || s.status === 'filled',
  ).length

  const criticalFilled = CRITICAL_SLOTS.every(id => {
    const slot = grid.slots[id]
    return slot.confidence >= FILL_THRESHOLD || slot.status === 'abandoned'
  })

  if (slotsFilled >= 4 && criticalFilled && lastDepthSignal !== 'high') {
    return { should_stop: true, reason: 'coverage_met' }
  }

  return { should_stop: false, reason: 'continue' }
}

// ── Planner prompt ─────────────────────────────────────────────────────────

function renderGridForPrompt(grid: CoverageGrid): string {
  const lines: string[] = []
  for (const id of Object.keys(SLOT_CATALOGUE) as CoverageSlotId[]) {
    const slot = grid.slots[id]
    const cat = SLOT_CATALOGUE[id]
    lines.push(
      `- ${id} [${slot.status}, conf ${slot.confidence.toFixed(2)}, attempts ${slot.attempts}]: ${cat.what_we_want}`,
    )
  }
  return lines.join('\n')
}

function renderTurnsForPrompt(grid: CoverageGrid): string {
  if (grid.turns.length === 0) return '(no turns yet — next response is to the anchor question)'
  return grid.turns
    .map(t => `Turn ${t.index} [target: ${t.target_slot ?? 'anchor'}]\nQ: ${t.question}\nA: ${t.transcript}${t.reframe_text ? `\nReframe delivered: ${t.reframe_text}` : ''}`)
    .join('\n\n')
}

export interface RunPlannerInput {
  grid: CoverageGrid
  /** The user's most recent transcript (the response to the current question). */
  latest_transcript: string
  /** The question the user was responding to. */
  latest_question: string
  /** Slot the previous turn targeted (null if anchor). */
  latest_target_slot: CoverageSlotId | null
  /** If the latest transcript is empty or was explicitly skipped by the user. */
  skipped: boolean
}

const PLANNER_SYSTEM_PROMPT = `You are the planner for Aperture's onboarding voice chat. Your job, after each user turn, is to:

1. Update a coverage grid of six slots — tracking which dimensions of the user we've learned about.
2. Decide whether to DEEPEN (stay on the same thread) or PIVOT (jump to a new slot) or STOP.
3. Generate the next utterance: a REFRAME of what they just said + a segue into the next question (or a deeper probe).

Rules you must follow without exception:

CRITICAL — ANTI-HALLUCINATION:
- Every claim in your reframe MUST be grounded in exact phrases from the user's transcript. You will return those phrases in grounding_phrases. If you cannot find grounding phrases, set reframe_mode to "micro_clarify" and ask a clarifying question instead of reframing.
- NEVER invent a value, aesthetic, preference, or intent the user did not express.
- Do not pattern-match to stereotypes. If they mention welding, do not assume "masculine" or "practical". Reflect only what is in the transcript.

REFRAME MODES:
- "orientation" — name an operative value/aesthetic evident in the transcript. Example: user mentions "clean, minimal, no clutter" → "There's a minimalist streak in how you're framing that."
- "tension" — note an interesting combination or edge. Example: "a late-career pivot toward something physical — unusual."
- "micro_clarify" — transcript is too thin to reframe. Ask a short probing clarifier (doesn't fully count as a turn).
- "deepen" — stay on the thread. Example: "Say more about [specific thing they mentioned] — what draws you to it?"

SEGUE:
- If next_move is "pivot", append a soft bridge ("Shifting gears —", "On a different note,", "One more —") BEFORE the next question.
- If next_move is "deepen", do NOT bridge. Flow naturally into the deeper probe.
- If next_move is "stop", there is no next question. The reframe stands alone.

SLOT SELECTION (on pivot):
- Prioritise UNFILLED slots with the lowest confidence.
- If we're at turn 3 or later and "cross_domain_curiosity" is below 0.4, you MUST target it next (unless already at 2 attempts).
- Do not target slots with status "abandoned" or attempts >= 2.
- If a slot was skipped before (attempts >= 1), generate a materially DIFFERENT angle from what was tried.

STOPPING:
- Recommend should_stop = true when ≥4 slots are at confidence ≥ 0.6, cross_domain_curiosity is filled or abandoned, and the user's last turn has depth_signal = "low" or "medium".
- Hard stop at turn 8.
- If the user is on a genuinely rich thread (depth_signal "high"), keep going unless at hard ceiling.

SKIP HANDLING:
- If the user's transcript is empty, "skip", "pass", "dunno", or very short (<3 meaningful words), treat as a skip. Increment the target slot's attempts. Do NOT mark it filled. Choose a different slot for the next question. If this is the second attempt on the same slot, mark it abandoned.

TONE of reframes and questions:
- Warm but understated. No sycophancy.
- Under 20 words per utterance.
- Sound like a thoughtful friend, not a therapist or an interviewer.
- Never "I hear you" or "that's so interesting".`

function buildPlannerPrompt(input: RunPlannerInput): string {
  const { grid, latest_transcript, latest_question, latest_target_slot, skipped } = input

  return `${PLANNER_SYSTEM_PROMPT}

== CURRENT COVERAGE GRID ==
${renderGridForPrompt(grid)}

== CONVERSATION SO FAR ==
${renderTurnsForPrompt(grid)}

== LATEST TURN (to analyse) ==
Target slot the previous question was aimed at: ${latest_target_slot ?? 'anchor (no specific slot)'}
Question asked: ${latest_question}
User's response: ${latest_transcript || '(empty — skip/pass)'}
Skip flag: ${skipped}

== TASK ==
Analyse the user's response. Update slot confidences. Decide the next move. Generate the reframe + (if continuing) the next question.

Return ONLY a JSON object with this exact shape, no prose around it:

{
  "slot_updates": {
    "<slot_id>": { "confidence": 0.0, "grounding_phrases": ["..."] }
  },
  "depth_signal": "high" | "medium" | "low",
  "next_move": "deepen" | "pivot" | "stop",
  "next_slot_target": "<slot_id>" | null,
  "next_question": "..." | null,
  "reframe_mode": "orientation" | "tension" | "micro_clarify" | "deepen",
  "reframe_text": "...",
  "should_stop": true | false
}

- slot_updates: include ANY slots whose confidence changed based on this turn. A single rich turn can fill multiple slots.
- If next_move == "stop", next_question and next_slot_target must be null and should_stop must be true.
- reframe_text is what the app will actually say to the user. Keep under 20 words.
- next_question, if present, should flow naturally from reframe_text (one or both will be voiced back-to-back).`
}

// ── Runner ─────────────────────────────────────────────────────────────────

/**
 * Run the planner. Returns a validated PlannerDecision.
 *
 * Catches and repairs malformed JSON; falls back to a safe micro_clarify if
 * the model produces something unusable.
 */
export async function runPlanner(input: RunPlannerInput): Promise<PlannerDecision> {
  const prompt = buildPlannerPrompt(input)

  let raw: string
  try {
    raw = await generateText(prompt, {
      maxTokens: 600,
      temperature: 0.6,
      responseFormat: 'json',
      model: MODELS.DEFAULT_CHAT, // flash-lite
    })
  } catch (err: any) {
    console.error('[onboarding/coverage] planner call failed:', err?.message)
    return safeFallback(input)
  }

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error('[onboarding/coverage] planner returned non-JSON:', raw.slice(0, 200))
    return safeFallback(input)
  }

  return validateAndNormaliseDecision(parsed, input)
}

function validateAndNormaliseDecision(raw: any, input: RunPlannerInput): PlannerDecision {
  const validSlotIds = Object.keys(SLOT_CATALOGUE) as CoverageSlotId[]
  const reframeModes = ['orientation', 'tension', 'micro_clarify', 'deepen'] as const
  const moves = ['deepen', 'pivot', 'stop'] as const
  const depths = ['high', 'medium', 'low'] as const

  const slot_updates: PlannerDecision['slot_updates'] = {}
  if (raw.slot_updates && typeof raw.slot_updates === 'object') {
    for (const [k, v] of Object.entries(raw.slot_updates as Record<string, any>)) {
      if (!validSlotIds.includes(k as CoverageSlotId)) continue
      const conf = typeof v?.confidence === 'number' ? clamp01(v.confidence) : 0
      const phrases = Array.isArray(v?.grounding_phrases)
        ? v.grounding_phrases.filter((p: any) => typeof p === 'string').slice(0, 5)
        : []
      slot_updates[k as CoverageSlotId] = { confidence: conf, grounding_phrases: phrases }
    }
  }

  const next_move: PlannerDecision['next_move'] = moves.includes(raw.next_move) ? raw.next_move : 'pivot'
  const depth_signal: PlannerDecision['depth_signal'] = depths.includes(raw.depth_signal) ? raw.depth_signal : 'medium'
  const reframe_mode: PlannerDecision['reframe_mode'] = reframeModes.includes(raw.reframe_mode)
    ? raw.reframe_mode
    : 'micro_clarify'

  const should_stop = Boolean(raw.should_stop) || next_move === 'stop'

  const next_slot_target: CoverageSlotId | null =
    should_stop || raw.next_slot_target === null
      ? null
      : validSlotIds.includes(raw.next_slot_target as CoverageSlotId)
        ? (raw.next_slot_target as CoverageSlotId)
        : null

  const reframe_text = typeof raw.reframe_text === 'string' && raw.reframe_text.trim().length > 0
    ? raw.reframe_text.trim().slice(0, 400)
    : 'Got it.'

  const next_question =
    should_stop
      ? null
      : typeof raw.next_question === 'string' && raw.next_question.trim().length > 0
        ? raw.next_question.trim().slice(0, 400)
        : null

  // Anti-hallucination safeguard: if reframe_mode is orientation/tension/deepen
  // but there are no grounding phrases for ANY slot in this turn, downgrade to micro_clarify.
  const anyGrounding = Object.values(slot_updates).some(v => (v?.grounding_phrases.length ?? 0) > 0)
  const finalReframeMode: PlannerDecision['reframe_mode'] =
    !anyGrounding && reframe_mode !== 'micro_clarify' && !input.skipped
      ? 'micro_clarify'
      : reframe_mode

  return {
    slot_updates,
    depth_signal,
    next_move: should_stop ? 'stop' : next_move,
    next_slot_target,
    next_question,
    reframe_mode: finalReframeMode,
    reframe_text,
    should_stop,
  }
}

function safeFallback(input: RunPlannerInput): PlannerDecision {
  // Pick an unfilled slot at random for a generic pivot.
  const validSlotIds = Object.keys(SLOT_CATALOGUE) as CoverageSlotId[]
  const unfilled = validSlotIds.filter(id => {
    const slot = input.grid.slots[id]
    return slot.status !== 'abandoned' && slot.confidence < FILL_THRESHOLD && slot.attempts < 2
  })
  const target = unfilled[0] ?? null
  const angle = target ? SLOT_CATALOGUE[target].angle_examples[0] : null

  return {
    slot_updates: {},
    depth_signal: 'medium',
    next_move: target ? 'pivot' : 'stop',
    next_slot_target: target,
    next_question: target ? `Shifting gears — ${angle}` : null,
    reframe_mode: 'micro_clarify',
    reframe_text: 'Got it.',
    should_stop: !target,
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

// ── Grid mutation helpers ──────────────────────────────────────────────────

/**
 * Apply a planner decision + the latest turn to the coverage grid, producing
 * a new grid. Pure — does not mutate input.
 */
export function applyDecisionToGrid(
  grid: CoverageGrid,
  input: {
    question: string
    transcript: string
    target_slot: CoverageSlotId | null
    skipped: boolean
    decision: PlannerDecision
  },
): CoverageGrid {
  const next: CoverageGrid = {
    ...grid,
    slots: { ...grid.slots },
    turns: [...grid.turns],
  }

  // Clone slots we'll touch
  for (const id of Object.keys(next.slots) as CoverageSlotId[]) {
    next.slots[id] = { ...next.slots[id], grounding_phrases: [...next.slots[id].grounding_phrases] }
  }

  // Merge slot updates from the planner
  for (const [rawId, update] of Object.entries(input.decision.slot_updates)) {
    const id = rawId as CoverageSlotId
    if (!next.slots[id]) continue
    const slot = next.slots[id]
    // Keep the highest confidence seen (never regress)
    slot.confidence = Math.max(slot.confidence, update!.confidence)
    // Merge grounding phrases, dedupe, cap at 8
    const merged = [...slot.grounding_phrases, ...(update!.grounding_phrases || [])]
    slot.grounding_phrases = Array.from(new Set(merged)).slice(0, 8)
    if (slot.confidence >= FILL_THRESHOLD) slot.status = 'filled'
  }

  // Track target-slot attempts / abandonment on skip
  if (input.target_slot) {
    const slot = next.slots[input.target_slot]
    slot.attempts = slot.attempts + 1
    if (input.skipped && slot.status !== 'filled') {
      if (slot.attempts >= 2) slot.status = 'abandoned'
      else if (slot.status === 'unfilled') slot.status = 'attempted_1'
    }
  }

  // Append the turn
  next.turns.push({
    index: grid.turns.length + 1,
    question: input.question,
    transcript: input.transcript,
    target_slot: input.target_slot,
    reframe_mode: input.decision.reframe_mode,
    reframe_text: input.decision.reframe_text,
    skipped: input.skipped,
  })

  return next
}

/**
 * Slot ids that just crossed the fill threshold after applying a decision.
 * Used by the UI to light up dots.
 */
export function newlyFilledSlots(prev: CoverageGrid, next: CoverageGrid): CoverageSlotId[] {
  const out: CoverageSlotId[] = []
  for (const id of Object.keys(next.slots) as CoverageSlotId[]) {
    const wasFilled = prev.slots[id].confidence >= FILL_THRESHOLD || prev.slots[id].status === 'filled'
    const isFilled = next.slots[id].confidence >= FILL_THRESHOLD || next.slots[id].status === 'filled'
    if (!wasFilled && isFilled) out.push(id)
  }
  return out
}
