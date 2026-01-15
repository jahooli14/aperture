-- =============================================
-- ANALOGUE - Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- =============================================

-- 1. MANUSCRIPTS TABLE
create table public.manuscripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  protagonist_real_name text default '',
  mask_mode_enabled boolean default false,
  current_section text default 'departure',
  total_word_count integer default 0,
  alex_identity jsonb default '{"alPatterns":[],"lexiPatterns":[],"syncStatus":"synced","lastSyncCheck":null}'::jsonb,
  sensory_audit jsonb default '{
    "sight":{"activated":false,"activationSceneId":null,"strength":"weak","occurrences":0},
    "smell":{"activated":false,"activationSceneId":null,"strength":"weak","occurrences":0},
    "sound":{"activated":false,"activationSceneId":null,"strength":"weak","occurrences":0},
    "taste":{"activated":false,"activationSceneId":null,"strength":"weak","occurrences":0},
    "touch":{"activated":false,"activationSceneId":null,"strength":"weak","occurrences":0}
  }'::jsonb,
  reveal_audit_unlocked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. SCENE NODES TABLE
create table public.scene_nodes (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid references public.manuscripts(id) on delete cascade not null,
  order_index integer not null,
  title text not null,
  section text default 'departure',
  prose text default '',
  footnotes text default '',
  word_count integer default 0,
  identity_type text,
  sensory_focus text,
  awareness_level text,
  footnote_tone text,
  status text default 'draft',
  validation_status text default 'yellow',
  checklist jsonb default '[]'::jsonb,
  senses_activated text[] default '{}',
  pulse_check_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. REVERBERATIONS TABLE
create table public.reverberations (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid references public.manuscripts(id) on delete cascade not null,
  scene_id uuid not null,
  text text not null,
  speaker text not null,
  villager_name text,
  linked_reveal_scene_id uuid,
  created_at timestamptz default now()
);

-- 4. GLASSES MENTIONS TABLE
create table public.glasses_mentions (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid references public.manuscripts(id) on delete cascade not null,
  scene_id uuid not null,
  text text not null,
  is_valid_draw boolean default false,
  flagged boolean default false,
  created_at timestamptz default now()
);

-- 5. SPEECH PATTERNS TABLE
create table public.speech_patterns (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid references public.manuscripts(id) on delete cascade not null,
  phrase text not null,
  character_source text not null,
  occurrences jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Users can only access their own data
-- =============================================

-- Enable RLS on all tables
alter table public.manuscripts enable row level security;
alter table public.scene_nodes enable row level security;
alter table public.reverberations enable row level security;
alter table public.glasses_mentions enable row level security;
alter table public.speech_patterns enable row level security;

-- Manuscripts policies
create policy "Users can view own manuscripts"
  on public.manuscripts for select
  using (auth.uid() = user_id);

create policy "Users can insert own manuscripts"
  on public.manuscripts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own manuscripts"
  on public.manuscripts for update
  using (auth.uid() = user_id);

create policy "Users can delete own manuscripts"
  on public.manuscripts for delete
  using (auth.uid() = user_id);

-- Scene nodes policies (via manuscript ownership)
create policy "Users can view own scene nodes"
  on public.scene_nodes for select
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can insert own scene nodes"
  on public.scene_nodes for insert
  with check (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can update own scene nodes"
  on public.scene_nodes for update
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can delete own scene nodes"
  on public.scene_nodes for delete
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

-- Reverberations policies
create policy "Users can view own reverberations"
  on public.reverberations for select
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can insert own reverberations"
  on public.reverberations for insert
  with check (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can update own reverberations"
  on public.reverberations for update
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can delete own reverberations"
  on public.reverberations for delete
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

-- Glasses mentions policies
create policy "Users can view own glasses mentions"
  on public.glasses_mentions for select
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can insert own glasses mentions"
  on public.glasses_mentions for insert
  with check (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can update own glasses mentions"
  on public.glasses_mentions for update
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can delete own glasses mentions"
  on public.glasses_mentions for delete
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

-- Speech patterns policies
create policy "Users can view own speech patterns"
  on public.speech_patterns for select
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can insert own speech patterns"
  on public.speech_patterns for insert
  with check (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can update own speech patterns"
  on public.speech_patterns for update
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

create policy "Users can delete own speech patterns"
  on public.speech_patterns for delete
  using (manuscript_id in (select id from public.manuscripts where user_id = auth.uid()));

-- =============================================
-- INDEXES for performance
-- =============================================

create index idx_manuscripts_user_id on public.manuscripts(user_id);
create index idx_manuscripts_updated_at on public.manuscripts(updated_at desc);
create index idx_scene_nodes_manuscript_id on public.scene_nodes(manuscript_id);
create index idx_scene_nodes_order on public.scene_nodes(manuscript_id, order_index);
create index idx_reverberations_manuscript_id on public.reverberations(manuscript_id);
create index idx_glasses_mentions_manuscript_id on public.glasses_mentions(manuscript_id);
create index idx_speech_patterns_manuscript_id on public.speech_patterns(manuscript_id);

-- =============================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- =============================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger manuscripts_updated_at
  before update on public.manuscripts
  for each row execute function public.handle_updated_at();

create trigger scene_nodes_updated_at
  before update on public.scene_nodes
  for each row execute function public.handle_updated_at();
