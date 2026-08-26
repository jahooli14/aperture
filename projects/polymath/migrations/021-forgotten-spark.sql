-- 021-forgotten-spark.sql
--
-- Adds the 'forgotten' spark type (see SPEC.md, and the "worth a look"
-- discussion): the last branch of the stale router.
--
-- A stale project is one of four things, and the rest of the system already
-- handles three of them:
--   - stale + recent fragments        -> a morph proposal
--   - stale + a shared recurring joint -> a composite proposal
--   - stale + drifted + silent         -> harvested quietly by drift-decay
--   - stale + nothing at all           -> nobody was offering it back
--
-- That last bucket is what this covers. It's deliberately last: a question
-- is the weakest thing the app can offer, because it asks the user to supply
-- the information rather than supplying any. So it only ever fires for a
-- project the corpus has gone completely quiet about -- if there IS material,
-- the morph/composite proposals outrank the whole spark tier anyway.

ALTER TABLE sparks DROP CONSTRAINT IF EXISTS sparks_type_check;

ALTER TABLE sparks ADD CONSTRAINT sparks_type_check CHECK (
  type IN (
    'noticing',
    'transferred_constraint',
    'unfinished_thought',
    'contradiction',
    'scale_jump',
    'material_fact',
    'outside_reach',
    'forgotten'
  )
);

-- The per-project cooldown for this type is derived from the sparks table
-- itself (don't re-offer a project we offered recently), so this index keeps
-- that lookup cheap rather than adding a column to projects.
CREATE INDEX IF NOT EXISTS idx_sparks_forgotten_project
  ON sparks(user_id, project_id, created_at DESC) WHERE type = 'forgotten';

NOTIFY pgrst, 'reload schema';
