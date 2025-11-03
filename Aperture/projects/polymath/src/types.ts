// MemoryOS Type Definitions

export type MemoryType = 'foundational' | 'event' | 'insight'

export type BridgeType = 'entity_match' | 'semantic_similarity' | 'temporal_proximity'

export interface AudiopenWebhook {
  id: string
  title: string
  body: string
  orig_transcript: string
  tags: string // Comma-separated
  date_created: string // ISO date string
}

export interface Entities {
  people: string[]
  places: string[]
  topics: string[]
}

export interface SourceReference {
  type: 'article' | 'project' | 'suggestion'
  id: string
  title?: string
  url?: string
}

export interface Memory {
  id: string
  created_at: string

  // Raw Audiopen data
  audiopen_id: string
  title: string
  body: string
  orig_transcript: string | null
  tags: string[]
  audiopen_created_at: string

  // AI-extracted metadata
  memory_type: MemoryType | null
  entities: Entities | null
  themes: string[] | null
  emotional_tone: string | null

  // Source reference (article, project, etc.)
  source_reference: SourceReference | null

  // Vector search
  embedding: number[] | null

  // Processing status
  processed: boolean
  processed_at: string | null
  error: string | null
}

// ============================================================================
// THEME CLUSTERING TYPES
// ============================================================================

export interface ThemeCluster {
  id: string
  name: string
  icon: string
  color: string
  memory_count: number
  sample_keywords: string[]
  memories: Memory[]
}

export interface ThemeClustersResponse {
  clusters: ThemeCluster[]
  total_memories: number
  uncategorized_count: number
}

// ============================================================================
// MEMORY ONBOARDING TYPES
// ============================================================================

export type PromptCategory =
  | 'core_identity'
  | 'relationships'
  | 'places'
  | 'education_career'
  | 'interests_hobbies'
  | 'life_events'
  | 'daily_life'
  | 'aspirations'
  | 'creative_professional'
  | 'ai_suggested'

export type PromptStatus = 'pending' | 'completed' | 'dismissed' | 'suggested'

export interface MemoryPrompt {
  id: string
  prompt_text: string
  prompt_description: string | null
  category: PromptCategory
  priority_order: number | null  // 1-10 for required, null for optional
  is_required: boolean
  created_at: string
}

export interface MemoryResponse {
  id: string
  user_id: string
  prompt_id: string | null
  custom_title: string | null  // For ad-hoc memories
  bullets: string[]
  is_template: boolean
  created_at: string
  updated_at: string
  embedding?: number[]
}

export interface UserPromptStatus {
  id: string
  user_id: string
  prompt_id: string
  status: PromptStatus
  response_id: string | null
  suggested_at: string | null  // When AI suggested as follow-up
  completed_at: string | null
  dismissed_at: string | null
  created_at: string
}

export interface MemoryPromptWithStatus extends MemoryPrompt {
  status?: PromptStatus
  response?: MemoryResponse
}

export interface MemoryProgress {
  completed_required: number
  total_required: number
  completed_total: number
  total_prompts: number
  completion_percentage: number
  has_unlocked_projects: boolean
}

export interface GapAnalysisResult {
  followUpPrompts: Array<{
    promptText: string
    reasoning: string
  }>
}

// ============================================================================
// PROJECT ENHANCEMENTS
// ============================================================================

export interface ProjectNote {
  id: string
  project_id: string
  user_id: string
  bullets: string[]
  created_at: string
  embedding?: number[]
}

export interface ProjectWithNotes extends Project {
  notes?: ProjectNote[]
  days_dormant?: number
}

export type DormancyLevel = 'fresh' | 'cooling' | 'cold' | 'frozen'

export interface DormantProjectNudge {
  project_id: string
  project: Project
  type: 'gentle_reminder' | 'strong_nudge' | 'archive_suggestion'
  days_dormant: number
  message: string
  actions: string[]
  dormancy_level: DormancyLevel
}

// ============================================================================
// SYNTHESIS TRANSPARENCY
// ============================================================================

export interface CapabilityUsed {
  id: string
  name: string
  strength: number
  source_project: string
  recent_commits?: number
}

export interface InterestMatched {
  memory_id: string
  quote: string
  relevance_score: number
}

export interface NodeStrengthChange {
  capability_id: string
  strength_boost: number
}

export interface SourceAnalysis {
  capabilities_used: CapabilityUsed[]
  interests_matched: InterestMatched[]
  synthesis_reasoning: string
  node_strength_changes: NodeStrengthChange[]
}

export interface ProjectSuggestionEnhanced extends ProjectSuggestion {
  source_analysis?: SourceAnalysis
}

// ============================================================================
// NODE STRENGTHENING
// ============================================================================

export interface NodeStrengthUpdate {
  node_type: NodeType
  node_id: string
  old_strength: number
  new_strength: number
  change: number
  reason: string
}

