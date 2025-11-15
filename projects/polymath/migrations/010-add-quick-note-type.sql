-- Add 'quick-note' to memory_type enum
-- Quick notes are lightweight thoughts without AI processing

-- Drop existing constraint
ALTER TABLE memories
DROP CONSTRAINT IF EXISTS memories_memory_type_check;

-- Add new constraint with quick-note
ALTER TABLE memories
ADD CONSTRAINT memories_memory_type_check
CHECK (memory_type IN ('foundational', 'event', 'insight', 'quick-note'));

-- Comment on the new type
COMMENT ON CONSTRAINT memories_memory_type_check ON memories IS
'Memory types: foundational (core identity), event (temporal), insight (reflection), quick-note (lightweight, no AI processing)';
