-- MemoryOS Database Schema

-- Enable vector extension for embeddings
create extension if not exists vector;

-- Memories table
create table memories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Raw data from Audiopen
  audiopen_id text unique not null,
  title text not null,
  body text not null,
  orig_transcript text,
  tags text[], -- Audiopen comma-separated tags as array
  audiopen_created_at timestamptz not null,

  -- AI-extracted metadata
  memory_type text check (memory_type in ('foundational', 'event', 'insight')),
  entities jsonb, -- {people: [], places: [], topics: []}
  themes text[],
  emotional_tone text,

  -- Vector search
  embedding vector(768), -- Gemini text-embedding-004 dimension

  -- Processing status
  processed boolean default false,
  processed_at timestamptz,
  error text
);

-- Bridges table (connections between memories)
create table bridges (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  memory_a uuid references memories(id) on delete cascade,
  memory_b uuid references memories(id) on delete cascade,

  bridge_type text not null check (bridge_type in ('entity_match', 'semantic_similarity', 'temporal_proximity')),
  strength float not null check (strength >= 0 and strength <= 1), -- 0-1 similarity score

  entities_shared text[], -- Shared entities if bridge_type = 'entity_match'

  -- Prevent duplicate bridges
  unique(memory_a, memory_b)
);

-- Indexes for performance
create index memories_created_at_idx on memories(created_at desc);
create index memories_processed_idx on memories(processed) where not processed;
create index memories_type_idx on memories(memory_type);
create index memories_embedding_idx on memories using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index memories_entities_idx on memories using gin (entities);

create index bridges_memory_a_idx on bridges(memory_a);
create index bridges_memory_b_idx on bridges(memory_b);
create index bridges_strength_idx on bridges(strength desc);

-- RLS policies (adjust based on auth setup)
alter table memories enable row level security;
alter table bridges enable row level security;

-- For now, allow all operations (single user MVP)
create policy "Allow all operations on memories" on memories for all using (true);
create policy "Allow all operations on bridges" on bridges for all using (true);
