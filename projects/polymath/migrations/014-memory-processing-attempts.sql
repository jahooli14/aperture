-- Track processing attempts on memories so a permanently-broken memory
-- (bad transcript, stale model output) doesn't keep retrying on every cron run
-- and burning Gemini quota. The retry cron already picks up processed=false
-- rows; processMemory now increments process_attempts and skips once the cap
-- is reached.

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS process_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP WITH TIME ZONE;

-- Speed up the retry cron: it selects processed=false ordered by created_at,
-- usually filtered by last_attempt_at (to skip rows that just failed).
CREATE INDEX IF NOT EXISTS idx_memories_pending_process
  ON memories (created_at)
  WHERE processed = FALSE;
