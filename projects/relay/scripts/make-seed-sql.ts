/**
 * Turns the transcribed story into one SQL file you can paste into the
 * Supabase SQL editor, so seeding the existing thread needs no terminal.
 *
 * Regenerate with: npx tsx scripts/make-seed-sql.ts
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PASCO_BLURB, PASCO_STORY, PASCO_TITLE } from './pasco-story.js'

const here = dirname(fileURLToPath(import.meta.url))

// Dollar quoting, so none of the apostrophes in the prose need escaping.
const q = (value: string | null) => (value === null ? 'null' : `$ln$${value}$ln$`)

const rows = PASCO_STORY.map(
  (line, index) =>
    `    (${line.author === 'dan' ? 'dan_id' : 'ben_id'}, ${index + 1}, ${q(line.body)}, ${q(line.chapter ?? null)})`
).join(',\n')

const lastAuthor = PASCO_STORY[PASCO_STORY.length - 1].author
const nextVar = lastAuthor === 'dan' ? 'ben_id' : 'dan_id'
const nextName = lastAuthor === 'dan' ? 'Ben' : 'Dan'

const sql = `-- Seed the existing Pasco story into Relay.
--
-- Paste this into the Supabase SQL editor and run it. No terminal needed.
--
-- Before you run it, both writers must have signed in to Relay at least once
-- (magic link) so their accounts exist — this looks them up by email.
--
-- Safe to run twice: if the story already has lines, it does nothing.

do $seed$
declare
  -- ================== EDIT THESE THREE LINES ==================
  dan_email text := 'you@example.com';
  ben_email text := 'ben@example.com';
  -- Roughly when you started the thread, so "the story so far" isn't all
  -- stamped today. Line times are spread evenly from then until now.
  -- Leave as null to stamp every line with the time you run this.
  began_on  date := null;
  -- ============================================================

  dan_id     uuid;
  ben_id     uuid;
  story      uuid;
  have_lines int;
  total      int := ${PASCO_STORY.length};
  first_at   timestamptz;
  step       interval;
begin
  select id into dan_id from auth.users where lower(email) = lower(btrim(dan_email));
  select id into ben_id from auth.users where lower(email) = lower(btrim(ben_email));

  if dan_id is null then
    raise exception 'No account for %. Sign in to Relay with that address first.', dan_email;
  end if;
  if ben_id is null then
    raise exception 'No account for %. Get them to sign in to Relay first.', ben_email;
  end if;

  first_at := coalesce(began_on + time '19:00', now());
  step := (now() - first_at) / greatest(total - 1, 1);

  insert into relay.profiles (user_id, display_name) values
    (dan_id, 'Dan'), (ben_id, 'Ben')
    on conflict (user_id) do nothing;

  select id into story from relay.stories
    where title = ${q(PASCO_TITLE)} and created_by = dan_id;

  if story is null then
    insert into relay.stories (title, blurb, created_by, turn_mode, next_author_id, created_at)
      values (${q(PASCO_TITLE)}, ${q(PASCO_BLURB)}, dan_id, 'rotation', dan_id, first_at)
      returning id into story;
    raise notice 'Created the story.';
  end if;

  insert into relay.story_members (story_id, user_id, role, turn_order) values
    (story, dan_id, 'owner', 0), (story, ben_id, 'writer', 1)
    on conflict (story_id, user_id) do nothing;

  select count(*) into have_lines from relay.lines where story_id = story;
  if have_lines > 0 then
    raise notice 'Story already has % lines — nothing to add.', have_lines;
    return;
  end if;

  insert into relay.lines (story_id, author_id, position, body, chapter_title, created_at)
  select story, seed.author_id, seed.position, seed.body, seed.chapter_title,
         first_at + step * (seed.position - 1)
    from (values
${rows}
    ) as seed(author_id, position, body, chapter_title);

  -- The insert trigger left the turn where the last line put it. The story
  -- alternates, so after ${lastAuthor === 'dan' ? 'Dan' : 'Ben'}'s line it is ${nextName}'s go.
  update relay.stories
     set next_author_id = ${nextVar},
         last_line_at   = (select max(created_at) from relay.lines where story_id = story),
         created_at     = first_at
   where id = story;

  raise notice 'Added % lines. It is ${nextName}''s turn.', total;
end $seed$;
`

writeFileSync(join(here, '..', 'supabase', 'seed-pasco.sql'), sql)
console.log('wrote supabase/seed-pasco.sql')
