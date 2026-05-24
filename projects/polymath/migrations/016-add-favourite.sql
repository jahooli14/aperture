-- Add is_favourite field to projects table.
-- Distinct from is_priority (the single Keep Going hero). Multi-select.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_projects_favourite
  ON projects(user_id, is_favourite)
  WHERE is_favourite = TRUE;
