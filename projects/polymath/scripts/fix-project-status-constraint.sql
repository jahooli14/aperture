-- Fix project status constraint to match actual app usage
-- The app uses: active, upcoming, dormant, completed, next
-- Plus we'll keep 'done' and 'abandoned' which are used elsewhere

BEGIN;

-- Drop existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add new constraint with all status values actually used in the app
ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'upcoming', 'next', 'dormant', 'completed', 'done', 'abandoned'));

COMMIT;
