-- Add embedding column to list_items for semantic connections
-- This enables list items (films, books, etc.) to connect to projects and thoughts

ALTER TABLE public.list_items
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_list_items_embedding
ON public.list_items
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add comment explaining the purpose
COMMENT ON COLUMN public.list_items.embedding IS 'Gemini text-embedding-004 vector for semantic search and project matching';
