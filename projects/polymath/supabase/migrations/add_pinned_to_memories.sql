-- Add pinned column to memories for quick-access thoughts
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Partial index for efficient pinned lookups
CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories (user_id, is_pinned) WHERE is_pinned = true;
