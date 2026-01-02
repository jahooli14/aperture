-- ============================================================================
-- ADD user_id COLUMN TO memories TABLE
-- Fixes PGRST204 error: "Could not find the 'user_id' column of 'memories'"
-- ============================================================================

-- Add user_id column to memories table
-- Make it nullable since existing rows won't have a user_id
ALTER TABLE memories ADD COLUMN IF NOT EXISTS user_id UUID;

-- Create index for user_id queries
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);

-- Optionally: Update existing rows to have a default user_id (if needed)
-- Uncomment and set the correct UUID if you want to assign existing memories to a specific user
-- UPDATE memories SET user_id = 'your-user-uuid-here' WHERE user_id IS NULL;

-- Verify the column was added
DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'memories'
    AND column_name = 'user_id'
  ) INTO column_exists;

  IF column_exists THEN
    RAISE NOTICE 'user_id column successfully added to memories table';
  ELSE
    RAISE WARNING 'user_id column was NOT added to memories table';
  END IF;
END $$;
