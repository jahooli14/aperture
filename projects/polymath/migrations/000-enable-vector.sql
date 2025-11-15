-- Enable pgvector extension
-- Run this FIRST before any other migrations

-- Enable the vector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify it's installed
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If successful, you should see output showing the vector extension is installed
-- Now you can proceed with other migrations that use the VECTOR type
