-- Fix RSS Feeds Foreign Key Constraint
-- The user_id references auth.users but we're using a hardcoded UUID
-- Remove the FK constraint to match how projects table works

-- Drop the foreign key constraint
ALTER TABLE rss_feeds DROP CONSTRAINT IF EXISTS rss_feeds_user_id_fkey;

-- Modify user_id to be just UUID NOT NULL (no FK)
ALTER TABLE rss_feeds ALTER COLUMN user_id SET NOT NULL;

-- Update RLS policies to allow service role
DROP POLICY IF EXISTS "Users can insert their own feeds" ON rss_feeds;

CREATE POLICY "Service role can insert feeds"
  ON rss_feeds FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can insert feeds (no auth check)"
  ON rss_feeds FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE rss_feeds IS 'RSS feed subscriptions - FK constraint removed for single-user mode';
