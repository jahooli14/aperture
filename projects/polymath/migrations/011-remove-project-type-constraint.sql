-- Remove the type constraint from projects table
-- Allow any type or use default 'creative'

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_type_check;

-- Set default value for type
ALTER TABLE projects
  ALTER COLUMN type SET DEFAULT 'creative';

-- Make type nullable so it's not required
ALTER TABLE projects
  ALTER COLUMN type DROP NOT NULL;

COMMENT ON COLUMN projects.type IS 'Project category - optional field with creative as default';
