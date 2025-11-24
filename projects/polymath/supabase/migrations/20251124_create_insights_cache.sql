create table if not exists insights_cache (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  resource_type text not null, -- 'evolution', 'patterns', etc.
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  
  unique(user_id, resource_type)
);

-- Add RLS policies
alter table insights_cache enable row level security;

create policy "Users can view their own insights cache"
  on insights_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert their own insights cache"
  on insights_cache for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own insights cache"
  on insights_cache for update
  using (auth.uid() = user_id);
