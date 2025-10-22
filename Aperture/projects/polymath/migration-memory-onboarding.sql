-- Memory Onboarding System - Database Extension
-- Run this AFTER the main migration.sql
-- Adds structured memory capture, prompts, and enhanced project features

-- ============================================================================
-- TABLE: memory_prompts
-- Template prompts for structured memory capture
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_text TEXT NOT NULL,
  prompt_description TEXT, -- Expanded explanation shown to user
  category TEXT NOT NULL CHECK (category IN (
    'core_identity',
    'relationships',
    'places',
    'education_career',
    'interests_hobbies',
    'life_events',
    'daily_life',
    'aspirations',
    'creative_professional',
    'ai_suggested' -- AI-generated follow-up prompts
  )),
  priority_order INTEGER, -- 1-10 for required prompts, NULL for optional
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_memory_prompts_priority ON memory_prompts(priority_order) WHERE priority_order IS NOT NULL;
CREATE INDEX idx_memory_prompts_category ON memory_prompts(category);
CREATE INDEX idx_memory_prompts_is_required ON memory_prompts(is_required) WHERE is_required = true;

COMMENT ON TABLE memory_prompts IS 'Template prompts for structured memory capture (40 total: 10 required + 30 optional)';
COMMENT ON COLUMN memory_prompts.priority_order IS '1-10 = required foundational prompts, NULL = optional';
COMMENT ON COLUMN memory_prompts.category IS 'Groups prompts by theme for organization';

-- ============================================================================
-- TABLE: memory_responses
-- User responses to prompts (3+ bullets per response)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_id UUID REFERENCES memory_prompts(id) ON DELETE SET NULL,
  custom_title TEXT, -- NULL if template prompt, populated if ad-hoc memory
  bullets TEXT[] NOT NULL CHECK (array_length(bullets, 1) >= 3),
  is_template BOOLEAN DEFAULT true, -- false for ad-hoc memories
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding VECTOR(768) -- Gemini text-embedding-004
);

CREATE INDEX idx_memory_responses_user_id ON memory_responses(user_id);
CREATE INDEX idx_memory_responses_prompt_id ON memory_responses(prompt_id);
CREATE INDEX idx_memory_responses_created_at ON memory_responses(created_at DESC);
CREATE INDEX idx_memory_responses_is_template ON memory_responses(is_template);
CREATE INDEX idx_memory_responses_embedding ON memory_responses USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE memory_responses IS 'User responses to memory prompts (minimum 3 bullets per response)';
COMMENT ON COLUMN memory_responses.bullets IS 'Array of bullet points (minimum 3 required)';
COMMENT ON COLUMN memory_responses.is_template IS 'false if user created ad-hoc memory, true if from template prompt';

-- ============================================================================
-- TABLE: user_prompt_status
-- Tracks which prompts each user has completed/dismissed/been suggested
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_prompt_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt_id UUID NOT NULL REFERENCES memory_prompts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'dismissed', 'suggested')),
  response_id UUID REFERENCES memory_responses(id) ON DELETE SET NULL,
  suggested_at TIMESTAMP WITH TIME ZONE, -- When AI suggested this as follow-up
  completed_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_prompt_status_unique ON user_prompt_status(user_id, prompt_id);
CREATE INDEX idx_user_prompt_status_user_id ON user_prompt_status(user_id);
CREATE INDEX idx_user_prompt_status_status ON user_prompt_status(status);
CREATE INDEX idx_user_prompt_status_completed_at ON user_prompt_status(completed_at DESC) WHERE status = 'completed';

COMMENT ON TABLE user_prompt_status IS 'Tracks completion status of prompts per user';
COMMENT ON COLUMN user_prompt_status.status IS 'pending = not yet answered, completed = answered, dismissed = user skipped, suggested = AI follow-up';

