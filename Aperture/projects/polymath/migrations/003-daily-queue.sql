-- ============================================================================
-- DAILY ACTIONABLE QUEUE - Essential Migration
-- Minimal schema changes needed for Daily Queue MVP
-- ============================================================================

-- Add Daily Queue fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS energy_level TEXT CHECK (energy_level IN ('low', 'moderate', 'high'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS estimated_next_step_time INTEGER; -- minutes
ALTER TABLE projects ADD COLUMN IF NOT EXISTS context_requirements TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS blockers JSONB DEFAULT '[]';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS recently_unblocked BOOLEAN DEFAULT false;

-- Update status constraint to include 'abandoned'
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'on-hold', 'maintaining', 'completed', 'archived', 'abandoned'));

CREATE INDEX IF NOT EXISTS idx_projects_energy ON projects(energy_level);
CREATE INDEX IF NOT EXISTS idx_projects_unblocked ON projects(recently_unblocked) WHERE recently_unblocked = true;

-- User Daily Context table
CREATE TABLE IF NOT EXISTS user_daily_context (
  user_id UUID PRIMARY KEY,
  available_time TEXT CHECK (available_time IN ('quick', 'moderate', 'deep')),
  current_energy TEXT CHECK (current_energy IN ('low', 'moderate', 'high')),
  available_context TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

COMMENT ON TABLE user_daily_context IS 'User context for daily actionable queue matching';

-- RLS for user_daily_context
ALTER TABLE user_daily_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own context"
  ON user_daily_context FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own context"
  ON user_daily_context FOR ALL
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_user_daily_context_updated_at
  BEFORE UPDATE ON user_daily_context
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE 'Daily Queue migration complete!';
  RAISE NOTICE 'New table: user_daily_context';
  RAISE NOTICE 'Extended: projects (added energy_level, estimated_next_step_time, context_requirements, blockers, recently_unblocked)';
END $$;