export interface ActiveSkill {
  capability_id: string
  name: string
  strength: number
  change: number  // e.g., +0.30
  commits: number
  last_activity: string
  related_suggestions?: ProjectSuggestion[]
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface MemoryPromptsResponse {
  required: MemoryPromptWithStatus[]
  suggested: MemoryPromptWithStatus[]
  optional: MemoryPromptWithStatus[]
  progress: MemoryProgress
}

export interface CreateMemoryResponseInput {
  prompt_id?: string
  custom_title?: string
  bullets: string[]
}

export interface SubmitMemoryResponse {
  response: MemoryResponse
  gap_analysis?: GapAnalysisResult
  progress: MemoryProgress
}

export interface DormantProjectsResponse {
  nudges: DormantProjectNudge[]
}

export interface ActiveSkillsResponse {
  activeSkills: ActiveSkill[]
}

export interface QuickUpdateInput {
  action: 'did_session' | 'taking_break'
  bullets?: string[]
}

export interface Bridge {
  id: string
  created_at: string
  memory_a: string
  memory_b: string
  bridge_type: BridgeType
  strength: number
  entities_shared: string[] | null
}

// Bridge with populated memory objects (from Supabase joins)
export interface BridgeWithMemories extends Omit<Bridge, 'memory_a' | 'memory_b'> {
  memory_a: Memory
  memory_b: Memory
}

export interface ExtractedMetadata {
  memory_type: MemoryType
  entities: Entities
  themes: string[]
  tags?: string[]
  emotional_tone: string
  summary_title: string
  insightful_body: string
}

export interface BridgeCandidate {
  memory: Memory
  bridge_type: BridgeType
  strength: number
  entities_shared?: string[]
  reason: string // Human-readable explanation
}

// ============================================================================
// ONBOARDING & KILLER FEATURES
// ============================================================================

export interface OnboardingResponse {
  transcript: string
  question_number: number
}

export interface OnboardingAnalysis {
  capabilities: string[]
  themes: string[]
  patterns: string[]
  entities: Entities
  first_insight: string
  graph_preview: {
    nodes: { id: string; label: string; type: string }[]
    edges: { from: string; to: string; label: string }[]
  }
}

export interface GapPrompt {
  id: string
  prompt_text: string
  reasoning: string
  category: 'transition' | 'skill' | 'project' | 'general'
  priority: number
  created_at: string
}

export interface CreativeOpportunity {
  id: string
  title: string
  description: string
  why_you: string[] // Array of reasons why this fits the user
  capabilities_used: string[]
  memories_referenced: string[]
  revenue_potential?: string // e.g., "$500-2000/mo" if income goals mentioned
  next_steps: string[]
  confidence: number
  created_at: string
}

export interface CognitivePattern {
  type: 'thinking_time' | 'velocity' | 'emotional_continuity' | 'side_hustle_hours'
  title: string
  description: string
  data: any
  insight: string
}

export interface TimelinePattern {
  best_thinking_times: { day: string; hour: number; count: number }[]
  thought_velocity: { week: string; count: number }[]
  emotional_trends: { date: string; tone: string }[]
  side_hustle_hours: { month: string; hours: number }[]
}

export interface MemoryEvolution {
  topic: string
  timeline: {
    date: string
    memory_id: string
    stance: string
    quote: string
  }[]
  evolution_type: 'growth' | 'contradiction' | 'refinement'
  summary: string
}

export interface ProjectPattern {
  pattern_type: 'abandonment' | 'success' | 'cycle'
  description: string
  projects_affected: string[]
  recommendation: string
}

export interface SynthesisInsight {
  type: 'evolution' | 'pattern' | 'opportunity' | 'collision'
  title: string
  description: string
  data: MemoryEvolution | ProjectPattern | any
  actionable: boolean
  action?: string
}

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
  type: 'creative' | 'technical' | 'learning' // Project category
  status: ProjectStatus
  last_active: string // ISO 8601
  created_at: string
  updated_at?: string
  is_priority?: boolean // Only one project can be priority at a time
  metadata?: ProjectMetadata
  embedding?: number[] // Vector embedding (1536 dims)

  // Daily Queue fields
  energy_level?: 'low' | 'moderate' | 'high'
  estimated_next_step_time?: number // minutes
  context_requirements?: string[] // ['desk', 'tools', etc.]
  blockers?: any[] // Array of blocker objects
  recently_unblocked?: boolean

  // Project Graveyard fields
  abandoned_at?: string
  abandoned_reason?: 'time' | 'energy' | 'interest' | 'external' | 'wrong_goal'
  post_mortem?: any
  would_restart?: boolean
}

export type ProjectStatus = 'upcoming' | 'active' | 'on-hold' | 'maintaining' | 'completed' | 'archived' | 'abandoned'

export interface Task {
  id: string
  text: string
  done: boolean
  created_at: string
  order: number
}

