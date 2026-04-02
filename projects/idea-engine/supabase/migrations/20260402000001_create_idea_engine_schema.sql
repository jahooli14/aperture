-- Idea Engine Database Schema
-- Prefix: ie_ (idea engine) to avoid conflicts with Polymath tables
-- Created: 2026-04-02

-- Enable pgvector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Table 1: ie_ideas - All generated ideas
CREATE TABLE IF NOT EXISTS ie_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT, -- Why this idea matters

  -- Generation metadata
  domain_pair TEXT[] NOT NULL, -- ['neuroscience', 'ml']
  frontier_mode TEXT NOT NULL CHECK (frontier_mode IN (
    'translate', 'tool_transfer', 'assumption_audit',
    'analogy_mine', 'compression', 'inversion'
  )),
  generation_batch_id UUID, -- Which batch created this

  -- Scoring
  novelty_score FLOAT CHECK (novelty_score >= 0 AND novelty_score <= 1),
  tractability_score FLOAT CHECK (tractability_score >= 0 AND tractability_score <= 1),
  cross_domain_distance FLOAT CHECK (cross_domain_distance >= 0 AND cross_domain_distance <= 1),
  prefilter_score FLOAT CHECK (prefilter_score >= 0 AND prefilter_score <= 1),

  -- Review status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'spark'
  )),
  opus_verdict TEXT,
  rejection_reason TEXT,
  rejection_category TEXT, -- 'poor_fit', 'not_novel', 'wrong_approach', 'too_vague'

  -- Vector embedding
  embedding VECTOR(768),

  -- Lineage
  parent_idea_id UUID REFERENCES ie_ideas(id) ON DELETE SET NULL,
  source_frontier_block_id UUID, -- Will reference ie_frontier_blocks
  generation_number INTEGER DEFAULT 0, -- 0 = root, 1+ = descendant

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for ie_ideas
CREATE INDEX idx_ie_ideas_user ON ie_ideas(user_id);
CREATE INDEX idx_ie_ideas_status ON ie_ideas(status);
CREATE INDEX idx_ie_ideas_domain_pair ON ie_ideas USING GIN(domain_pair);
CREATE INDEX idx_ie_ideas_frontier_mode ON ie_ideas(frontier_mode);
CREATE INDEX idx_ie_ideas_batch ON ie_ideas(generation_batch_id);
CREATE INDEX idx_ie_ideas_created ON ie_ideas(created_at DESC);

-- Vector similarity index (IVFFlat for cosine distance)
CREATE INDEX idx_ie_ideas_embedding ON ie_ideas
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS for ie_ideas
ALTER TABLE ie_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ideas"
  ON ie_ideas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ideas"
  ON ie_ideas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ideas"
  ON ie_ideas FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Table 2: ie_frontier_blocks - High-value approved ideas that spawn follow-ups
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_frontier_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_idea_id UUID REFERENCES ie_ideas(id) ON DELETE CASCADE NOT NULL,

  -- Core identity
  concept_name TEXT NOT NULL, -- e.g., "olfactory-graph-navigation"
  concept_description TEXT NOT NULL,
  abstracted_pattern TEXT, -- AI-extracted general principle

  -- Frontier metadata
  domain_pair TEXT[] NOT NULL,
  frontier_mode TEXT NOT NULL,
  novelty_at_creation FLOAT,
  surprise_score FLOAT, -- (1 - expected_approval_prob)
  frontier_advancement_score FLOAT, -- FAS calculation

  -- Lineage tracking
  parent_blocks UUID[], -- Array of parent frontier block IDs
  generation INTEGER DEFAULT 0, -- 0 = root, 1+ = descendant

  -- Evolution dynamics
  spawn_count INTEGER DEFAULT 0, -- How many children spawned
  success_rate FLOAT DEFAULT 0, -- % of children that got approved
  temperature FLOAT DEFAULT 1.0, -- Exploration param for this branch

  -- Lifecycle
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'dormant')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_spawned_at TIMESTAMPTZ,

  UNIQUE(user_id, source_idea_id)
);

-- Indexes for ie_frontier_blocks
CREATE INDEX idx_ie_frontier_blocks_user ON ie_frontier_blocks(user_id);
CREATE INDEX idx_ie_frontier_blocks_status ON ie_frontier_blocks(status)
  WHERE status = 'active';
