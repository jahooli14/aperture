-- Polymath Database Migration
-- Run this on your MemoryOS Supabase instance to add Polymath tables
-- This extends the existing MemoryOS schema with creative project synthesis capabilities

-- ============================================================================
-- TABLE: projects
-- Tracks both personal creative projects and technical projects
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('personal', 'technical', 'meta')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dormant', 'completed', 'archived')),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  embedding VECTOR(768) -- Gemini text-embedding-004
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_type ON projects(type);
CREATE INDEX idx_projects_last_active ON projects(last_active DESC);
CREATE INDEX idx_projects_embedding ON projects USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE projects IS 'User projects - personal creative pursuits and technical projects';
COMMENT ON COLUMN projects.type IS 'personal = creative hobbies, technical = code projects, meta = infrastructure/tools';
COMMENT ON COLUMN projects.metadata IS 'Flexible JSON storage: energy_level, materials_needed, tags, photos, etc.';

-- ============================================================================
-- TABLE: capabilities
-- Technical capabilities extracted from codebase
-- ============================================================================

CREATE TABLE IF NOT EXISTS capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  source_project TEXT, -- e.g., 'memory-os', 'wizard-of-oz'
  code_references JSONB DEFAULT '[]', -- Array of {file, function, line}
  strength FLOAT DEFAULT 1.0 CHECK (strength >= 0),
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding VECTOR(768) -- Gemini text-embedding-004
);

CREATE INDEX idx_capabilities_name ON capabilities(name);
CREATE INDEX idx_capabilities_strength ON capabilities(strength DESC);
CREATE INDEX idx_capabilities_source_project ON capabilities(source_project);
CREATE INDEX idx_capabilities_embedding ON capabilities USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE capabilities IS 'Technical capabilities extracted from Aperture codebase';
COMMENT ON COLUMN capabilities.strength IS 'Increases with usage, used for ranking in synthesis';
COMMENT ON COLUMN capabilities.code_references IS 'JSON array: [{file: "...", function: "...", line: 123}]';

-- ============================================================================
-- TABLE: project_suggestions
-- AI-generated project ideas from capability synthesis
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  synthesis_reasoning TEXT, -- Why AI suggested this (for transparency)
  novelty_score FLOAT CHECK (novelty_score >= 0 AND novelty_score <= 1),
  feasibility_score FLOAT CHECK (feasibility_score >= 0 AND feasibility_score <= 1),
  interest_score FLOAT CHECK (interest_score >= 0 AND interest_score <= 1),
  total_points INTEGER,
  capability_ids UUID[] DEFAULT '{}', -- Capabilities this combines
  memory_ids UUID[] DEFAULT '{}', -- Memories that inspired it
  is_wildcard BOOLEAN DEFAULT false, -- Anti-echo-chamber diversity injection
  suggested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'spark', 'meh', 'built', 'dismissed', 'saved')),
  built_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_suggestions_user_id ON project_suggestions(user_id);
CREATE INDEX idx_suggestions_total_points ON project_suggestions(total_points DESC);
CREATE INDEX idx_suggestions_status ON project_suggestions(status);
CREATE INDEX idx_suggestions_suggested_at ON project_suggestions(suggested_at DESC);
CREATE INDEX idx_suggestions_is_wildcard ON project_suggestions(is_wildcard);

COMMENT ON TABLE project_suggestions IS 'AI-generated project ideas from weekly synthesis';
COMMENT ON COLUMN project_suggestions.is_wildcard IS 'True if this was a diversity injection (anti-echo-chamber)';
COMMENT ON COLUMN project_suggestions.metadata IS 'Flexible storage: tags, estimated_time, required_tools, etc.';

-- ============================================================================
-- TABLE: suggestion_ratings
-- User feedback on suggestions (explicit ratings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS suggestion_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES project_suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating IN (-1, 1, 2)), -- -1 = meh, 1 = spark, 2 = built
  feedback TEXT, -- Optional user notes
  rated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_ratings_suggestion_id ON suggestion_ratings(suggestion_id);
CREATE INDEX idx_ratings_user_id ON suggestion_ratings(user_id);
CREATE INDEX idx_ratings_rating ON suggestion_ratings(rating);
CREATE INDEX idx_ratings_rated_at ON suggestion_ratings(rated_at DESC);

COMMENT ON TABLE suggestion_ratings IS 'User ratings on project suggestions for tuning synthesis';
COMMENT ON COLUMN suggestion_ratings.rating IS '-1 = meh (not interested), 1 = spark (interesting), 2 = built (creating project)';

-- ============================================================================
-- TABLE: node_strengths
-- Track strength of graph nodes (capabilities, interests, projects)
-- ============================================================================

