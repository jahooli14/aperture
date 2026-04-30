-- Project Ideas — the home headline surface.
--
-- A weekly batch of 3 ranked project ideas synthesised from everything the
-- user has captured: voice notes, list items across every list type, active
-- and dormant projects, reading-queue highlights, todos, prior idea-engine
-- output, weekly intersections. The point of this surface is to surface
-- thoughts the user might not have had themselves, and especially projects
-- only they could uniquely make.
--
-- Generation runs on a Sunday cron (long-running, 60s) so the homepage GET
-- is just a fast DB read — that solves the timeout problem the noticing
-- pipeline ran into. The user can also manually trigger a fresh batch.
--
-- status flow:
--   pending     — generated, not yet seen / acted on
--   saved       — user kept this idea on the radar
--   rejected    — user said "not for me" (feedback the next batch)
--   built       — user shaped it into a real project
--   superseded  — pre-empted by a fresher batch before the user acted on
--                 it. distinct from "rejected" so the next prompt doesn't
--                 see a never-seen idea as "they hated this".
create table if not exists project_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  rank int not null,
  title text not null,
  pitch text not null,
  why_now text not null,
  next_step text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'saved', 'rejected', 'built', 'superseded')),
  user_feedback text,
  generated_at timestamptz not null default now(),
  acted_on_at timestamptz
);

create index if not exists project_ideas_user_generated_idx
  on project_ideas (user_id, generated_at desc, rank);

create index if not exists project_ideas_user_status_idx
  on project_ideas (user_id, status);

create index if not exists project_ideas_batch_idx
  on project_ideas (batch_id);

alter table project_ideas enable row level security;

drop policy if exists "project_ideas_owner_select" on project_ideas;
drop policy if exists "project_ideas_owner_insert" on project_ideas;
drop policy if exists "project_ideas_owner_update" on project_ideas;
drop policy if exists "project_ideas_owner_delete" on project_ideas;

create policy "project_ideas_owner_select" on project_ideas
  for select using (auth.uid() = user_id);
create policy "project_ideas_owner_insert" on project_ideas
  for insert with check (auth.uid() = user_id);
create policy "project_ideas_owner_update" on project_ideas
  for update using (auth.uid() = user_id);
create policy "project_ideas_owner_delete" on project_ideas
  for delete using (auth.uid() = user_id);
