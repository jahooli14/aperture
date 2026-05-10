/**
 * Types for the project-ideas pipeline.
 *
 * The output is the rare moment in the app when the system "shows you a
 * thought you might not have had." Each idea is grounded in real captures
 * the user can verify, ranked, and shipped with a concrete next step so it
 * doesn't sit as abstract advice.
 */

export type EvidenceKind =
  | 'memory'
  | 'list_item'
  | 'project'
  | 'project_dormant'
  | 'reading'
  | 'highlight'
  | 'suggestion'
  | 'idea_engine'

export interface IdeaEvidence {
  kind: EvidenceKind
  source_id: string
  label: string
  date: string
  excerpt: string
}

export type CentreKind = 'project_dormant' | 'project_active' | 'memory'
export type ArrivalKind = 'memory' | 'reading' | 'highlight'

/** The deterministic pick that drove a generated idea. The picker chooses it
 *  in code from structured rows; the LLM only writes the idea up. Stored on
 *  project_ideas so the next batch can enforce a cooldown. */
export interface SeedPair {
  centre_kind: CentreKind
  centre_id: string
  arrival_kind: ArrivalKind
  arrival_id: string
}

export type IdeaMode = 'crossover' | 'read'

export interface ProjectIdea {
  rank: number
  title: string
  pitch: string
  why_now: string
  next_step: string
  evidence: IdeaEvidence[]
  seed_pair?: SeedPair
  /** 'crossover' for locked-pairs / permissive output (the default).
   *  'read' for the longitudinal pattern reader — the row also carries a
   *  non-null `pattern` and the UI renders it as the hero block. */
  mode?: IdeaMode
  /** The through-line sentence for Read mode. The pattern itself, in the
   *  user's frame — "you almost-start music projects four times a year and
   *  stall at format." NULL on crossover rows. */
  pattern?: string | null
  /** Read mode only: 0–100 self-score from the model on how strongly the
   *  pattern lands. The home only auto-surfaces the prominent "there's
   *  something to show you" teaser when this is >= 70; below that, the
   *  idea sits in the queue and is reached for via the button. NULL on
   *  crossover rows (those don't gate behind a threshold). */
  confidence?: number | null
}

export interface StoredProjectIdea extends ProjectIdea {
  id: string
  batch_id: string
  status: 'pending' | 'saved' | 'rejected' | 'built'
  user_feedback: string | null
  generated_at: string
  acted_on_at: string | null
}

export interface GatherResult {
  memories: Array<{ id: string; title: string | null; body: string; themes: string[]; memory_type: string | null; created_at: string }>
  list_items: Array<{ id: string; content: string; list_type: string; list_title: string | null; status: string; created_at: string; reaction: 'sparked' | 'off' | 'make' | null; user_rating: number | null }>
  active_projects: Array<{ id: string; title: string; description: string | null; status: string; tags: string[]; updated_at: string }>
  dormant_projects: Array<{ id: string; title: string; description: string | null; status: string; updated_at: string }>
  reading: Array<{ id: string; title: string | null; excerpt: string | null; source: string | null; created_at: string }>
  highlights: Array<{ id: string; quote: string; article_title: string | null; created_at: string }>
  prior_suggestions: Array<{ id: string; title: string; status: string }>
  ie_ideas: Array<{ id: string; title: string; description: string; status: string; rejection_reason: string | null }>
  prior_ideas: {
    saved: Array<{ title: string; feedback: string | null }>
    rejected: Array<{ title: string; feedback: string | null }>
    built: Array<{ title: string; feedback: string | null }>
  }
  /** Seed pairs used in recent batches (within the cooldown window).
   *  Drives the picker's "don't reuse this convergence" filter. */
  recent_seed_pairs: Array<{ centre_id: string; arrival_id: string; used_at: string; status: string }>
  /** Titles from very recent (pending or superseded) batches — typically the
   *  one we just overwrote when the user clicked "try another". Fed into the
   *  prompt's do-not-repeat block so the model doesn't re-emit the title it
   *  wrote sixty seconds ago. Permissive rows show up here too even though
   *  they have no seed_pair, which closes the permissive-cooldown gap. */
  recent_titles: Array<{ title: string; used_at: string }>
  /** Centres used in the last short window (still pending or just superseded).
   *  The picker treats these as deprioritised so a back-to-back regen can't
   *  pick the same centre × a different arrival and produce a reword. */
  recent_centre_ids: string[]
  total_signal_count: number
}

export interface GenerationResult {
  ideas: ProjectIdea[]
  reason?: 'insufficient_data' | 'parse_failure'
  attempts: number
}
