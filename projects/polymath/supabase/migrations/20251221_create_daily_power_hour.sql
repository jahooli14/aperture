
create table if not exists daily_power_hour (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  tasks jsonb not null,
  created_at timestamptz default now()
);

-- Index for fast lookup by user and date (finding the latest one)
create index if not exists daily_power_hour_user_date_idx on daily_power_hour (user_id, created_at desc);

-- RLS Policies
alter table daily_power_hour enable row level security;

create policy "Users can view their own power hour plans"
  on daily_power_hour for select
  using (auth.uid() = user_id);

create policy "Users can insert their own power hour plans"
  on daily_power_hour for insert
  with check (auth.uid() = user_id);
