-- ============================================================================
-- CLEAR DEMO DATA
-- Removes all template/demo data from the database
-- ============================================================================

-- Delete demo project suggestions
DELETE FROM project_suggestions
WHERE user_id = 'demo-user';

-- Delete demo projects
DELETE FROM projects
WHERE user_id = 'demo-user';

-- Delete demo memories
DELETE FROM memories
WHERE user_id = 'demo-user'
   OR audiopen_id LIKE 'demo-%';

-- Delete demo capabilities (optional - these might be shared)
DELETE FROM capabilities
WHERE source_project IN ('polymath', 'standing-desk', 'photo-portfolio', 'image-classifier')
  AND name IN ('react-typescript', 'supabase-backend', 'ai-integration', 'woodworking', 'photography', 'machine-learning');

-- Verify deletion
DO $$
DECLARE
  mem_count INTEGER;
  proj_count INTEGER;
  sugg_count INTEGER;
  cap_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mem_count FROM memories WHERE user_id = 'demo-user' OR audiopen_id LIKE 'demo-%';
  SELECT COUNT(*) INTO proj_count FROM projects WHERE user_id = 'demo-user';
  SELECT COUNT(*) INTO sugg_count FROM project_suggestions WHERE user_id = 'demo-user';
  SELECT COUNT(*) INTO cap_count FROM capabilities WHERE source_project IN ('polymath', 'standing-desk', 'photo-portfolio', 'image-classifier');

  RAISE NOTICE 'Demo data cleared!';
  RAISE NOTICE 'Remaining demo memories: %', mem_count;
  RAISE NOTICE 'Remaining demo projects: %', proj_count;
  RAISE NOTICE 'Remaining demo suggestions: %', sugg_count;
  RAISE NOTICE 'Remaining demo capabilities: %', cap_count;

  IF mem_count > 0 OR proj_count > 0 OR sugg_count > 0 THEN
    RAISE WARNING 'Some demo data may still exist. Check user_id or audiopen_id patterns.';
  END IF;
END $$;
