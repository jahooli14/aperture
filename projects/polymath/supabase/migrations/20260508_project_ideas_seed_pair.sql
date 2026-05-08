-- Project Ideas — seed pair persistence.
--
-- Adds a record of which (centre × arrival) pair drove each generated idea.
-- The picker chooses pairs deterministically in code; the LLM only writes
-- them up. Persisting the pair lets the next batch enforce a cooldown so
-- the same convergence can't fire again for several weeks — the fix for
-- "two runs gave the same idea in different wording."
--
-- Shape: { centre_id, centre_kind, arrival_id, arrival_kind }
--   centre_kind  ∈ 'project_dormant' | 'project_active' | 'memory'
--   arrival_kind ∈ 'memory' | 'reading' | 'highlight' | 'todo'
-- Older rows generated before this column existed have seed_pair = NULL
-- and are simply ignored by the cooldown filter.

alter table project_ideas
  add column if not exists seed_pair jsonb;

create index if not exists project_ideas_seed_pair_idx
  on project_ideas ((seed_pair ->> 'centre_id'), (seed_pair ->> 'arrival_id'))
  where seed_pair is not null;
