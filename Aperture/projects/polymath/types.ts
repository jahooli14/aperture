/**
 * Polymath TypeScript Type Definitions
 * Copy to: projects/memory-os/src/types.ts (append to existing types)
 */

// ============================================================================
// PROJECTS
// ============================================================================

export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  type: ProjectType
  status: ProjectStatus
  last_active: string // ISO 8601
  created_at: string
  updated_at: string
  metadata: ProjectMetadata
  embedding?: number[] // Vector embedding (1536 dims)
}

export type ProjectType = 'creative' | 'technical' | 'learning'

export type ProjectStatus = 'active' | 'on-hold' | 'maintaining' | 'completed' | 'archived'

export interface ProjectMetadata {
  tags?: string[]
  energy_level?: 'low' | 'medium' | 'high'
  materials_needed?: string[]
  estimated_time?: string // e.g., "2 hours", "1 week"
  photos?: string[] // URLs to photos/artifacts
  from_suggestion?: string // Suggestion ID if built from suggestion
  capabilities?: string[] // Capability IDs used
  original_points?: number // Points from suggestion
  [key: string]: any // Allow arbitrary metadata
}

export interface CreateProjectInput {
  title: string
  description?: string
  type: ProjectType
  status?: ProjectStatus
  metadata?: ProjectMetadata
}

export interface UpdateProjectInput {
  title?: string
  description?: string
  type?: ProjectType
  status?: ProjectStatus
  metadata?: ProjectMetadata
}

// ============================================================================
// CAPABILITIES
// ============================================================================

export interface Capability {
  id: string
  name: string
  description: string
  source_project: string
  code_references: CodeReference[]
  strength: number
  last_used: string | null
  created_at: string
  updated_at: string
  embedding?: number[]
}

export interface CodeReference {
  file: string
  function?: string
  line?: number
  type?: string // For type definitions
}

export interface CapabilityWithSimilarity extends Capability {
  similarity: number // 0-1 for vector search results
}

// ============================================================================
// PROJECT SUGGESTIONS
// ============================================================================

export interface ProjectSuggestion {
  id: string
  user_id: string
  title: string
  description: string
  synthesis_reasoning: string
  novelty_score: number // 0-1
  feasibility_score: number // 0-1
  interest_score: number // 0-1
  total_points: number
  capability_ids: string[]
  memory_ids: string[]
  is_wildcard: boolean
  suggested_at: string
  status: SuggestionStatus
  built_project_id: string | null
  metadata: SuggestionMetadata
}

export type SuggestionStatus = 'pending' | 'rated' | 'built' | 'dismissed' | 'saved'

export interface SuggestionMetadata {
  tags?: string[]
  estimated_time?: string
  required_tools?: string[]
  difficulty?: 'easy' | 'medium' | 'hard'
  [key: string]: any
}

export interface ProjectSuggestionExpanded extends ProjectSuggestion {
  capabilities?: Capability[]
  memories?: Memory[] // From MemoryOS
  ratings?: SuggestionRating[]
}

// ============================================================================
// SUGGESTION RATINGS
// ============================================================================

export interface SuggestionRating {
  id: string
  suggestion_id: string
  user_id: string
  rating: -1 | 1 | 2 // -1 = meh, 1 = spark, 2 = built
  feedback: string | null
  rated_at: string
}

export interface RateSuggestionInput {
  rating: -1 | 1 | 2
  feedback?: string
}

// ============================================================================
// INTERESTS
// ============================================================================

export interface Interest {
  id: string
  name: string
  type: string // 'person', 'topic', 'place', etc.
  strength: number
  mentions: number
  last_mentioned: string | null
  is_interest: boolean
  interest_strength: number
}

// ============================================================================
// NODE STRENGTHS
// ============================================================================

export interface NodeStrength {
  id: string
  node_type: NodeType
  node_id: string
  strength: number
  activity_count: number
  last_activity: string | null
  created_at: string
  updated_at: string
}

export type NodeType = 'capability' | 'interest' | 'project'

export interface NodeStrengthExpanded extends NodeStrength {
  node_details: Capability | Interest | Project
}

// ============================================================================
// CAPABILITY COMBINATIONS
// ============================================================================

