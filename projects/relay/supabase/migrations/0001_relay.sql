-- Relay — collaborative line-by-line stories.
--
-- Lives in its own `relay` schema so it can share a Supabase project with
-- another Aperture app without colliding with it. After running this,
-- add `relay` to Settings -> API -> Exposed schemas in the Supabase
-- dashboard, or PostgREST (and so supabase-js) won't see these tables.

create schema if not exists relay;

grant usage on schema relay to anon, authenticated, service_role;

do $$ begin
  create type relay.turn_mode as enum ('rotation', 'open');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relay.story_status as enum ('active', 'finished', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type relay.member_role as enum ('owner', 'writer');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- tables

create table if not exists relay.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists relay.stories (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(btrim(title)) between 1 and 120),
  blurb          text check (char_length(blurb) <= 400),
  created_by     uuid not null references auth.users(id) on delete cascade,
  -- 'rotation' = strict queue (what two people want). 'open' = anyone but
  -- whoever wrote the last line, which stops a group of ten stalling on
  -- one person's holiday.
  turn_mode      relay.turn_mode not null default 'rotation',
  next_author_id uuid references auth.users(id) on delete set null,
  status         relay.story_status not null default 'active',
  max_members    smallint not null default 10 check (max_members between 2 and 10),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  last_line_at   timestamptz
);

create table if not exists relay.story_members (
  story_id   uuid not null references relay.stories(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       relay.member_role not null default 'writer',
  turn_order int not null,
  notify     boolean not null default true,
  joined_at  timestamptz not null default now(),
  primary key (story_id, user_id)
);

create unique index if not exists story_members_turn_order_idx
  on relay.story_members (story_id, turn_order);

create table if not exists relay.lines (
  id            uuid primary key default gen_random_uuid(),
  story_id      uuid not null references relay.stories(id) on delete cascade,
  author_id     uuid not null references auth.users(id) on delete cascade,
  position      int not null,
  body          text not null check (char_length(btrim(body)) between 1 and 2000),
  -- Set when this line opens a new chapter. The story already does this
  -- naturally ("Chapter 2.", "III: When in Rome") — this just makes it
  -- navigable instead of buried in the prose.
  chapter_title text check (char_length(chapter_title) <= 120),
  created_at    timestamptz not null default now()
);

create unique index if not exists lines_story_position_idx on relay.lines (story_id, position);
create index if not exists lines_story_created_idx on relay.lines (story_id, created_at);

create table if not exists relay.invites (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references relay.stories(id) on delete cascade,
  code       text not null unique check (char_length(code) between 6 and 32),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  max_uses   smallint not null default 1 check (max_uses between 1 and 10),
  uses       smallint not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists relay.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on relay.push_subscriptions (user_id);

-- ------------------------------------------------------------- triggers

-- Members and lines both get their ordinal assigned server-side so two
-- people posting at the same moment can't land on the same number. The
-- unique indexes above are the backstop; the API retries on conflict.

create or replace function relay.assign_turn_order() returns trigger
language plpgsql as $$
begin
  if new.turn_order is null then
    select coalesce(max(turn_order), -1) + 1 into new.turn_order
      from relay.story_members where story_id = new.story_id;
  end if;
  return new;
end $$;

drop trigger if exists assign_turn_order on relay.story_members;
create trigger assign_turn_order before insert on relay.story_members
  for each row execute function relay.assign_turn_order();

create or replace function relay.enforce_member_cap() returns trigger
language plpgsql as $$
declare
  cap smallint;
  current_count int;
begin
  select max_members into cap from relay.stories where id = new.story_id;
  select count(*) into current_count from relay.story_members where story_id = new.story_id;
  if current_count >= cap then
    raise exception 'Story is full (% of % writers)', current_count, cap
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists enforce_member_cap on relay.story_members;
create trigger enforce_member_cap before insert on relay.story_members
  for each row execute function relay.enforce_member_cap();

create or replace function relay.assign_line_position() returns trigger
language plpgsql as $$
begin
  if new.position is null then
    select coalesce(max(position), 0) + 1 into new.position
      from relay.lines where story_id = new.story_id;
  end if;
  return new;
end $$;

drop trigger if exists assign_line_position on relay.lines;
create trigger assign_line_position before insert on relay.lines
  for each row execute function relay.assign_line_position();

-- Whose turn it is, is the whole app — so it's resolved in the same
-- transaction as the line that changes it, never recomputed in the client.
create or replace function relay.advance_turn() returns trigger
language plpgsql security definer set search_path = relay, public as $$
declare
  mode relay.turn_mode;
  author_order int;
  nxt uuid;
begin
  select turn_mode into mode from relay.stories where id = new.story_id;

  if mode = 'rotation' then
    select turn_order into author_order from relay.story_members
      where story_id = new.story_id and user_id = new.author_id;

    select user_id into nxt from relay.story_members
      where story_id = new.story_id
        and turn_order > coalesce(author_order, -1)
      order by turn_order limit 1;

    if nxt is null then  -- wrap to the top of the rotation
      select user_id into nxt from relay.story_members
        where story_id = new.story_id order by turn_order limit 1;
    end if;
  else
    nxt := null;  -- open mode: anyone except the last writer
  end if;

  update relay.stories
     set next_author_id = nxt,
         last_line_at   = new.created_at,
         updated_at     = now()
   where id = new.story_id;

  return new;
end $$;

drop trigger if exists advance_turn on relay.lines;
create trigger advance_turn after insert on relay.lines
  for each row execute function relay.advance_turn();

-- ------------------------------------------------------------------ RLS
--
-- Writes all go through the Vercel API on the service-role key, which
-- bypasses RLS. These policies are the safety net for anything that ever
-- touches the tables with the anon key — including Realtime, which is how
-- the client learns a new line landed.

create or replace function relay.is_member(target_story uuid) returns boolean
language sql security definer stable set search_path = relay, public as $$
  select exists (
    select 1 from relay.story_members
     where story_id = target_story and user_id = auth.uid()
  );
$$;

alter table relay.profiles           enable row level security;
alter table relay.stories            enable row level security;
alter table relay.story_members      enable row level security;
alter table relay.lines              enable row level security;
alter table relay.invites            enable row level security;
alter table relay.push_subscriptions enable row level security;

drop policy if exists profiles_read on relay.profiles;
create policy profiles_read on relay.profiles for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from relay.story_members mine
       join relay.story_members theirs on theirs.story_id = mine.story_id
      where mine.user_id = auth.uid() and theirs.user_id = relay.profiles.user_id
    )
  );

