/**
 * Shared types for the noticing pipeline.
 *
 * The home "witness" surface. Three agents in series:
 *   Historian → builds and caches an identity sketch (weekly).
 *   Noticer   → proposes candidate noticings against recent + sketch.
 *   Writer    → renders one candidate as 2–3 short sentences, with veto.
 *
 * The output unit is a noticing — never an action, never an artefact, never
 * a chore. See `forbidden-shapes.ts` for the deterministic filter.
 */

export type SignalKind = 'memory' | 'list_item' | 'project'

export interface Signal {
  id: string
  kind: SignalKind
  text: string
  title: string | null
  source_label: string
  created_at: string
  effective_date: string
  embedding: number[] | string
}

export type NoticingShape = 'observation' | 'commission'

export interface NoticingSourceMeta {
  kind: SignalKind
  source_id: string
  label: string
  date: string
  excerpt?: string
}

export interface Noticing {
  id: string
  lines: string[]
  shape: NoticingShape
  sources: NoticingSourceMeta[]
  served_at: string
  saved?: boolean
}

/**
 * Identity sketch — refreshed weekly. The shape is deliberately small so the
 * Noticer can hold all of it in its prompt without paraphrase loss.
 */
export interface HistorianSketch {
  /** Themes the user has returned to ≥3 times across weeks. */
  recurring_shapes: Array<{
    name: string
    evidence: Array<{ source_key: string; date: string; excerpt: string }>
    first_seen: string
    last_seen: string
  }>
  /** Projects mentioned but inactive — live but waiting. */
  dormant_projects: Array<{
    title: string
    project_id: string
    last_touched: string
    note: string
  }>
  /** People who keep being mentioned — initials or first names only. */
  returning_people: Array<{
    name: string
    times_mentioned: number
    last_mentioned: string
    context: string
  }>
  /** Stated facts about the user's life-stage, decisions, location. */
  life_stage_facts: string[]
}

/**
 * What the Noticer hands the Writer.
 */
export interface NoticerCandidate {
  shape: NoticingShape
  /** Plain-English seed describing what's interesting and why. The Writer
   * does not pass this through — it's craft instructions, not user-facing. */
  seed: string
  /** The signals the noticing is grounded in. */
  evidence: Array<{
    kind: SignalKind
    source_id: string
    label: string
    date: string
    excerpt: string
  }>
  /** A self-rating (0–1) the Noticer assigns to itself. */
  rank: number
}
