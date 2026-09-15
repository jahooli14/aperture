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
-- GAP 2 — list_items had no embedding column AT ALL. The migration adding
-- it (20251227) was written and never run, so every list-item embedding
-- write has been silently skipped ever since (maintainEmbeddings warns on
-- 42703 and moves on) and match_list_items has never returned a row. The
-- app-side enrichment gate on top of that was moot. Both are fixed here.
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

-- 20251227_add_list_item_embeddings.sql, which was never applied.
ALTER TABLE public.list_items ADD COLUMN IF NOT EXISTS embedding vector(768);
CREATE INDEX IF NOT EXISTS idx_list_items_embedding
  ON public.list_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

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
