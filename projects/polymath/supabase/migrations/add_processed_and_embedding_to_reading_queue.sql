-- Migration: Add processed and embedding columns to reading_queue
-- Description: Adds tracking for background processing and semantic search
-- Created: 2025-11-05

-- Add processed column to track background article extraction status
ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE;

-- Add embedding column for semantic search and auto-connections
ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add index for vector similarity search (pgvector)
CREATE INDEX IF NOT EXISTS idx_reading_queue_embedding ON reading_queue
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment for documentation
COMMENT ON COLUMN reading_queue.processed IS 'Indicates if article content has been extracted and processed';
COMMENT ON COLUMN reading_queue.embedding IS 'Text embedding vector for semantic similarity search (768 dimensions from Gemini)';