CREATE INDEX idx_ie_frontier_blocks_generation ON ie_frontier_blocks(generation, success_rate DESC);
CREATE INDEX idx_ie_frontier_blocks_surprise ON ie_frontier_blocks(surprise_score DESC);

-- RLS for ie_frontier_blocks
ALTER TABLE ie_frontier_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own frontier blocks"
  ON ie_frontier_blocks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own frontier blocks"
  ON ie_frontier_blocks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own frontier blocks"
  ON ie_frontier_blocks FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Table 3: ie_domains - Domain taxonomy (20 domains, ~5 concepts each)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Domain identity
  domain_id TEXT UNIQUE NOT NULL, -- 'neuroscience', 'ml', etc.
  name TEXT NOT NULL,
  description TEXT,

  -- Concepts (seed vocabulary)
  concepts TEXT[] NOT NULL, -- Array of 3-5 seed concepts

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ie_domains
CREATE INDEX idx_ie_domains_domain_id ON ie_domains(domain_id);

-- No RLS - domains are global/system-managed


-- ============================================================================
-- Table 4: ie_domain_pairs - Track which domain pairs have been explored
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_domain_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Domain pair (always sorted alphabetically)
  domain_a TEXT NOT NULL,
  domain_b TEXT NOT NULL,

  -- Usage stats
  times_generated INTEGER DEFAULT 0,
  times_approved INTEGER DEFAULT 0,
  last_generated_at TIMESTAMPTZ,

  -- Learned weights
  weight_adjustment FLOAT DEFAULT 0, -- Penalty or boost
  success_rate FLOAT DEFAULT 0, -- approval rate

  -- Distance metric (semantic)
  distance_score FLOAT, -- 0-1, higher = more distant

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, domain_a, domain_b)
);

-- Indexes for ie_domain_pairs
CREATE INDEX idx_ie_domain_pairs_user ON ie_domain_pairs(user_id);
CREATE INDEX idx_ie_domain_pairs_domains ON ie_domain_pairs(domain_a, domain_b);
CREATE INDEX idx_ie_domain_pairs_success ON ie_domain_pairs(success_rate DESC);

-- RLS for ie_domain_pairs
ALTER TABLE ie_domain_pairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own domain pairs"
  ON ie_domain_pairs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own domain pairs"
  ON ie_domain_pairs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own domain pairs"
  ON ie_domain_pairs FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Table 5: ie_rejection_patterns - Negative selection tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_rejection_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Pattern identification
  pattern_type TEXT NOT NULL CHECK (pattern_type IN (
    'domain_combo', 'mode', 'concept_pattern'
  )),
  pattern_signature TEXT NOT NULL, -- e.g., "neuroscience|ml" or "translate"

  -- Rejection tracking
  rejection_count INTEGER DEFAULT 1,
  last_rejected_at TIMESTAMPTZ DEFAULT NOW(),

  -- Penalty dynamics
  penalty_weight FLOAT DEFAULT 0.1, -- Incremental penalty
  suppression_until TIMESTAMPTZ, -- Temporary ban

  -- Context
  typical_reasons TEXT[], -- ["too vague", "not tractable"]

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, pattern_type, pattern_signature)
);

-- Indexes for ie_rejection_patterns
CREATE INDEX idx_ie_rejection_patterns_user ON ie_rejection_patterns(user_id);
CREATE INDEX idx_ie_rejection_patterns_type ON ie_rejection_patterns(pattern_type, pattern_signature);
CREATE INDEX idx_ie_rejection_patterns_penalty ON ie_rejection_patterns(penalty_weight DESC);

-- RLS for ie_rejection_patterns
ALTER TABLE ie_rejection_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rejection patterns"
  ON ie_rejection_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rejection patterns"
  ON ie_rejection_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rejection patterns"
  ON ie_rejection_patterns FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Table 6: ie_evolutionary_feedback - Review cycle tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_evolutionary_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  cycle_date DATE NOT NULL,

  -- Input: Generation batch
  ideas_generated INTEGER NOT NULL,
  generation_params JSONB, -- domains, modes, temperatures used

  -- Output: Opus verdicts
  approved_ids UUID[],
  rejected_ids UUID[],
  rejection_reasons JSONB, -- {idea_id: {reason, category}}

  -- Derived signals
  domain_pair_performance JSONB, -- {pair: approval_rate}
  mode_effectiveness JSONB, -- {mode: approval_rate}
  pattern_failures JSONB, -- {pattern: reject_count}

  -- Evolution actions taken
  adjustments_made JSONB, -- What we learned, what we'll change

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, cycle_date)
);

