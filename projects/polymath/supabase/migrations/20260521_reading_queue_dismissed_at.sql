-- Migration: Add dismissed_at to reading_queue for the home Consuming widget
-- "New reads" surfaces RSS items the user hasn't touched. A dismissed item
-- should vanish from that surface without being deleted or archived (archive
-- is a "I read this" verb; dismiss is "not for me").
-- Created: 2026-05-21

ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Composite index supports the New reads query: same user, status=unread,
-- not dismissed, has rss tag. Partial index keeps it small.
CREATE INDEX IF NOT EXISTS idx_reading_queue_new_reads
  ON reading_queue(user_id, created_at DESC)
  WHERE status = 'unread' AND dismissed_at IS NULL;

COMMENT ON COLUMN reading_queue.dismissed_at IS 'Set when the user dismisses an RSS-surfaced item from the home Consuming widget. Hides the row from "New reads" without deleting it.';