export interface ProjectMetadata {
  tags?: string[]
  energy_level?: 'low' | 'medium' | 'high'
  materials_needed?: string[]
  estimated_time?: string // e.g., "2 hours", "1 week"
  photos?: string[] // URLs to photos/artifacts
  from_suggestion?: string // Suggestion ID if built from suggestion
  capabilities?: string[] // Capability IDs used
  original_points?: number // Points from suggestion
  tasks?: Task[] // Project checklist - first incomplete task is the next step
  progress?: number // 0-100 percentage complete
  [key: string]: any // Allow arbitrary metadata
  // DEPRECATED: next_step field removed - use tasks?.find(t => !t.done)?.text instead
}

export interface CreateProjectInput {
  title: string
  description?: string
  status?: ProjectStatus
  metadata?: ProjectMetadata
}

export interface UpdateProjectInput {
  title?: string
  description?: string
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
  synthesis_reasoning?: string
  novelty_score: number // 0-1
  feasibility_score: number // 0-1
  interest_score: number // 0-1
  total_points: number
  capability_ids: string[]
  capabilities?: Array<{ id: string; name: string }> // Enriched from API
  memory_ids?: string[]
  is_wildcard: boolean
  suggested_at?: string
  status: SuggestionStatus
  built_project_id?: string | null
  metadata?: SuggestionMetadata
}

export type SuggestionStatus = 'pending' | 'rated' | 'built' | 'dismissed' | 'saved' | 'spark' | 'meh'

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
  onClick?: (id: string) => void
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

// ============================================================================
// DAILY ACTIONABLE QUEUE
// ============================================================================

export interface UserContext {
  available_time: 'quick' | 'moderate' | 'deep' // <30min, 30min-2hr, 2hr+
  current_energy: 'low' | 'moderate' | 'high'
  available_context: string[] // ['desk', 'tools', 'mobile', 'workshop']
}

export interface ProjectScore {
  project_id: string
  project: Project
  total_score: number
  category: 'hot_streak' | 'needs_attention' | 'fresh_energy' | 'available'
  match_reason: string
  breakdown: {
    momentum: number
    staleness: number
    freshness: number
    alignment: number
    unlock_bonus: number
  }
}

export interface DailyQueueResponse {
  queue: ProjectScore[]
  context: UserContext
  total_projects: number
}

// ============================================================================
// CONNECTIONS (SPARKS)
// Explicit linking system between all content types
// ============================================================================

export type ConnectionSourceType = 'project' | 'thought' | 'article' | 'suggestion'
export type ConnectionTargetType = 'project' | 'thought' | 'article' | 'suggestion'
export type ConnectionType = 'inspired_by' | 'relates_to' | 'evolves_from' | 'ai_suggested' | 'manual' | 'reading_flow'
export type ConnectionCreator = 'ai' | 'user' | 'system'

export interface Connection {
  id: string
  source_type: ConnectionSourceType
  source_id: string
  target_type: ConnectionTargetType
  target_id: string
  connection_type: ConnectionType
  ai_reasoning?: string
  created_by: ConnectionCreator
  created_at: string
}

export interface CreateConnectionInput {
  source_type: ConnectionSourceType
  source_id: string
  target_type: ConnectionTargetType
  target_id: string
  connection_type?: ConnectionType
  ai_reasoning?: string
  created_by?: ConnectionCreator
}

export interface ConnectionWithDetails extends Connection {
  source_item?: Project | Memory | ReadingQueueItem | ProjectSuggestion
  target_item?: Project | Memory | ReadingQueueItem | ProjectSuggestion
}

export interface ItemConnection {
  connection_id: string
  related_type: ConnectionSourceType | ConnectionTargetType
  related_id: string
  connection_type: ConnectionType
  direction: 'outbound' | 'inbound'
  created_by: ConnectionCreator
  created_at: string
  ai_reasoning?: string
  related_item?: Project | Memory | ReadingQueueItem | ProjectSuggestion
}

export interface ThreadItem {
  item_type: ConnectionSourceType | ConnectionTargetType
  item_id: string
  depth: number
  item?: Project | Memory | ReadingQueueItem | ProjectSuggestion
}

export interface ConnectionsResponse {
  connections: ItemConnection[]
  total: number
}

export interface ThreadResponse {
  items: ThreadItem[]
  root_item: ThreadItem
}

// Reading Queue types (referenced in connections)
export interface ReadingQueueItem {
  id: string
  user_id: string
  url: string
  title?: string
  author?: string
  content?: string
  excerpt?: string
  published_date?: string
  read_time_minutes?: number
  thumbnail_url?: string
  favicon_url?: string
  source?: string
  status: 'unread' | 'reading' | 'archived'
  created_at: string
  read_at?: string
  archived_at?: string
  tags?: string[]
  word_count?: number
}

// Build trigger
