-- Migration: Fix entities table foreign key constraint
-- This adds the missing foreign key relationship between entities and memories

-- STEP 1: Clean up orphaned entities (entities pointing to non-existent memories)
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  -- Count orphaned entities first
  SELECT COUNT(*) INTO orphaned_count
  FROM entities e
  WHERE NOT EXISTS (
    SELECT 1 FROM memories m WHERE m.id = e.memory_id
  );

  RAISE NOTICE 'Found % orphaned entities to clean up', orphaned_count;

  -- Delete orphaned entities
  DELETE FROM entities e
  WHERE NOT EXISTS (
    SELECT 1 FROM memories m WHERE m.id = e.memory_id
  );

  RAISE NOTICE 'Deleted % orphaned entities', orphaned_count;
END $$;

-- STEP 2: Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entities_memory_id_fkey'
    AND table_name = 'entities'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE entities
    ADD CONSTRAINT entities_memory_id_fkey
    FOREIGN KEY (memory_id)
    REFERENCES memories(id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Foreign key constraint added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists';
  END IF;
END $$;

-- Create index on memory_id if it doesn't exist (improves join performance)
CREATE INDEX IF NOT EXISTS idx_entities_memory_id ON entities(memory_id);

-- Verify the constraint was added
DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'entities_memory_id_fkey'
    AND table_name = 'entities'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    RAISE NOTICE '✓ Foreign key constraint verified';
  ELSE
    RAISE WARNING '✗ Foreign key constraint not found';
  END IF;
END $$;
