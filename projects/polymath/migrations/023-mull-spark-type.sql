-- 023-mull-spark-type.sql
--
-- Adds 'mull' to sparks_type_check.
--
-- This is migration 022's bug again, and for the same reason. The mull
-- rebuild replaced all nine rotating spark types with the single type
-- 'mull', and nothing taught the database about it — so every insert of a
-- baked question violated sparks_type_check and came back as a 500. In the
-- UI that reads "Couldn't reach the server", which is why it looked like a
-- network problem rather than a schema one.
--
-- It survived four days of debugging because `bake?explain=1` writes
-- nothing: the insert is the one step explain skips, so the trace showed a
-- question being written successfully every time.
--
-- The legacy values stay in the list. Nothing generates them anymore, but
-- rows of those types are real history sitting in the table, and a CHECK
-- constraint is validated against existing rows when it is added — dropping
-- the values would fail the ALTER, and deleting the rows to make it pass
-- would throw away the record of what the user was actually asked.

ALTER TABLE sparks DROP CONSTRAINT IF EXISTS sparks_type_check;

ALTER TABLE sparks ADD CONSTRAINT sparks_type_check CHECK (
  type IN (
    -- The only type written now.
    'mull',
    -- Historical only: the nine rotating types and the forgotten offer,
    -- all deleted from the codebase. Kept so existing rows stay legal.
    'noticing',
    'gap',
    'transferred_constraint',
    'unfinished_thought',
    'contradiction',
    'scale_jump',
    'material_fact',
    'outside_reach',
    'forgotten'
  )
);

NOTIFY pgrst, 'reload schema';
