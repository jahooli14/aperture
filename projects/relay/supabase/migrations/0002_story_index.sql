-- The story index: who appears, where things happen, what keeps coming back.
--
-- Cached per story so opening the sheet is instant and the model is only
-- called when someone asks for it. `up_to_position` records how far the story
-- had got when it was built, which is how the UI knows it has gone stale.

create table if not exists relay.story_index (
  story_id        uuid primary key references relay.stories(id) on delete cascade,
  up_to_position  int not null default 0,
  payload         jsonb not null,
  built_by        uuid references auth.users(id) on delete set null,
  generated_at    timestamptz not null default now()
);

alter table relay.story_index enable row level security;

drop policy if exists story_index_read on relay.story_index;
create policy story_index_read on relay.story_index for select to authenticated
  using (relay.is_member(story_id));

grant select on relay.story_index to authenticated;
grant all on relay.story_index to service_role;
