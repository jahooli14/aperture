-- Additional SQL functions for MemoryOS

-- Vector similarity search function
create or replace function match_memories(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  body text,
  memory_type text,
  entities jsonb,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    memories.id,
    memories.title,
    memories.body,
    memories.memory_type,
    memories.entities,
    memories.created_at,
    1 - (memories.embedding <=> query_embedding) as similarity
  from memories
  where memories.embedding is not null
    and memories.processed = true
    and 1 - (memories.embedding <=> query_embedding) > match_threshold
  order by memories.embedding <=> query_embedding
  limit match_count;
$$;
