-- Add priority field to projects table
-- Only one project can be priority at a time

-- Add column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_priority BOOLEAN DEFAULT FALSE;

-- Create function to enforce single priority constraint
CREATE OR REPLACE FUNCTION enforce_single_priority()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a project as priority
  IF NEW.is_priority = TRUE THEN
    -- Unset all other priority projects for this user
    UPDATE projects
    SET is_priority = FALSE
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_priority = TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS enforce_single_priority_trigger ON projects;
CREATE TRIGGER enforce_single_priority_trigger
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_priority();

-- Add index for faster priority queries
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(user_id, is_priority) WHERE is_priority = TRUE;
