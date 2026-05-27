/**
 * Portrait — shared types between the generator, the reckoner, and the
 * utilities API handlers.
 *
 * Slice 1 surfaces only `this_week`. Other sections (`this_season`,
 * `who_you_are`, `where_this_is_going`) live in this type as a single-
 * value union for forward-compat — when they ship, the existing rows
 * just gain new section values without a migration.
 */

export type PortraitSection = 'this_week'

export type EvidenceKind =
  | 'memory'
  | 'list_item'
  | 'project_event'
  | 'project'
  | 'reading'
  | 'highlight'

export interface EvidenceRef {
  kind: EvidenceKind
  source_id: string
  /** Short snippet so the UI can render the evidence without a second
   *  fetch. The generator extracts it from the source row at gather time. */
  snippet: string
  /** Display label — list title for a list_item, project title for a
   *  project event, source for an article, etc. Plain English. */
  label: string
  /** When the source row was created. Used so the panel can show
   *  "voice note · Tuesday" rather than a raw timestamp. */
  occurred_at: string | null
}

export interface PortraitSnapshot {
  id: string
  body: string
  evidence_refs: EvidenceRef[]
  generated_at: string
}

export interface PortraitPrediction {
  id: string
  prediction: string
  week_starting: string  // ISO date (YYYY-MM-DD)
  sealed_until: string   // ISO date (YYYY-MM-DD)
  generated_at: string
}

export type ReckonCall = 'hit' | 'partial' | 'miss'

export interface PortraitReckoning {
  id: string
  prediction_id: string
  called: ReckonCall
  evidence: string
  score: number  // 0, 0.5, or 1
  evaluated_at: string
}

export interface PortraitPredictionWithReckoning extends PortraitPrediction {
  reckoning: PortraitReckoning | null
}

/** Payload returned from GET utilities?resource=portrait. */
export interface PortraitPayload {
  snapshot: PortraitSnapshot | null
  /** Most recent prediction that has been reckoned. NULL when none yet. */
  last_prediction: PortraitPredictionWithReckoning | null
  /** Most recent un-reckoned prediction (the "sealed for next week"
   *  block). NULL on first generation since the prediction is created
   *  alongside the snapshot. */
  next_prediction: PortraitPrediction | null
  /** Rolling score over the user's last 10 reckonings. Format: "7 / 10".
   *  NULL when the user has zero reckonings yet. */
  calibration: {
    score_sum: number
    count: number
    display: string
  } | null
  /** Server-side debounce window. The page uses this to grey out the
   *  refresh button without needing a 429 round-trip. */
  next_refresh_available_at: string | null
}

/**
 * Output of the generator Flash call. Strict — the handler validates
 * shape before writing rows.
 */
export interface GeneratorOutput {
  body: string
  evidence_refs: EvidenceRef[]
  next_prediction: string
}

/**
 * Output of the reckoner Flash call. The score is derived from `called`
 * on the server (hit=1, partial=0.5, miss=0) — the model only picks the
 * verdict and writes the one-line evidence.
 */
export interface ReckonerOutput {
  called: ReckonCall
  evidence: string
}