-- ============================================================================
-- TABLE: project_notes
-- Journal-style notes for projects (ongoing updates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  bullets TEXT[] NOT NULL CHECK (array_length(bullets, 1) >= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  embedding VECTOR(768)
);

CREATE INDEX idx_project_notes_project_id ON project_notes(project_id);
CREATE INDEX idx_project_notes_user_id ON project_notes(user_id);
CREATE INDEX idx_project_notes_created_at ON project_notes(created_at DESC);
CREATE INDEX idx_project_notes_embedding ON project_notes USING ivfflat(embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE project_notes IS 'Journal-style notes users add to projects over time';
COMMENT ON COLUMN project_notes.bullets IS 'Array of bullet points (minimum 1 required, typically 3+)';

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================

-- Add synthesis transparency to project_suggestions
ALTER TABLE project_suggestions
  ADD COLUMN IF NOT EXISTS source_analysis JSONB DEFAULT '{}';

COMMENT ON COLUMN project_suggestions.source_analysis IS 'Detailed synthesis transparency: {capabilities_used: [...], interests_matched: [...], synthesis_reasoning: "..."}';

-- Add dormancy tracking to projects (regular column, computed via function)
-- Note: Can't use GENERATED column with now() as it's not immutable
-- Instead, we'll compute this on query or via trigger

COMMENT ON TABLE projects IS 'User projects with dormancy tracking computed at query time';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- memory_responses
ALTER TABLE memory_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own memory responses"
  ON memory_responses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory responses"
  ON memory_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory responses"
  ON memory_responses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory responses"
  ON memory_responses FOR DELETE
  USING (auth.uid() = user_id);

-- user_prompt_status
ALTER TABLE user_prompt_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own prompt status"
  ON user_prompt_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own prompt status"
  ON user_prompt_status FOR ALL
  USING (auth.uid() = user_id);

-- project_notes
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes for their own projects"
  ON project_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create notes for their own projects"
  ON project_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project notes"
  ON project_notes FOR DELETE
  USING (auth.uid() = user_id);

-- memory_prompts (global read-only for users, system can write)
ALTER TABLE memory_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view memory prompts"
  ON memory_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can manage memory prompts"
  ON memory_prompts FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on memory_responses
CREATE TRIGGER update_memory_responses_updated_at BEFORE UPDATE ON memory_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update project.last_active when note added
CREATE OR REPLACE FUNCTION update_project_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET last_active = now()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_last_active_on_note AFTER INSERT ON project_notes
  FOR EACH ROW EXECUTE FUNCTION update_project_last_active();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user's memory completion progress
CREATE OR REPLACE FUNCTION get_memory_progress(p_user_id UUID)
RETURNS TABLE (
  completed_required INTEGER,
  total_required INTEGER,
  completed_total INTEGER,
  total_prompts INTEGER,
  completion_percentage FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER
     FROM user_prompt_status ups
     JOIN memory_prompts mp ON ups.prompt_id = mp.id
     WHERE ups.user_id = p_user_id
       AND ups.status = 'completed'
       AND mp.is_required = true
    ) AS completed_required,
    (SELECT COUNT(*)::INTEGER
     FROM memory_prompts
     WHERE is_required = true
    ) AS total_required,
    (SELECT COUNT(*)::INTEGER
     FROM user_prompt_status
     WHERE user_id = p_user_id
       AND status = 'completed'
    ) AS completed_total,
    (SELECT COUNT(*)::INTEGER FROM memory_prompts) AS total_prompts,
    (SELECT COUNT(*)::FLOAT
     FROM user_prompt_status ups
     JOIN memory_prompts mp ON ups.prompt_id = mp.id
     WHERE ups.user_id = p_user_id
       AND ups.status = 'completed'
       AND mp.is_required = true
    ) / NULLIF((SELECT COUNT(*)::FLOAT FROM memory_prompts WHERE is_required = true), 0) * 100 AS completion_percentage;
END;
$$;

-- Function to check if user has unlocked projects
CREATE OR REPLACE FUNCTION has_unlocked_projects(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  completed_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO completed_count
  FROM user_prompt_status ups
  JOIN memory_prompts mp ON ups.prompt_id = mp.id
  WHERE ups.user_id = p_user_id
    AND ups.status = 'completed'
    AND mp.is_required = true;

  RETURN completed_count >= 10;
END;
$$;

-- Function to compute days dormant for a project
CREATE OR REPLACE FUNCTION get_days_dormant(p_last_active TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN EXTRACT(day FROM (CURRENT_TIMESTAMP - p_last_active))::INTEGER;
END;
$$;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================

-- Verify new tables exist
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('memory_prompts', 'memory_responses', 'user_prompt_status', 'project_notes');

-- Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('memory_prompts', 'memory_responses', 'user_prompt_status', 'project_notes');

-- Test helper functions
-- SELECT * FROM get_memory_progress('user-uuid-here');
-- SELECT has_unlocked_projects('user-uuid-here');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Next steps:
-- 1. Run seed-memory-prompts.sql to populate template prompts
-- 2. Initialize user_prompt_status for existing users
-- 3. Update API endpoints to use new tables
-- 4. Build UI components
