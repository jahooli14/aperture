-- Update projects status constraint to include all status values from TypeScript
-- Current: 'active', 'on-hold', 'maintaining', 'completed', 'archived'
-- Adding: 'upcoming', 'dormant', 'abandoned'

-- Drop the old constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the new constraint with all allowed values
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('upcoming', 'active', 'dormant', 'on-hold', 'maintaining', 'completed', 'archived', 'abandoned'));

COMMENT ON CONSTRAINT projects_status_check ON projects IS 'Allowed status values: upcoming, active, dormant, on-hold, maintaining, completed, archived, abandoned';
