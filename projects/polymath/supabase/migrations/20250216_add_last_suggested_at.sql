-- Add last_suggested_at field to projects table for dormant project rotation
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_suggested_at TIMESTAMP DEFAULT NULL;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_projects_last_suggested_at ON projects(last_suggested_at);

-- Add comment for clarity
COMMENT ON COLUMN projects.last_suggested_at IS 'Timestamp when project was last surfaced as a resurfacing suggestion in the spotlight. Used to rotate dormant projects fairly.';
