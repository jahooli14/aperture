-- 015-add-memories-triage.sql
--
-- The memories.triage column is read/written by process-memory.ts (writes
-- it on every capture), synthesis.ts and cognitive-replay.ts (read it),
-- and was read by the idea generator's gather step. No prior migration
-- ever created it. On any database where it's missing, PostgREST fails
-- the WHOLE query that selects it — which silently starved the idea
-- generator (zero voice notes reached it, mem=0) and likely degrades
-- synthesis / cognitive-replay too.
--
-- triage is a JSONB blob: { category, project_id, bridge_insight, ... }.
-- This migration is idempotent and safe to run whether or not the column
-- already exists (e.g. if it was added by hand in the Supabase dashboard
-- in some environments but not others).

ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS triage JSONB;

-- synthesis.ts filters on triage->>'category' (e.g. 'new_project_idea').
-- A functional index keeps that lookup cheap as the table grows.
CREATE INDEX IF NOT EXISTS idx_memories_triage_category
  ON memories ((triage->>'category'));

-- Supabase/PostgREST caches the schema. After a DDL change the new column
-- is invisible to the REST API until the cache reloads — this avoids
-- having to restart the project or wait for the periodic refresh.
NOTIFY pgrst, 'reload schema';
