-- ============================================================================
-- Clear All Data - Polymath Database
-- WARNING: This will DELETE ALL data from all tables
-- Use with caution - this cannot be undone!
-- ============================================================================

-- Delete in order to respect foreign key constraints
-- Only delete from tables that exist

-- 1. Delete synthesis/analysis data first (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'bridges') THEN
    DELETE FROM bridges;
  END IF;
END $$;

-- 2. Delete project-related data
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_suggestions') THEN
    DELETE FROM project_suggestions;
  END IF;
END $$;

-- 3. Delete projects
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'projects') THEN
    DELETE FROM projects;
  END IF;
END $$;

-- 4. Delete memory-related data
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'memory_responses') THEN
    DELETE FROM memory_responses;
  END IF;

  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_prompt_status') THEN
    DELETE FROM user_prompt_status;
  END IF;
END $$;

-- 5. Delete memories
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'memories') THEN
    DELETE FROM memories;
  END IF;
END $$;

-- 6. Delete context/state data
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_daily_context') THEN
    DELETE FROM user_daily_context;
  END IF;
END $$;

-- 7. Reset any sequences (optional - keeps IDs starting fresh)
-- Note: Postgres uses sequences for auto-incrementing IDs
-- Uncomment if you want to reset ID counters:

-- ALTER SEQUENCE IF EXISTS memories_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS projects_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS bridges_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS project_suggestions_id_seq RESTART WITH 1;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  memories_count INTEGER;
  projects_count INTEGER;
  suggestions_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO memories_count FROM memories;
  SELECT COUNT(*) INTO projects_count FROM projects;
  SELECT COUNT(*) INTO suggestions_count FROM project_suggestions;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Data cleared successfully!';
  RAISE NOTICE 'Memories: % rows remaining', memories_count;
  RAISE NOTICE 'Projects: % rows remaining', projects_count;
  RAISE NOTICE 'Suggestions: % rows remaining', suggestions_count;
  RAISE NOTICE '============================================';
END $$;
