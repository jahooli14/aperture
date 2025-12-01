-- Create table for AI-suggested next steps
create table if not exists public.project_next_steps (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  suggested_task text not null,
  reasoning text,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'dismissed')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index for faster lookups
create index if not exists project_next_steps_project_id_idx on public.project_next_steps(project_id);
create index if not exists project_next_steps_user_id_idx on public.project_next_steps(user_id);

-- Enable RLS
alter table public.project_next_steps enable row level security;

-- Policies
create policy "Users can view their own next steps"
  on public.project_next_steps for select
  using (auth.uid() = user_id);

create policy "Users can insert their own next steps"
  on public.project_next_steps for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own next steps"
  on public.project_next_steps for update
  using (auth.uid() = user_id);

create policy "Users can delete their own next steps"
  on public.project_next_steps for delete
  using (auth.uid() = user_id);