CREATE TABLE IF NOT EXISTS node_strengths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL CHECK (node_type IN ('capability', 'interest', 'project')),
  node_id UUID NOT NULL,
  strength FLOAT DEFAULT 1.0 CHECK (strength >= 0),
  activity_count INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_node_strengths_unique ON node_strengths(node_type, node_id);
CREATE INDEX idx_node_strengths_strength ON node_strengths(strength DESC);
CREATE INDEX idx_node_strengths_last_activity ON node_strengths(last_activity DESC);

COMMENT ON TABLE node_strengths IS 'Activity-based strength tracking for graph nodes (used in synthesis ranking)';
COMMENT ON COLUMN node_strengths.node_type IS 'capability = tech capability, interest = MemoryOS interest, project = active project';
COMMENT ON COLUMN node_strengths.node_id IS 'References id in respective table (capabilities, entities, projects)';

-- ============================================================================
-- TABLE: capability_combinations
-- Track which capability pairs have been suggested (for novelty scoring)
-- ============================================================================

CREATE TABLE IF NOT EXISTS capability_combinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_ids UUID[] NOT NULL, -- Sorted array of 2+ capability IDs
  times_suggested INTEGER DEFAULT 1,
  times_rated_positive INTEGER DEFAULT 0,
  times_rated_negative INTEGER DEFAULT 0,
  penalty_score FLOAT DEFAULT 0, -- Accumulated penalty for repeated dismissal
  first_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_suggested_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_capability_combos_unique ON capability_combinations(capability_ids);
CREATE INDEX idx_capability_combos_times_suggested ON capability_combinations(times_suggested);

COMMENT ON TABLE capability_combinations IS 'Tracks which capability combinations have been suggested (for novelty calculation)';
COMMENT ON COLUMN capability_combinations.capability_ids IS 'Sorted array of capability UUIDs (e.g., [uuid1, uuid2])';

-- ============================================================================
-- TABLE: entities
-- Core entities extracted from memories (people, places, topics)
-- ============================================================================

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL, -- References memories table
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('person', 'place', 'topic')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Interest tracking (added by Polymath)
  is_interest BOOLEAN DEFAULT false,
  interest_strength FLOAT DEFAULT 0.0 CHECK (interest_strength >= 0),
  last_mentioned TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_entities_memory_id ON entities(memory_id);
CREATE INDEX idx_entities_name ON entities(name);
CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_created_at ON entities(created_at DESC);
CREATE INDEX idx_entities_is_interest ON entities(is_interest) WHERE is_interest = true;
CREATE INDEX idx_entities_interest_strength ON entities(interest_strength DESC);

COMMENT ON TABLE entities IS 'Entities extracted from voice note memories (people, places, topics)';
COMMENT ON COLUMN entities.type IS 'person = people mentioned, place = locations, topic = interests/concepts';
COMMENT ON COLUMN entities.is_interest IS 'True if this entity represents a recurring interest (frequency > 3, recency > 0.5)';
COMMENT ON COLUMN entities.interest_strength IS 'Calculated from frequency * 0.5 + recency * 0.5';

-- ============================================================================
-- TABLE: memories
-- Raw voice notes from Audiopen
-- ============================================================================

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Raw Audiopen data
  audiopen_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  orig_transcript TEXT,
  tags TEXT[] DEFAULT '{}',
  audiopen_created_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- AI-extracted metadata
  memory_type TEXT CHECK (memory_type IN ('foundational', 'event', 'insight')),
  entities JSONB, -- Structured: {people: [], places: [], topics: []}
  themes TEXT[] DEFAULT '{}',
  emotional_tone TEXT,

  -- Vector search
  embedding VECTOR(768), -- Gemini text-embedding-004 dimension

  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,

  -- Resurfacing / spaced repetition tracking
  last_reviewed_at TIMESTAMP WITH TIME ZONE,
  review_count INTEGER DEFAULT 0
);

CREATE INDEX idx_memories_audiopen_id ON memories(audiopen_id);
CREATE INDEX idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX idx_memories_processed ON memories(processed);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE memories IS 'Voice notes captured from Audiopen webhook';
COMMENT ON COLUMN memories.embedding IS 'Vector embedding (768 dims from Gemini text-embedding-004)';

-- ============================================================================
-- EXTEND EXISTING TABLES WITH POLYMATH FEATURES
-- (This section kept for backwards compatibility if tables already exist)
-- ============================================================================

-- Add interest tracking columns if they don't exist (in case entities table was already created elsewhere)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'entities') THEN
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS is_interest BOOLEAN DEFAULT false;
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS interest_strength FLOAT DEFAULT 0.0 CHECK (interest_strength >= 0);
    ALTER TABLE entities ADD COLUMN IF NOT EXISTS last_mentioned TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entities_is_interest ON entities(is_interest) WHERE is_interest = true;
