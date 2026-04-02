// Core Types for Idea Engine

export type FrontierMode =
  | 'translate'
  | 'tool_transfer'
  | 'assumption_audit'
  | 'analogy_mine'
  | 'compression'
  | 'inversion';

export type IdeaStatus = 'pending' | 'approved' | 'rejected' | 'spark';

export type RejectionCategory =
  | 'poor_fit'
  | 'not_novel'
  | 'wrong_approach'
  | 'too_vague'
  | 'not_tractable';

export interface Idea {
  id: string;
  user_id: string;
  title: string;
  description: string;
  reasoning?: string;
  domain_pair: [string, string];
  frontier_mode: FrontierMode;
  generation_batch_id?: string;
  novelty_score?: number;
  tractability_score?: number;
  cross_domain_distance?: number;
  prefilter_score?: number;
  status: IdeaStatus;
  opus_verdict?: string;
  rejection_reason?: string;
  rejection_category?: RejectionCategory;
  embedding?: number[];
  parent_idea_id?: string;
  source_frontier_block_id?: string;
  generation_number: number;
  created_at: string;
  reviewed_at?: string;
  metadata?: Record<string, any>;
}

export interface FrontierBlock {
  id: string;
  user_id: string;
  source_idea_id: string;
  concept_name: string;
  concept_description: string;
  abstracted_pattern?: string;
  domain_pair: [string, string];
  frontier_mode: FrontierMode;
  novelty_at_creation?: number;
  surprise_score?: number;
  frontier_advancement_score?: number;
  parent_blocks?: string[];
  generation: number;
  spawn_count: number;
  success_rate: number;
  temperature: number;
  status: 'active' | 'exhausted' | 'dormant';
  created_at: string;
  last_spawned_at?: string;
}

export interface Domain {
  id: string;
  domain_id: string;
  name: string;
  description?: string;
  concepts: string[];
  created_at: string;
  updated_at: string;
}

export interface DomainPair {
  id: string;
  user_id: string;
  domain_a: string;
  domain_b: string;
  times_generated: number;
  times_approved: number;
  last_generated_at?: string;
  weight_adjustment: number;
  success_rate: number;
  distance_score?: number;
  penalty_weight: number;
  created_at: string;
  updated_at: string;
}

export interface RejectionPattern {
  id: string;
  user_id: string;
  pattern_type: 'domain_combo' | 'mode' | 'concept_pattern';
  pattern_signature: string;
  rejection_count: number;
  last_rejected_at: string;
  penalty_weight: number;
  suppression_until?: string;
  typical_reasons?: string[];
  created_at: string;
}

export interface EvolutionaryFeedback {
  id: string;
  user_id: string;
  cycle_date: string;
  ideas_generated: number;
  generation_params?: Record<string, any>;
  approved_ids?: string[];
  rejected_ids?: string[];
  rejection_reasons?: Record<string, { reason: string; category: RejectionCategory }>;
  domain_pair_performance?: Record<string, number>;
  mode_effectiveness?: Record<string, number>;
  pattern_failures?: Record<string, number>;
  adjustments_made?: Record<string, any>;
  created_at: string;
}

export interface GenerationBatch {
  id: string;
  user_id: string;
  batch_type: 'scheduled' | 'manual' | 'spawn';
  ideas_count: number;
  config?: Record<string, any>;
  prefilter_pass_count: number;
  prefilter_pass_rate?: number;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  error_message?: string;
}

export interface ModeStats {
  id: string;
  user_id: string;
  frontier_mode: FrontierMode;
  times_used: number;
  times_approved: number;
  success_rate: number;
  last_used_at?: string;
  weight_adjustment: number;
  created_at: string;
  updated_at: string;
}

export interface SeedIdea {
  id: string;
  title: string;
  description: string;
  reasoning?: string;
  frontier_mode: FrontierMode;
  domain_pair: [string, string];
  quality_rating: 1 | 2 | 3 | 4 | 5;
  times_referenced: number;
  created_at: string;
}

export interface FeedbackSummary {
  id: string;
  user_id: string;
  window_start: string;
  window_end: string;
  rejection_patterns_summary?: string;
  approval_patterns_summary?: string;
  ideas_reviewed: number;
  approval_rate: number;
  created_at: string;
}

// Generation Strategy Types
export interface GenerationStrategy {
  mode: 'random' | 'forced_novel' | 'mutation' | 'hybrid';
  domains?: [string, string];
  frontier_mode?: FrontierMode;
  source_block_id?: string;
  temperature: number;
  avoid_patterns?: string[];
}

export interface GenerationPlan {
  type: 'spawn' | 'fresh';
  parent_block?: FrontierBlock;
  mutation?: 'domain_shift' | 'expansion' | 'inversion';
  domains: [string, string];
  frontier_mode: FrontierMode;
  temperature: number;
  avoid_patterns?: string[];
}

// Gemini API Types
export interface GeminiResponse {
  title: string;
  description: string;
  reasoning: string;
  tractability_estimate: string;
}

export interface PreFilterScore {
  novelty: number;
  cross_domain_distance: number;
  tractability: number;
  overall: number;
  reasoning: string;
}

// Opus Review Types
export interface OpusVerdict {
  idea_id: string;
  verdict: 'BUILD' | 'SPARK' | 'REJECT';
  reasoning: string;
  rejection_category?: RejectionCategory;
  frontier_advancement_score?: number;
}

// Evolutionary Pressure Types
export interface EvolutionaryPressure {
  suppress: {
    domain_pairs: Array<[string[], number]>;
    modes: Array<[FrontierMode, number]>;
    concept_patterns: Array<[string, number]>;
  };
  amplify: {
    frontier_blocks: Array<[string, number]>; // [block_id, spawn_probability]
    domain_pairs: Array<[string[], number]>;
    modes: Array<[FrontierMode, number]>;
  };
  explore: {
    forced_novel_domains: string[];
    temperature_boosts: Array<[string[], number]>;
    wildcard_rate: number;
  };
}

// Metrics Types
export interface EfficiencyMetrics {
  approval_rate: number;
  surprise_rate: number;
  rejection_diversity: number;
}

export interface ExplorationMetrics {
  domain_coverage: number;
  frontier_block_count: number;
  concept_vocabulary_size: number;
  max_lineage_depth: number;
}

export interface ImpactMetrics {
  ideas_built: number;
  from_frontier_blocks: number;
  generational_success_rate: number;
}

export interface DashboardMetrics {
  efficiency: EfficiencyMetrics;
  exploration: ExplorationMetrics;
  impact: ImpactMetrics;
  lineage_tree?: any; // TODO: define tree structure
  domain_heatmap?: Record<string, Record<string, number>>;
}
