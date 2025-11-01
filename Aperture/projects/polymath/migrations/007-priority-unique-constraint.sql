-- Migration 007: Add unique constraint for priority field
-- Ensures only one project per user can have priority=true

-- ============================================================================
-- DROP EXISTING INDEX AND CREATE UNIQUE PARTIAL INDEX
-- ============================================================================

-- Drop the existing non-unique index
DROP INDEX IF EXISTS idx_projects_priority;

-- Create a unique partial index to enforce only one priority=true per user
-- This prevents data integrity issues at the database level
CREATE UNIQUE INDEX idx_projects_priority_unique
ON projects(user_id)
WHERE priority = true;

-- ============================================================================
-- CLEANUP: Ensure current data is valid before applying constraint
-- ============================================================================

-- First, identify if there are any users with multiple priority projects
DO $$
DECLARE
  violation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO violation_count
  FROM (
    SELECT user_id, COUNT(*) as priority_count
    FROM projects
    WHERE priority = true
    GROUP BY user_id
    HAVING COUNT(*) > 1
  ) violations;

  IF violation_count > 0 THEN
    -- Fix violations: keep only the most recently updated project as priority
    WITH ranked_priorities AS (
      SELECT
        id,
        user_id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) as rn
      FROM projects
      WHERE priority = true
    )
    UPDATE projects
    SET priority = false
    WHERE id IN (
      SELECT id FROM ranked_priorities WHERE rn > 1
    );

    RAISE NOTICE 'Cleaned up % users with multiple priority projects', violation_count;
  ELSE
    RAISE NOTICE 'No priority violations found - data is clean';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  max_priorities INTEGER;
BEGIN
  SELECT COALESCE(MAX(priority_count), 0) INTO max_priorities
  FROM (
    SELECT user_id, COUNT(*) as priority_count
    FROM projects
    WHERE priority = true
    GROUP BY user_id
  ) counts;

  IF max_priorities > 1 THEN
    RAISE EXCEPTION 'Data integrity check failed: found user with % priority projects', max_priorities;
  ELSE
    RAISE NOTICE '✓ Migration 007 complete: Priority unique constraint added';
    RAISE NOTICE '  - Only one project per user can have priority=true';
    RAISE NOTICE '  - Data integrity enforced at database level';
  END IF;
END $$;
