-- Project Ideas — Read mode.
--
-- Adds a longitudinal "pattern read" alongside the locked-pairs crossover
-- generator. The Read mode looks at the user's whole creative life — every
-- project state, voice notes back ~24 months, lists with reactions, reading
-- + highlights, prior idea outcomes — and names the through-line nobody
-- (including the user) has said out loud. Then names the project that
-- breaks it.
--
-- Schema delta:
--   mode    — 'crossover' | 'read'. Default 'crossover' so existing rows
--             behave as before. The UI uses this to switch render modes:
--             Read leads with the pattern; crossover leads with the title.
--   pattern — the through-line sentence for Read rows. NULL on crossover
--             rows. The UI renders this as a leading hero block when set.

alter table project_ideas
  add column if not exists mode text not null default 'crossover'
    check (mode in ('crossover', 'read')),
  add column if not exists pattern text;

create index if not exists project_ideas_user_mode_idx
  on project_ideas (user_id, mode, generated_at desc);
