-- Create vector search functions for semantic similarity matching
-- These functions enable efficient semantic search across different content types

-- Match similar memory responses by embedding (for onboarding/prompts)
CREATE OR REPLACE FUNCTION match_memory_responses (
  query_embedding vector(768),
  filter_user_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  prompt_id uuid,
  custom_title text,
  bullets text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mr.id,
    mr.prompt_id,
    mr.custom_title,
    mr.bullets,
    1 - (mr.embedding <=> query_embedding) as similarity
  FROM memory_responses mr
  WHERE
    mr.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR mr.user_id = filter_user_id)
    AND 1 - (mr.embedding <=> query_embedding) > match_threshold
  ORDER BY mr.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_memory_responses IS 'Find semantically similar memory responses using cosine similarity on embeddings';

-- Match similar projects by embedding
CREATE OR REPLACE FUNCTION match_projects (
  query_embedding vector(768),
  filter_user_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.description,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM projects p
  WHERE
    p.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR p.user_id = filter_user_id)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_projects IS 'Find semantically similar projects using cosine similarity on embeddings';

-- Match similar reading queue items by embedding
CREATE OR REPLACE FUNCTION match_reading (
  query_embedding vector(768),
  filter_user_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  excerpt text,
  url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.excerpt,
    r.url,
    1 - (r.embedding <=> query_embedding) as similarity
  FROM reading_queue r
  WHERE
    r.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR r.user_id = filter_user_id)
    AND 1 - (r.embedding <=> query_embedding) > match_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_reading IS 'Find semantically similar reading queue items using cosine similarity on embeddings';

-- Match similar list items by embedding
CREATE OR REPLACE FUNCTION match_list_items (
  query_embedding vector(768),
  filter_user_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  list_id uuid,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.content,
    l.list_id,
    l.metadata,
    1 - (l.embedding <=> query_embedding) as similarity
  FROM list_items l
  WHERE
    l.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR l.user_id = filter_user_id)
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_list_items IS 'Find semantically similar list items using cosine similarity on embeddings';

-- Update match_memories to include user filter
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(768),
  filter_user_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  body text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.title,
    m.body,
    1 - (m.embedding <=> query_embedding) as similarity
  FROM memories m
  WHERE
    m.embedding IS NOT NULL
    AND (filter_user_id IS NULL OR m.user_id = filter_user_id)
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_memories IS 'Find semantically similar memories using cosine similarity on embeddings (updated with user filter)';
