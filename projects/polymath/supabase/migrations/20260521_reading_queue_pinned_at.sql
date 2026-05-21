-- Migration: Add pinned_at to reading_queue for Saved reads pinning
-- Pinned items float to the top of the Saved reads dropdown in the home
-- Consuming widget. Symmetric with dismissed_at / archived_at — a
-- timestamp column rather than a boolean lets us sort "recently pinned"
-- first if more than one item is pinned.
-- Created: 2026-05-21

ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reading_queue_pinned
  ON reading_queue(user_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

COMMENT ON COLUMN reading_queue.pinned_at IS 'Set when the user pins an article to the top of Saved reads. NULL means unpinned.';
