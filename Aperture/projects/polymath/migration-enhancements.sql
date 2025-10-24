-- ============================================================================
-- POLYMATH ENHANCEMENTS MIGRATION
-- Adds: Daily Queue, Memory Enhancements, Project Graveyard, Cross-Pillar
-- ============================================================================

-- ============================================================================
-- MEMORY ENHANCEMENTS
-- ============================================================================

-- Memory strength/decay tracking
ALTER TABLE memories ADD COLUMN IF NOT EXISTS strength_score FLOAT DEFAULT 100.0 CHECK (strength_score >= 0 AND strength_score <= 100);
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_strength_update TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Synthesis note support (memory created from combining other memories)
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_synthesis BOOLEAN DEFAULT false;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source_memory_ids UUID[] DEFAULT '{}';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS synthesis_type TEXT CHECK (synthesis_type IN ('connection', 'contradiction', 'evolution'));

-- Project completion reflection support
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS reflection JSONB;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS capabilities_strengthened TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_memories_strength ON memories(strength_score DESC);
CREATE INDEX IF NOT EXISTS idx_memories_synthesis ON memories(is_synthesis) WHERE is_synthesis = true;
CREATE INDEX IF NOT EXISTS idx_memories_source_project ON memories(source_project_id);

-- Context Windows (time-based memory clustering)
CREATE TABLE IF NOT EXISTS context_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  theme TEXT NOT NULL,
  memory_ids UUID[] NOT NULL,
  memory_count INTEGER NOT NULL,
  dominant_entities TEXT[] DEFAULT '{}',
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_context_windows_user ON context_windows(user_id);
CREATE INDEX idx_context_windows_dates ON context_windows(start_date DESC, end_date DESC);

COMMENT ON TABLE context_windows IS 'Time-based memory clusters with AI-generated themes';

-- Memory Collisions (contradictory memories)
CREATE TABLE IF NOT EXISTS memory_collisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  memory_a_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  memory_b_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  contradiction_type TEXT NOT NULL CHECK (contradiction_type IN ('belief', 'fact', 'preference', 'approach')),
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  resolution TEXT CHECK (resolution IN ('evolved', 'error', 'context_dependent')),
  resolution_note TEXT,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  dismissed BOOLEAN DEFAULT false
);

CREATE INDEX idx_collisions_user ON memory_collisions(user_id);
CREATE INDEX idx_collisions_unresolved ON memory_collisions(user_id, resolved_at) WHERE resolved_at IS NULL AND dismissed = false;
CREATE INDEX idx_collisions_memory_a ON memory_collisions(memory_a_id);
CREATE INDEX idx_collisions_memory_b ON memory_collisions(memory_b_id);

COMMENT ON TABLE memory_collisions IS 'Detected contradictions between memories for user reconciliation';

-- Memory Tombstones (archived dead memories)
CREATE TABLE IF NOT EXISTS memory_tombstones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_memory_id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  pruned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  prune_reason TEXT,
  restorable_until TIMESTAMP WITH TIME ZONE, -- 30 days from pruned_at
  restored BOOLEAN DEFAULT false
);

CREATE INDEX idx_tombstones_user ON memory_tombstones(user_id);
CREATE INDEX idx_tombstones_restorable ON memory_tombstones(restorable_until) WHERE restorable_until > now() AND restored = false;

COMMENT ON TABLE memory_tombstones IS 'Archived memories - preserved titles for nostalgia, content deleted';

-- ============================================================================
-- PROJECT ENHANCEMENTS
-- ============================================================================

