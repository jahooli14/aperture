-- Migration: reading resonance verdict + cached article gist
-- Created: 2026-09-07
--
-- Two additions, both in service of one rule: an article only joins the
-- corpus when the user says it was worth reading.
--
-- 1. `resonance` — set by the two buttons at the end of the reader.
--    'good'        -> the article influences project ideas and everything
--                     else that reads the corpus.
--    'not_for_me'  -> permanently excluded, and never embedded.
--    NULL          -> undecided. RSS items sit here until read, which is
--                     why they no longer leak into the corpus by default.
--
-- 2. `metadata` — the reader caches the three-bullet gist here so the
--    Gemini call happens once per article, ever. The column was already
--    being written to by the (unused) analyze endpoint but never actually
--    existed; creating it makes that path safe too.

ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS resonance TEXT
  CHECK (resonance IS NULL OR resonance IN ('good', 'not_for_me'));

ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS resonance_at TIMESTAMPTZ;

ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE reading_queue
ADD COLUMN IF NOT EXISTS themes TEXT[];

-- Corpus readers ask "which of this user's articles resonated" constantly.
-- Partial index keeps it to the rows that matter.
CREATE INDEX IF NOT EXISTS idx_reading_queue_resonance
  ON reading_queue(user_id, resonance_at DESC)
  WHERE resonance = 'good';

COMMENT ON COLUMN reading_queue.resonance IS 'End-of-article verdict. good = feed it into the corpus; not_for_me = never. NULL = undecided.';
COMMENT ON COLUMN reading_queue.resonance_at IS 'When the verdict was given.';
COMMENT ON COLUMN reading_queue.metadata IS 'Free-form article metadata. metadata.gist holds the cached three-bullet summary shown at the top of the reader.';
COMMENT ON COLUMN reading_queue.themes IS 'Topics extracted alongside the gist. Used as corpus context for articles marked good.';
