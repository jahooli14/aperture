-- Create function to find semantically similar memories using vector embeddings
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(768),
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
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION match_memories IS 'Find semantically similar memories using cosine similarity on embeddings';
