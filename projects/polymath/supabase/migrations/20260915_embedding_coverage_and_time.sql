-- Migration: every corpus object gets a vector, and every vector gets a date
-- Created: 2026-09-15
--
-- Two gaps and one missing dimension.
--
-- GAP 1 — joints had no embedding at all. joint-miner re-embedded every
-- existing joint from scratch on every run just to deduplicate against
-- them, which is a model call per joint per run for a value that never
-- changes. Worse, a joint is a corpus object -- "something you keep
-- saying" -- and nothing could search for one.
--
-- GAP 2 — list_items were only embedded once enrichment finished, so
-- anything unenriched was invisible to every search forever.
--
-- THE TIME DIMENSION. Deliberately NOT inside the vector: appending a date
-- to the text before embedding makes every note from the same month look
-- alike, which is false and actively harmful -- it drags unrelated
-- captures together by calendar rather than by meaning. Time belongs
-- beside the vector, combined at scoring time. What the vector needs is a
-- date of its OWN: when it was computed. Without that there is no way to
-- tell a vector built from the current text from one built from text that
-- has since been rewritten, and a stale vector is invisible rather than
-- wrong -- the worst failure mode this codebase keeps rediscovering.

ALTER TABLE joints ADD COLUMN IF NOT EXISTS embedding vector(768);

-- When the vector was computed, everywhere one is stored. A row whose
-- content is newer than its embedding is stale and needs rebuilding.
ALTER TABLE memories      ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
ALTER TABLE projects      ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
ALTER TABLE list_items    ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
ALTER TABLE reading_queue ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;
ALTER TABLE joints        ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- Existing vectors predate this column. Stamp them with something rather
-- than leaving NULL, or every one of them reads as "never embedded" and
-- the first coverage run rebuilds the entire corpus.
UPDATE memories      SET embedded_at = created_at WHERE embedding IS NOT NULL AND embedded_at IS NULL;
UPDATE projects      SET embedded_at = created_at WHERE embedding IS NOT NULL AND embedded_at IS NULL;
UPDATE list_items    SET embedded_at = created_at WHERE embedding IS NOT NULL AND embedded_at IS NULL;
UPDATE reading_queue SET embedded_at = created_at WHERE embedding IS NOT NULL AND embedded_at IS NULL;

COMMENT ON COLUMN memories.embedded_at IS 'When the embedding was computed. Content newer than this means the vector is stale.';
COMMENT ON COLUMN joints.embedding IS 'The joint''s own vector, so joint-miner stops re-embedding every joint on every run and a joint can be searched for.';
