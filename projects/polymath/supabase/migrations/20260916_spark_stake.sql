-- The stake a question shipped behind.
--
-- A binary ("X, or Y?") is banned by shape and exempted only when the stake
-- names two different outcomes -- so when a binary leaks, the stake IS the
-- diagnosis. One leaked live ("Does Aperture pull the raw thoughts straight
-- from your notes, or wait until they are finished?") and the row carried
-- nothing to explain why it passed, because the stake was computed, used by
-- the gates, and thrown away.
--
-- Nullable: every row written before this exists has no stake, and a bake is
-- never worth failing over a diagnostic field (the writers drop it on 42703
-- until this is applied).
ALTER TABLE sparks ADD COLUMN IF NOT EXISTS stake text;

COMMENT ON COLUMN sparks.stake IS
  'What the user would do differently depending on the answer. Evidence for the offersAChoice/stakeSplits gate pair.';