drop policy if exists profiles_write_own on relay.profiles;
create policy profiles_write_own on relay.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists stories_read on relay.stories;
create policy stories_read on relay.stories for select to authenticated
  using (relay.is_member(id));

drop policy if exists members_read on relay.story_members;
create policy members_read on relay.story_members for select to authenticated
  using (relay.is_member(story_id));

drop policy if exists lines_read on relay.lines;
create policy lines_read on relay.lines for select to authenticated
  using (relay.is_member(story_id));

drop policy if exists invites_read on relay.invites;
create policy invites_read on relay.invites for select to authenticated
  using (relay.is_member(story_id));

drop policy if exists push_own on relay.push_subscriptions;
create policy push_own on relay.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on all tables in schema relay to authenticated;
grant all on all tables in schema relay to service_role;
grant execute on all functions in schema relay to authenticated, service_role;

-- Realtime: the client subscribes to new lines so Ben's line appears
-- without a refresh. RLS above still decides what it may see.
do $$ begin
  alter publication supabase_realtime add table relay.lines;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------ join by code
--
-- Redeeming an invite has to be atomic: two people opening the same link at
-- once must not both spend the last use, and neither may push the story past
-- its member cap. One locked function does the lot.

create or replace function relay.redeem_invite(invite_code text, joiner uuid)
returns uuid
language plpgsql security definer set search_path = relay, public as $$
declare
  inv relay.invites;
begin
  select * into inv from relay.invites
    where code = upper(btrim(invite_code)) for update;

  if not found then
    raise exception 'That code is not valid' using errcode = 'no_data_found';
  end if;
  if inv.revoked_at is not null then
    raise exception 'That invite has been cancelled' using errcode = 'check_violation';
  end if;
  if inv.expires_at < now() then
    raise exception 'That invite has expired' using errcode = 'check_violation';
  end if;

  -- Already in? Send them to the story rather than spending a use.
  if exists (
    select 1 from relay.story_members where story_id = inv.story_id and user_id = joiner
  ) then
    return inv.story_id;
  end if;

  if inv.uses >= inv.max_uses then
    raise exception 'That invite has already been used' using errcode = 'check_violation';
  end if;

  insert into relay.story_members (story_id, user_id) values (inv.story_id, joiner);
  update relay.invites set uses = uses + 1 where id = inv.id;

  return inv.story_id;
end $$;

grant execute on function relay.redeem_invite(text, uuid) to service_role;
