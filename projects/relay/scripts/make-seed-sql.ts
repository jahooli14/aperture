/**
 * Turns the transcribed story into paste-able SQL for the Supabase editor —
 * no terminal needed. Two files:
 *
 *   seed-pasco.sql   — inserts the story fresh. Does nothing if it's already
 *                       seeded (checked by line count).
 *   update-pasco-timestamps.sql
 *                    — corrects created_at on an already-seeded story to the
 *                       real per-line times below, matched by position. Run
 *                       this if you seeded before sentAt existed.
 *
 * Every line in pasco-story.ts carries a real sentAt, so both files use exact
 * timestamps rather than a spread guess.
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
    `    (${line.author === 'dan' ? 'dan_id' : 'ben_id'}, ${index + 1}, ${q(line.body)}, ${q(line.chapter ?? null)}, timestamptz ${q(line.sentAt)})`
).join(',\n')

const firstAt = PASCO_STORY[0].sentAt
const lastLine = PASCO_STORY[PASCO_STORY.length - 1]
const nextVar = lastLine.author === 'dan' ? 'ben_id' : 'dan_id'
const nextName = lastLine.author === 'dan' ? 'Ben' : 'Dan'

const seedSql = `-- Seed the existing Pasco story into Relay.
--
-- Paste this into the Supabase SQL editor and run it. No terminal needed.
--
-- Before you run it, both writers must have signed in to Relay at least once
-- (magic link) so their accounts exist — this looks them up by email.
--
-- Every line below carries the real time it was written, transcribed from
-- the original WhatsApp export and Signal screenshots.
--
-- Safe to run twice: if the story already has lines, it does nothing.

do $seed$
declare
  -- ================== EDIT THESE TWO LINES ==================
  dan_email text := 'you@example.com';
  ben_email text := 'ben@example.com';
  -- ============================================================

  dan_id     uuid;
  ben_id     uuid;
  story      uuid;
  have_lines int;
begin
  select id into dan_id from auth.users where lower(email) = lower(btrim(dan_email));
  select id into ben_id from auth.users where lower(email) = lower(btrim(ben_email));

  if dan_id is null then
    raise exception 'No account for %. Sign in to Relay with that address first.', dan_email;
  end if;
  if ben_id is null then
    raise exception 'No account for %. Get them to sign in to Relay first.', ben_email;
  end if;

  insert into relay.profiles (user_id, display_name) values
    (dan_id, 'Dan'), (ben_id, 'Ben')
    on conflict (user_id) do nothing;

  select id into story from relay.stories
    where title = ${q(PASCO_TITLE)} and created_by = dan_id;

  if story is null then
    insert into relay.stories (title, blurb, created_by, turn_mode, next_author_id, created_at)
      values (${q(PASCO_TITLE)}, ${q(PASCO_BLURB)}, dan_id, 'rotation', dan_id, ${q(firstAt)})
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
  select story, seed.author_id, seed.position, seed.body, seed.chapter_title, seed.sent_at
    from (values
${rows}
    ) as seed(author_id, position, body, chapter_title, sent_at);

  -- The insert trigger left the turn where the last line put it. The story
  -- alternates, so after ${lastLine.author === 'dan' ? 'Dan' : 'Ben'}'s line it is ${nextName}'s go.
  update relay.stories
     set next_author_id = ${nextVar},
         last_line_at   = ${q(lastLine.sentAt)}
   where id = story;

  raise notice 'Added % lines, % to %. It is ${nextName}''s turn.',
    ${PASCO_STORY.length}, ${q(firstAt.slice(0, 10))}, ${q(lastLine.sentAt.slice(0, 10))};
end $seed$;
`

const updateSql = `-- Corrects an already-seeded Pasco story's timestamps to the real ones.
--
-- Only needed if the story was seeded before every line had a real sentAt —
-- that seed spread the lines evenly across a guessed date range. This
-- matches each line by its position and sets created_at to when it was
-- genuinely written, then fixes the story and story_members rows to match.
--
-- Paste into the Supabase SQL editor and run it. Safe to run more than once.

do $fix$
declare
  dan_email text := 'you@example.com';
  ben_email text := 'ben@example.com';

  dan_id uuid;
  ben_id uuid;
  story  uuid;
  fixed  int;
begin
  select id into dan_id from auth.users where lower(email) = lower(btrim(dan_email));
  select id into ben_id from auth.users where lower(email) = lower(btrim(ben_email));

  if dan_id is null or ben_id is null then
    raise exception 'Could not find both accounts — check the emails above.';
  end if;

  select id into story from relay.stories
    where title = ${q(PASCO_TITLE)} and created_by = dan_id;

  if story is null then
    raise exception 'No "%" story found for that account. Run the seed first.', ${q(PASCO_TITLE)};
  end if;

  update relay.lines as l
     set created_at = seed.sent_at
    from (values
${rows}
    ) as seed(author_id, position, body, chapter_title, sent_at)
   where l.story_id = story
     and l.position = seed.position;
  get diagnostics fixed = row_count;

  update relay.stories
     set created_at   = ${q(firstAt)},
         last_line_at = ${q(lastLine.sentAt)}
   where id = story;

  raise notice 'Corrected % line timestamps, % to %.',
    fixed, ${q(firstAt.slice(0, 10))}, ${q(lastLine.sentAt.slice(0, 10))};
end $fix$;
`

writeFileSync(join(here, '..', 'supabase', 'seed-pasco.sql'), seedSql)
writeFileSync(join(here, '..', 'supabase', 'update-pasco-timestamps.sql'), updateSql)
console.log('wrote supabase/seed-pasco.sql')
console.log('wrote supabase/update-pasco-timestamps.sql')
