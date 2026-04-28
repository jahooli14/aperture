-- Noticings — the home "witness" surface.
--
-- A noticing is 2–3 short sentences that hold the user's through-line and
-- hand it back. Two shapes:
--   observation  — pure pattern recognition ("you keep returning to X")
--   commission   — names a project only the user could make
--
-- Every served noticing is recorded so refresh can dedupe and the saved view
-- can show a longitudinal thread.
create table if not exists noticings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lines text[] not null,
  shape text not null check (shape in ('observation', 'commission')),
  source_keys text[] not null default '{}',
  source_meta jsonb not null default '[]'::jsonb,
  saved boolean not null default false,
  served_at timestamptz not null default now(),
  saved_at timestamptz
);

create index if not exists noticings_user_served_idx
  on noticings (user_id, served_at desc);

create index if not exists noticings_user_saved_idx
  on noticings (user_id, saved, saved_at desc)
  where saved = true;

alter table noticings enable row level security;

drop policy if exists "noticings_owner_select" on noticings;
drop policy if exists "noticings_owner_insert" on noticings;
drop policy if exists "noticings_owner_update" on noticings;
drop policy if exists "noticings_owner_delete" on noticings;

create policy "noticings_owner_select" on noticings
  for select using (auth.uid() = user_id);
create policy "noticings_owner_insert" on noticings
  for insert with check (auth.uid() = user_id);
create policy "noticings_owner_update" on noticings
  for update using (auth.uid() = user_id);
create policy "noticings_owner_delete" on noticings
  for delete using (auth.uid() = user_id);

-- Historian sketch cache. One row per user. The Cartographer / Historian
-- builds a small structured identity sketch (recurring shapes, dormant
-- projects, returning people, life-stage facts) and refreshes it weekly.
-- The Noticer reads this without re-scanning everything.
create table if not exists noticing_sketches (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sketch jsonb not null,
  signal_count int not null default 0,
  generated_at timestamptz not null default now()
);

alter table noticing_sketches enable row level security;

drop policy if exists "noticing_sketches_owner" on noticing_sketches;
create policy "noticing_sketches_owner" on noticing_sketches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