export interface CapabilityCombination {
  id: string
  capability_ids: string[]
  times_suggested: number
  times_rated_positive: number
  times_rated_negative: number
  penalty_score: number
  first_suggested_at: string
  last_suggested_at: string
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ProjectsResponse {
  projects: Project[]
  total: number
}

export interface SuggestionsResponse {
  suggestions: ProjectSuggestion[]
  total: number
}

export interface CapabilitiesResponse {
  capabilities: Capability[]
  total: number
}

export interface InterestsResponse {
  interests: Interest[]
  total: number
}

export interface NodeStrengthsResponse {
  nodes: NodeStrengthExpanded[]
}

export interface SynthesisResponse {
  success: boolean
  suggestions_generated: number
  suggestions: Array<{
    id: string
    title: string
    total_points: number
    is_wildcard: boolean
  }>
  interests_found: number
  capabilities_used: number
}

export interface StrengthenNodesResponse {
  success: boolean
  nodes_strengthened: number
  updates: Array<{
    node_type: NodeType
    node_id: string
    old_strength: number
    new_strength: number
  }>
}

export interface RateSuggestionResponse {
  success: boolean
  rating: SuggestionRating
  updated_suggestion: {
    id: string
    status: SuggestionStatus
  }
}

export interface BuildSuggestionResponse {
  success: boolean
  project: Project
  suggestion: {
    id: string
    status: 'built'
    built_project_id: string
  }
}

// ============================================================================
// SYNTHESIS CONFIG
// ============================================================================

export interface SynthesisConfig {
  suggestions_per_run: number
  wildcard_frequency: number // Every Nth suggestion
  novelty_weight: number // 0-1
  feasibility_weight: number // 0-1
  interest_weight: number // 0-1
  min_interest_mentions: number
  recent_days: number
}

export const DEFAULT_SYNTHESIS_CONFIG: SynthesisConfig = {
  suggestions_per_run: 10,
  wildcard_frequency: 4,
  novelty_weight: 0.3,
  feasibility_weight: 0.4,
  interest_weight: 0.3,
  min_interest_mentions: 3,
  recent_days: 30
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  error: string
  code?: string
  details?: any
}

// ============================================================================
// MEMORY (from MemoryOS - for reference)
// ============================================================================

export interface Memory {
  id: string
  audiopen_id: string
  title: string
  body: string
  orig_transcript: string | null
  tags: string[]
  audiopen_created_at: string
  processed: boolean
  created_at: string
  embedding?: number[]
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type SortOrder = 'points' | 'recent' | 'rating'
export type FilterStatus = 'all' | 'new' | 'saved' | 'built' | 'dismissed'

// ============================================================================
// ZUSTAND STORE TYPES
// ============================================================================

export interface ProjectStore {
  projects: Project[]
  loading: boolean
  error: string | null

  fetchProjects: (filters?: {
    status?: ProjectStatus
    type?: ProjectType
  }) => Promise<void>
  createProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
}

export interface SuggestionStore {
  suggestions: ProjectSuggestion[]
  allSuggestions: ProjectSuggestion[]
  loading: boolean
  error: string | null

  fetchSuggestions: (filters?: {
    status?: SuggestionStatus
    is_wildcard?: boolean
  }) => Promise<void>
  fetchAllSuggestions: () => Promise<void>
  rateSuggestion: (id: string, rating: -1 | 1 | 2, feedback?: string) => Promise<void>
  buildSuggestion: (id: string) => Promise<Project>
  triggerSynthesis: () => Promise<void>
}

export interface CapabilityStore {
  capabilities: Capability[]
  loading: boolean
  error: string | null

  fetchCapabilities: () => Promise<void>
  searchCapabilities: (query: string, threshold?: number) => Promise<CapabilityWithSimilarity[]>
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface ProjectCardProps {
  project: Project
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  showActions?: boolean
  compact?: boolean
}

export interface SuggestionCardProps {
  suggestion: ProjectSuggestion
  onRate: (id: string, rating: -1 | 1 | 2) => void
  onBuild: (id: string) => void
  onViewDetail: (id: string) => void
  compact?: boolean
}

export interface RatingActionsProps {
  onSpark: () => void
  onMeh: () => void
  onBuild: () => void
  onMore: () => void
  disabled?: boolean
}

export interface CapabilityBadgeProps {
  capability: Capability | { id: string; name: string }
  showStrength?: boolean
  onClick?: () => void
}

export interface ProjectTimelineProps {
  projects: Project[]
}

export interface ScoreBarProps {
  label: string
  score: number // 0-1
  color?: string
}
