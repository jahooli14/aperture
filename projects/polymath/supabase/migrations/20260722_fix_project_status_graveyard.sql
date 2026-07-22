-- The 20260404_metabolism.sql migration introduced 'graveyard' as a project
-- status (see idx_projects_heat) but never updated projects_status_check,
-- so any UPDATE setting status = 'graveyard' has been rejected by the DB
-- ever since. This adds it to the allowed set.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('upcoming', 'active', 'dormant', 'on-hold', 'maintaining', 'completed', 'archived', 'abandoned', 'graveyard'));

COMMENT ON CONSTRAINT projects_status_check ON projects IS 'Allowed status values: upcoming, active, dormant, on-hold, maintaining, completed, archived, abandoned, graveyard';
