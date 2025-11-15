-- Migration: Update project types and statuses
-- Changes:
--   Types: personal/technical/meta → hobby/side-project/learning
--   Statuses: dormant → on-hold, add 'maintaining'

BEGIN;

-- 1. Update existing data
UPDATE projects
SET type = CASE type
  WHEN 'personal' THEN 'hobby'
  WHEN 'technical' THEN 'side-project'
  WHEN 'meta' THEN 'learning'
  ELSE type
END
WHERE type IN ('personal', 'technical', 'meta');

UPDATE projects
SET status = CASE status
  WHEN 'dormant' THEN 'on-hold'
  ELSE status
END
WHERE status = 'dormant';

-- 2. Drop old constraints
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_type_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- 3. Add new constraints
ALTER TABLE projects
ADD CONSTRAINT projects_type_check
CHECK (type IN ('hobby', 'side-project', 'learning'));

ALTER TABLE projects
ADD CONSTRAINT projects_status_check
CHECK (status IN ('active', 'on-hold', 'maintaining', 'completed', 'archived'));

COMMIT;
