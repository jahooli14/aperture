-- Run this AFTER the main migration to verify everything is set up
-- Also adds optional article AI analysis fields

-- Check if memories table exists (should already exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'memories') THEN
    RAISE NOTICE 'WARNING: memories table does not exist. You need to create it first!';
  ELSE
    RAISE NOTICE 'OK: memories table exists';
  END IF;
END $$;

-- Add optional article AI analysis fields (from OVERNIGHT-FIX-SUMMARY.md)
-- These enable automatic entity/theme extraction but aren't required for basic functionality
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS entities JSONB DEFAULT '[]';
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS themes TEXT[] DEFAULT '{}';
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP;

-- Add indexes for article processing
CREATE INDEX IF NOT EXISTS idx_articles_processed ON reading_queue(processed) WHERE processed = false;

-- Verify all tables exist
SELECT 
  'All tables check:' as status,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'projects') THEN '✓' ELSE '✗' END as projects,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'memories') THEN '✓' ELSE '✗' END as memories,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'reading_queue') THEN '✓' ELSE '✗' END as reading_queue,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'article_highlights') THEN '✓' ELSE '✗' END as article_highlights,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'rss_feeds') THEN '✓' ELSE '✗' END as rss_feeds,
  CASE WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'connection_suggestions') THEN '✓' ELSE '✗' END as connection_suggestions;