-- Project abandonment/graveyard support
ALTER TABLE projects ADD COLUMN IF NOT EXISTS abandoned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS abandoned_reason TEXT CHECK (abandoned_reason IN ('time', 'energy', 'interest', 'external', 'wrong_goal'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS post_mortem JSONB;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS would_restart BOOLEAN;

-- Daily queue context matching
ALTER TABLE projects ADD COLUMN IF NOT EXISTS energy_level TEXT CHECK (energy_level IN ('low', 'moderate', 'high'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_next_step_time INTEGER; -- minutes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS context_requirements TEXT[] DEFAULT '{}'; -- ['desk', 'tools', etc.]
ALTER TABLE projects ADD COLUMN IF NOT EXISTS blockers JSONB DEFAULT '[]'; -- Array of blocker objects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS recently_unblocked BOOLEAN DEFAULT false;

-- Update status constraint to include 'abandoned'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'on-hold', 'maintaining', 'completed', 'archived', 'abandoned'));

CREATE INDEX IF NOT EXISTS idx_projects_abandoned ON projects(status, abandoned_at DESC) WHERE status = 'abandoned';
CREATE INDEX IF NOT EXISTS idx_projects_energy ON projects(energy_level);
CREATE INDEX IF NOT EXISTS idx_projects_unblocked ON projects(recently_unblocked) WHERE recently_unblocked = true;

COMMENT ON COLUMN projects.abandoned_reason IS 'Why project died: time, energy, interest, external, wrong_goal';
COMMENT ON COLUMN projects.post_mortem IS 'JSON: {what_killed_it, lessons_learned, was_goal_wrong, what_was_achieved}';

-- Capability Freshness Tracking
CREATE TABLE IF NOT EXISTS capability_freshness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_used TIMESTAMP WITH TIME ZONE NOT NULL,
  days_since_use INTEGER GENERATED ALWAYS AS (
    EXTRACT(DAY FROM (now() - last_used))
  ) STORED,
  freshness_score FLOAT NOT NULL DEFAULT 100.0 CHECK (freshness_score >= 0 AND freshness_score <= 100),
  decay_rate FLOAT NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'fresh' CHECK (status IN ('fresh', 'stable', 'rusty', 'stale')),
  alerts_paused BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(capability_id, user_id)
);

CREATE INDEX idx_freshness_user ON capability_freshness(user_id);
CREATE INDEX idx_freshness_status ON capability_freshness(status);
CREATE INDEX idx_freshness_rusty ON capability_freshness(freshness_score) WHERE freshness_score < 60;

COMMENT ON TABLE capability_freshness IS 'Track skill decay - alerts when capabilities get rusty';
COMMENT ON COLUMN capability_freshness.status IS 'fresh (85-100%), stable (60-84%), rusty (30-59%), stale (<30%)';

-- Refresh Recipes (micro-projects to restore skill freshness)
CREATE TABLE IF NOT EXISTS refresh_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tasks JSONB NOT NULL, -- Array of task strings
  estimated_time TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('trivial', 'easy', 'moderate')),
  success_criteria TEXT,
  personalized BOOLEAN DEFAULT false,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_recipes_capability ON refresh_recipes(capability_id);
CREATE INDEX idx_recipes_user ON refresh_recipes(user_id);
CREATE INDEX idx_recipes_active ON refresh_recipes(user_id, completed_at) WHERE completed_at IS NULL;

COMMENT ON TABLE refresh_recipes IS 'AI-generated micro-projects to refresh stale capabilities';

-- User Daily Context (for queue matching)
CREATE TABLE IF NOT EXISTS user_daily_context (
  user_id UUID PRIMARY KEY,
  available_time TEXT CHECK (available_time IN ('quick', 'moderate', 'deep')), -- <30min, 30min-2hr, 2hr+
  current_energy TEXT CHECK (current_energy IN ('low', 'moderate', 'high')),
  available_context TEXT[] DEFAULT '{}', -- ['desk', 'tools', 'mobile', 'workshop']
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE user_daily_context IS 'User context for daily actionable queue matching';

-- ============================================================================
-- CROSS-PILLAR IMPROVEMENTS
-- ============================================================================

-- Memory-Project Dependencies (required context for work)
CREATE TABLE IF NOT EXISTS project_memory_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('required', 'helpful', 'related')),
  reason TEXT,
  last_reviewed TIMESTAMP WITH TIME ZONE,
  auto_detected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, memory_id)
);

CREATE INDEX idx_dependencies_project ON project_memory_dependencies(project_id);
CREATE INDEX idx_dependencies_memory ON project_memory_dependencies(memory_id);
CREATE INDEX idx_dependencies_required ON project_memory_dependencies(dependency_type, last_reviewed)
  WHERE dependency_type = 'required';

COMMENT ON TABLE project_memory_dependencies IS 'Links memories as required/helpful context for projects';

-- Synthesis Constraints (user control over AI suggestions)
CREATE TABLE IF NOT EXISTS synthesis_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT, -- Preset name (null for active constraints)
  is_active BOOLEAN DEFAULT false, -- Only one active constraint set
  constraints JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_constraints_user ON synthesis_constraints(user_id);
CREATE INDEX idx_constraints_active ON synthesis_constraints(user_id, is_active)
  WHERE is_active = true;

COMMENT ON TABLE synthesis_constraints IS 'User-defined constraints for AI synthesis (time, energy, capabilities, etc.)';

-- ============================================================================
-- ROW LEVEL SECURITY (New Tables)
-- ============================================================================

ALTER TABLE context_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_collisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_freshness ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memory_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE synthesis_constraints ENABLE ROW LEVEL SECURITY;