CREATE INDEX IF NOT EXISTS idx_entities_interest_strength ON entities(interest_strength DESC);

COMMENT ON COLUMN entities.is_interest IS 'True if this entity represents a recurring interest (frequency > 3, recency > 0.5)';
COMMENT ON COLUMN entities.interest_strength IS 'Calculated from frequency * 0.5 + recency * 0.5';

-- ============================================================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================================================

-- Function to search similar projects
CREATE OR REPLACE FUNCTION search_similar_projects(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
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
    projects.id,
    projects.title,
    projects.description,
    1 - (projects.embedding <=> query_embedding) AS similarity
  FROM projects
  WHERE 1 - (projects.embedding <=> query_embedding) > match_threshold
  ORDER BY projects.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search similar capabilities
CREATE OR REPLACE FUNCTION search_similar_capabilities(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  strength FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    capabilities.id,
    capabilities.name,
    capabilities.description,
    capabilities.strength,
    1 - (capabilities.embedding <=> query_embedding) AS similarity
  FROM capabilities
  WHERE 1 - (capabilities.embedding <=> query_embedding) > match_threshold
  ORDER BY capabilities.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Currently single-user, but scoped for future multi-user support
-- ============================================================================

-- Enable RLS on all new tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestion_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE node_strengths ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_combinations ENABLE ROW LEVEL SECURITY;

-- Projects: User can only see their own
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Capabilities: Global (all users can read, system can write)
CREATE POLICY "Anyone can view capabilities"
  ON capabilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage capabilities"
  ON capabilities FOR ALL
  TO service_role
  USING (true);

-- Project Suggestions: User can only see their own
CREATE POLICY "Users can view their own suggestions"
  ON project_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert suggestions"
  ON project_suggestions FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can update their own suggestions"
  ON project_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Suggestion Ratings: User can only rate their own suggestions
CREATE POLICY "Users can view their own ratings"
  ON suggestion_ratings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ratings"
  ON suggestion_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Node Strengths: Global read, system write
CREATE POLICY "Anyone can view node strengths"
  ON node_strengths FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage node strengths"
  ON node_strengths FOR ALL
  TO service_role
  USING (true);

-- Capability Combinations: Global read, system write
CREATE POLICY "Anyone can view capability combinations"
  ON capability_combinations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage capability combinations"
  ON capability_combinations FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capabilities_updated_at BEFORE UPDATE ON capabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_node_strengths_updated_at BEFORE UPDATE ON node_strengths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Insert example capabilities (you can delete these after testing)
-- Uncomment to seed with examples:

-- INSERT INTO capabilities (name, description, source_project, code_references, strength) VALUES
--   ('voice-processing', 'Voice note capture and processing via Audiopen', 'memory-os', '[{"file": "api/webhook.ts", "function": "handleWebhook"}]', 8.2),
--   ('embeddings', 'Vector embeddings for semantic search (OpenAI)', 'memory-os', '[{"file": "src/lib/embeddings.ts", "function": "generateEmbedding"}]', 7.5),
--   ('knowledge-graph', 'Entity extraction and relationship mapping', 'memory-os', '[{"file": "api/bridges.ts", "function": "findBridges"}]', 6.8),
--   ('face-alignment', 'Face detection and alignment for baby photos', 'wizard-of-oz', '[{"file": "api/align.ts"}]', 5.2),
--   ('image-processing', 'Image manipulation and optimization', 'wizard-of-oz', '[{"file": "src/lib/images.ts"}]', 4.9),
--   ('documentation-generation', 'AI-powered documentation creation', 'autonomous-docs', '[{"file": "scripts/autonomous-docs/update.ts"}]', 3.1),
--   ('self-healing-tests', 'Automated test repair system', 'self-healing-tests', '[{"file": "scripts/self-healing-tests/repair.ts"}]', 2.8)
-- ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- VALIDATION QUERIES
-- Run these after migration to verify everything works
-- ============================================================================

-- Check all tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('projects', 'capabilities', 'project_suggestions', 'suggestion_ratings', 'node_strengths', 'capability_combinations');

-- Check entities table was extended
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'entities'
-- AND column_name IN ('is_interest', 'interest_strength', 'last_mentioned');

-- Check RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('projects', 'capabilities', 'project_suggestions', 'suggestion_ratings', 'node_strengths', 'capability_combinations');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Run this migration on your Supabase instance
-- 2. Generate embeddings for capabilities (run capability scanner)
-- 3. Set up cron jobs for synthesis (Vercel cron config)
-- 4. Deploy API endpoints
-- 5. Test with first manual synthesis

-- See ROADMAP.md for full implementation plan
