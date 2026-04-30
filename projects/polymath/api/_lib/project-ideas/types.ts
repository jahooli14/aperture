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
  | 'todo'
  | 'suggestion'
  | 'idea_engine'

export interface IdeaEvidence {
  kind: EvidenceKind
  source_id: string
  label: string
  date: string
  excerpt: string
}

export interface ProjectIdea {
  rank: number
  title: string
  pitch: string
  why_now: string
  next_step: string
  evidence: IdeaEvidence[]
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
  list_items: Array<{ id: string; content: string; list_type: string; list_title: string | null; status: string; created_at: string }>
  active_projects: Array<{ id: string; title: string; description: string | null; status: string; tags: string[]; updated_at: string }>
  dormant_projects: Array<{ id: string; title: string; description: string | null; status: string; updated_at: string }>
  reading: Array<{ id: string; title: string | null; excerpt: string | null; source: string | null; created_at: string }>
  highlights: Array<{ id: string; quote: string; article_title: string | null; created_at: string }>
  todos: Array<{ id: string; text: string; notes: string | null; tags: string[]; created_at: string }>
  prior_suggestions: Array<{ id: string; title: string; status: string }>
  ie_ideas: Array<{ id: string; title: string; description: string; status: string; rejection_reason: string | null }>
  prior_idea_titles: { saved: string[]; rejected: string[]; built: string[] }
  total_signal_count: number
}

export interface GenerationResult {
  ideas: ProjectIdea[]
  reason?: 'insufficient_data' | 'parse_failure'
  attempts: number
}