-- Context Windows
CREATE POLICY "Users can view their own context windows"
  ON context_windows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own context windows"
  ON context_windows FOR ALL
  USING (auth.uid() = user_id);

-- Memory Collisions
CREATE POLICY "Users can view their own collisions"
  ON memory_collisions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own collisions"
  ON memory_collisions FOR ALL
  USING (auth.uid() = user_id);

-- Memory Tombstones
CREATE POLICY "Users can view their own tombstones"
  ON memory_tombstones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own tombstones"
  ON memory_tombstones FOR ALL
  USING (auth.uid() = user_id);

-- Capability Freshness
CREATE POLICY "Users can view their own freshness"
  ON capability_freshness FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own freshness"
  ON capability_freshness FOR ALL
  USING (auth.uid() = user_id);

-- Refresh Recipes
CREATE POLICY "Users can view their own recipes"
  ON refresh_recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recipes"
  ON refresh_recipes FOR ALL
  USING (auth.uid() = user_id);

-- User Daily Context
CREATE POLICY "Users can view their own context"
  ON user_daily_context FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own context"
  ON user_daily_context FOR ALL
  USING (auth.uid() = user_id);

-- Project Memory Dependencies
CREATE POLICY "Users can view dependencies for their projects"
  ON project_memory_dependencies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_memory_dependencies.project_id
    AND projects.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage dependencies for their projects"
  ON project_memory_dependencies FOR ALL
  USING (EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_memory_dependencies.project_id
    AND projects.user_id = auth.uid()
  ));

-- Synthesis Constraints
CREATE POLICY "Users can view their own constraints"
  ON synthesis_constraints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own constraints"
  ON synthesis_constraints FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on capability_freshness
CREATE TRIGGER update_capability_freshness_updated_at BEFORE UPDATE ON capability_freshness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on synthesis_constraints
CREATE TRIGGER update_synthesis_constraints_updated_at BEFORE UPDATE ON synthesis_constraints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at on user_daily_context
CREATE TRIGGER update_user_daily_context_updated_at BEFORE UPDATE ON user_daily_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculate memory strength score
CREATE OR REPLACE FUNCTION calculate_memory_strength(
  created_at_param TIMESTAMP WITH TIME ZONE,
  last_reviewed_param TIMESTAMP WITH TIME ZONE,
  review_count_param INTEGER
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  days_since_created INTEGER;
  days_since_reviewed INTEGER;
  review_bonus FLOAT;
  decay_rate FLOAT := 0.01; -- 1% per day
  strength FLOAT;
BEGIN
  days_since_created := EXTRACT(DAY FROM (now() - created_at_param));

  IF last_reviewed_param IS NULL THEN
    days_since_reviewed := days_since_created;
  ELSE
    days_since_reviewed := EXTRACT(DAY FROM (now() - last_reviewed_param));
  END IF;

  review_bonus := review_count_param * 0.1; -- Each review adds 10%

  -- Start at 100%, decay over time, boost with reviews
  strength := 100.0;
  strength := strength - (days_since_reviewed * decay_rate * 100);
  strength := strength + (review_bonus * 100);

  -- Clamp between 0-100
  strength := GREATEST(0.0, LEAST(100.0, strength));

  RETURN strength;
END;
$$;

-- Calculate capability freshness score
CREATE OR REPLACE FUNCTION calculate_capability_freshness(
  last_used_param TIMESTAMP WITH TIME ZONE,
  decay_rate_param FLOAT
)
RETURNS FLOAT
LANGUAGE plpgsql
AS $$
DECLARE
  days_since_use INTEGER;
  decay_period INTEGER;
  freshness FLOAT;
BEGIN
  days_since_use := EXTRACT(DAY FROM (now() - last_used_param));

  -- Fresh period (no decay): 0-14 days
  IF days_since_use <= 14 THEN
    RETURN 100.0;
  END IF;

  -- Decay formula: exponential with category-specific rate
  decay_period := days_since_use - 14;
  freshness := 100.0 * EXP(-decay_rate_param * decay_period / 30.0);

  -- Clamp between 0-100
  freshness := GREATEST(0.0, LEAST(100.0, freshness));

  RETURN freshness;
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Enhancement migration complete!';
  RAISE NOTICE 'New tables: context_windows, memory_collisions, memory_tombstones, capability_freshness, refresh_recipes, user_daily_context, project_memory_dependencies, synthesis_constraints';
  RAISE NOTICE 'Extended tables: memories, projects';
  RAISE NOTICE 'Next: Deploy API endpoints for new features';
END $$;
