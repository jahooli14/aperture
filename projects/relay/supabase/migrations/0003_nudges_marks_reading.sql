-- Keeping a story alive, and the small things around reading it.
--
--   last_nudge_at      — so a reminder is sent once, not every day
--   edited_at          — a short window to fix a typo you spotted on send
--   last_read_position — where you got to, kept server-side so it follows you
--                        between phone and laptop
--   line_marks         — one tap to say "that one's good", deliberately not a
--                        conversation

alter table relay.stories        add column if not exists last_nudge_at timestamptz;
alter table relay.lines          add column if not exists edited_at timestamptz;
alter table relay.story_members  add column if not exists last_read_position int not null default 0;

create table if not exists relay.line_marks (
  line_id    uuid not null references relay.lines(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (line_id, user_id)
);

create index if not exists line_marks_line_idx on relay.line_marks (line_id);

alter table relay.line_marks enable row level security;

drop policy if exists line_marks_read on relay.line_marks;
create policy line_marks_read on relay.line_marks for select to authenticated
  using (
    exists (
      select 1 from relay.lines l
       where l.id = line_id and relay.is_member(l.story_id)
    )
  );

grant select on relay.line_marks to authenticated;
grant all on relay.line_marks to service_role;

-- Stories waiting on someone, ordered by how long they have been waiting.
-- The cron reads this rather than assembling it in TypeScript, so "whose turn
-- is it and how stale is it" stays one answer from one place.
create or replace view relay.stale_turns as
  select
    s.id            as story_id,
    s.title,
    s.next_author_id,
    s.last_line_at,
    s.last_nudge_at,
    extract(epoch from (now() - coalesce(s.last_line_at, s.created_at))) / 86400 as days_waiting
  from relay.stories s
  where s.status = 'active'
    and s.next_author_id is not null
    and (select count(*) from relay.story_members m where m.story_id = s.id) > 1;

grant select on relay.stale_turns to service_role;
