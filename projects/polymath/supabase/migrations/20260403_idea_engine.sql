-- Idea Engine Tables

-- Ideas table
CREATE TABLE IF NOT EXISTS ie_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT,
  domain_pair TEXT[] NOT NULL,
  frontier_mode TEXT NOT NULL,
  generation_batch_id UUID,
  novelty_score DECIMAL,
  tractability_score DECIMAL,
  cross_domain_distance DECIMAL,
  prefilter_score DECIMAL,
  status TEXT NOT NULL DEFAULT 'pending',
  opus_verdict TEXT,
  rejection_reason TEXT,
  rejection_category TEXT,
  embedding vector(768),
  parent_idea_id UUID,
  source_frontier_block_id UUID,
  generation_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  digest_sent_at TIMESTAMPTZ,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_ie_ideas_user_id ON ie_ideas(user_id);
CREATE INDEX IF NOT EXISTS idx_ie_ideas_status ON ie_ideas(status);
CREATE INDEX IF NOT EXISTS idx_ie_ideas_created_at ON ie_ideas(created_at);
CREATE INDEX IF NOT EXISTS idx_ie_ideas_embedding ON ie_ideas USING ivfflat (embedding vector_cosine_ops);

-- Frontier blocks table
CREATE TABLE IF NOT EXISTS ie_frontier_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  source_idea_id UUID NOT NULL,
  concept_name TEXT NOT NULL,
  concept_description TEXT NOT NULL,
  abstracted_pattern TEXT,
  domain_pair TEXT[] NOT NULL,
  frontier_mode TEXT NOT NULL,
  novelty_at_creation DECIMAL,
  surprise_score DECIMAL,
  frontier_advancement_score DECIMAL,
  parent_blocks UUID[],
  generation INTEGER NOT NULL DEFAULT 1,
  spawn_count INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL NOT NULL DEFAULT 0,
  temperature DECIMAL NOT NULL DEFAULT 1.0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_spawned_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ie_frontier_blocks_user_id ON ie_frontier_blocks(user_id);
CREATE INDEX IF NOT EXISTS idx_ie_frontier_blocks_status ON ie_frontier_blocks(status);

-- Domain pairs table
CREATE TABLE IF NOT EXISTS ie_domain_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  domain_a TEXT NOT NULL,
  domain_b TEXT NOT NULL,
  times_generated INTEGER NOT NULL DEFAULT 0,
  times_approved INTEGER NOT NULL DEFAULT 0,
  last_generated_at TIMESTAMPTZ,
  weight_adjustment DECIMAL NOT NULL DEFAULT 1.0,
  success_rate DECIMAL NOT NULL DEFAULT 0,
  distance_score DECIMAL,
  penalty_weight DECIMAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, domain_a, domain_b)
);

CREATE INDEX IF NOT EXISTS idx_ie_domain_pairs_user_id ON ie_domain_pairs(user_id);

-- Mode stats table
CREATE TABLE IF NOT EXISTS ie_mode_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  frontier_mode TEXT NOT NULL,
  times_used INTEGER NOT NULL DEFAULT 0,
  times_approved INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  weight_adjustment DECIMAL NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, frontier_mode)
);

CREATE INDEX IF NOT EXISTS idx_ie_mode_stats_user_id ON ie_mode_stats(user_id);

-- Generation batches table
CREATE TABLE IF NOT EXISTS ie_generation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  batch_type TEXT NOT NULL,
  ideas_count INTEGER NOT NULL DEFAULT 0,
  config JSONB,
  prefilter_pass_count INTEGER NOT NULL DEFAULT 0,
  prefilter_pass_rate DECIMAL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ie_generation_batches_user_id ON ie_generation_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_ie_generation_batches_started_at ON ie_generation_batches(started_at);

-- Feedback summaries table
CREATE TABLE IF NOT EXISTS ie_feedback_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  rejection_patterns_summary TEXT,
  approval_patterns_summary TEXT,
  ideas_reviewed INTEGER NOT NULL DEFAULT 0,
  approval_rate DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ie_feedback_summaries_user_id ON ie_feedback_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_ie_feedback_summaries_window_end ON ie_feedback_summaries(window_end);

-- Rejection patterns table
CREATE TABLE IF NOT EXISTS ie_rejection_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_signature TEXT NOT NULL,
  rejection_count INTEGER NOT NULL DEFAULT 0,
  last_rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  penalty_weight DECIMAL NOT NULL DEFAULT 1.0,
  suppression_until TIMESTAMPTZ,
  typical_reasons TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pattern_type, pattern_signature)
);

CREATE INDEX IF NOT EXISTS idx_ie_rejection_patterns_user_id ON ie_rejection_patterns(user_id);
