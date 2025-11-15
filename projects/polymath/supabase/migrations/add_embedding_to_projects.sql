-- Migration: Add embedding column to projects table
-- Description: Adds semantic embedding support for projects to enable similarity matching and semantic clustering
-- Created: 2025-01-09

-- Add embedding column for semantic search and clustering
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add index for vector similarity search (pgvector)
CREATE INDEX IF NOT EXISTS idx_projects_embedding ON projects
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment for documentation
COMMENT ON COLUMN projects.embedding IS 'Text embedding vector for semantic similarity search and clustering (768 dimensions from Gemini)';