-- Indexes for ie_evolutionary_feedback
CREATE INDEX idx_ie_evolutionary_feedback_user ON ie_evolutionary_feedback(user_id);
CREATE INDEX idx_ie_evolutionary_feedback_date ON ie_evolutionary_feedback(cycle_date DESC);

-- RLS for ie_evolutionary_feedback
ALTER TABLE ie_evolutionary_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own evolutionary feedback"
  ON ie_evolutionary_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own evolutionary feedback"
  ON ie_evolutionary_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- Table 7: ie_lineage_edges - Parent-child relationships between ideas
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_lineage_edges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Genealogy
  parent_id UUID REFERENCES ie_ideas(id) ON DELETE CASCADE NOT NULL,
  child_id UUID REFERENCES ie_ideas(id) ON DELETE CASCADE NOT NULL,

  -- Mutation info
  mutation_type TEXT CHECK (mutation_type IN (
    'domain_shift', 'mode_change', 'concept_recombination', 'inversion'
  )),
  similarity_score FLOAT, -- How similar parent and child are

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(parent_id, child_id)
);

-- Indexes for ie_lineage_edges
CREATE INDEX idx_ie_lineage_edges_parent ON ie_lineage_edges(parent_id);
CREATE INDEX idx_ie_lineage_edges_child ON ie_lineage_edges(child_id);
CREATE INDEX idx_ie_lineage_edges_user ON ie_lineage_edges(user_id);

-- RLS for ie_lineage_edges
ALTER TABLE ie_lineage_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lineage edges"
  ON ie_lineage_edges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lineage edges"
  ON ie_lineage_edges FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- Table 8: ie_generation_batches - Track each generation run
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_generation_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Batch metadata
  batch_type TEXT CHECK (batch_type IN ('scheduled', 'manual', 'spawn')),
  ideas_count INTEGER DEFAULT 0,

  -- Generation config
  config JSONB, -- domains, modes, temperatures, etc.

  -- Results
  prefilter_pass_count INTEGER DEFAULT 0,
  prefilter_pass_rate FLOAT,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'running' CHECK (status IN (
    'running', 'completed', 'failed', 'cancelled'
  )),
  error_message TEXT
);

-- Indexes for ie_generation_batches
CREATE INDEX idx_ie_generation_batches_user ON ie_generation_batches(user_id);
CREATE INDEX idx_ie_generation_batches_started ON ie_generation_batches(started_at DESC);
CREATE INDEX idx_ie_generation_batches_status ON ie_generation_batches(status);

-- RLS for ie_generation_batches
ALTER TABLE ie_generation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generation batches"
  ON ie_generation_batches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generation batches"
  ON ie_generation_batches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generation batches"
  ON ie_generation_batches FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Table 9: ie_mode_stats - Track frontier mode usage and effectiveness
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_mode_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Mode identity
  frontier_mode TEXT NOT NULL CHECK (frontier_mode IN (
    'translate', 'tool_transfer', 'assumption_audit',
    'analogy_mine', 'compression', 'inversion'
  )),

  -- Usage stats
  times_used INTEGER DEFAULT 0,
  times_approved INTEGER DEFAULT 0,
  success_rate FLOAT DEFAULT 0,

  -- Entropy tracking (for mode collapse detection)
  last_used_at TIMESTAMPTZ,

  -- Learned weights
  weight_adjustment FLOAT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, frontier_mode)
);

-- Indexes for ie_mode_stats
CREATE INDEX idx_ie_mode_stats_user ON ie_mode_stats(user_id);
CREATE INDEX idx_ie_mode_stats_mode ON ie_mode_stats(frontier_mode);
CREATE INDEX idx_ie_mode_stats_success ON ie_mode_stats(success_rate DESC);

-- RLS for ie_mode_stats
ALTER TABLE ie_mode_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mode stats"
  ON ie_mode_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mode stats"
  ON ie_mode_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mode stats"
  ON ie_mode_stats FOR UPDATE
  USING (auth.uid() = user_id);


-- ============================================================================
-- Table 10: ie_seed_ideas - Cold-start examples (curated by hand)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_seed_ideas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT,

  -- Classification
  frontier_mode TEXT NOT NULL,
  domain_pair TEXT[] NOT NULL,
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),

  -- Usage tracking
  times_referenced INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for ie_seed_ideas
CREATE INDEX idx_ie_seed_ideas_mode ON ie_seed_ideas(frontier_mode);

-- No RLS - seed ideas are global


-- ============================================================================
-- Table 11: ie_feedback_summaries - Compressed feedback for prompt injection
-- ============================================================================

CREATE TABLE IF NOT EXISTS ie_feedback_summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Time window
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,

  -- Compressed feedback
  rejection_patterns_summary TEXT, -- ~250 tokens
  approval_patterns_summary TEXT, -- ~250 tokens

  -- Metadata
  ideas_reviewed INTEGER,
  approval_rate FLOAT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, window_start, window_end)
);

-- Indexes for ie_feedback_summaries
CREATE INDEX idx_ie_feedback_summaries_user ON ie_feedback_summaries(user_id);
CREATE INDEX idx_ie_feedback_summaries_window ON ie_feedback_summaries(window_end DESC);

-- RLS for ie_feedback_summaries
ALTER TABLE ie_feedback_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback summaries"
  ON ie_feedback_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback summaries"
  ON ie_feedback_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================================================

-- Function: Find similar ideas (for deduplication)
CREATE OR REPLACE FUNCTION match_ie_ideas(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.88,
  match_count INT DEFAULT 10,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ie_ideas.id,
    ie_ideas.title,
    ie_ideas.description,
    1 - (ie_ideas.embedding <=> query_embedding) AS similarity
  FROM ie_ideas
  WHERE (filter_user_id IS NULL OR ie_ideas.user_id = filter_user_id)
    AND ie_ideas.embedding IS NOT NULL
    AND 1 - (ie_ideas.embedding <=> query_embedding) > match_threshold
  ORDER BY ie_ideas.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function: Calculate mode entropy (for collapse detection)
CREATE OR REPLACE FUNCTION calculate_mode_entropy(p_user_id UUID)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  total_uses INT;
  mode_entropy FLOAT := 0;
  mode_prob FLOAT;
BEGIN
  -- Get total uses across all modes
  SELECT SUM(times_used) INTO total_uses
  FROM ie_mode_stats
  WHERE user_id = p_user_id;

  IF total_uses = 0 OR total_uses IS NULL THEN
    RETURN 1.0; -- Maximum entropy (uniform distribution)
  END IF;

  -- Calculate Shannon entropy: -Σ(p * log2(p))
  FOR mode_prob IN
    SELECT (times_used::FLOAT / total_uses::FLOAT) AS prob
    FROM ie_mode_stats
    WHERE user_id = p_user_id AND times_used > 0
  LOOP
    mode_entropy := mode_entropy - (mode_prob * log(2, mode_prob));
  END LOOP;

  -- Normalize to 0-1 (max entropy for 6 modes = log2(6) ≈ 2.58)
  RETURN mode_entropy / 2.585;
END;
$$;


-- Function: Get neglected domain pairs (for forced exploration)
CREATE OR REPLACE FUNCTION get_neglected_domain_pairs(
  p_user_id UUID,
  threshold_days INT DEFAULT 30,
  limit_count INT DEFAULT 5
)
RETURNS TABLE (
  domain_a TEXT,
  domain_b TEXT,
  days_since_last_use INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dp.domain_a,
    dp.domain_b,
    EXTRACT(DAY FROM NOW() - dp.last_generated_at)::INT AS days_since_last_use
  FROM ie_domain_pairs dp
  WHERE dp.user_id = p_user_id
    AND (
      dp.last_generated_at IS NULL OR
      dp.last_generated_at < NOW() - (threshold_days || ' days')::INTERVAL
    )
  ORDER BY dp.last_generated_at ASC NULLS FIRST
  LIMIT limit_count;
END;
$$;


-- ============================================================================
-- CONSTRAINTS (Add foreign key now that all tables exist)
-- ============================================================================

-- Add foreign key from ie_ideas to ie_frontier_blocks (was deferred)
ALTER TABLE ie_ideas
  ADD CONSTRAINT fk_ie_ideas_frontier_block
  FOREIGN KEY (source_frontier_block_id)
  REFERENCES ie_frontier_blocks(id)
  ON DELETE SET NULL;
