-- Migration: a dismissal is not an answer
-- Created: 2026-09-15
--
-- `dismiss-spark` wrote `answered_at` -- the same field `respond` writes.
-- So "not interested" and "here is my answer" were the same row state, and
-- the app could not tell them apart afterwards. Live: 36 sparks, 4 marked
-- answered, and 3 of those 4 had no `response_memory_id` because they were
-- dismissals. One real answer, recorded as four.
--
-- That is not just bad reporting. The draft prompt few-shots on "questions
-- that got a real voice answer" to learn what lands with this person, so
-- every dismissal was being learned from as a success -- the app teaching
-- itself that the questions people wave away are the good ones.

ALTER TABLE sparks ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- Repair the history: an answered spark with no response memory was dismissed.
-- (A real answer always writes the memory first and only then stamps the
-- spark, so answered-with-no-memory cannot happen on the respond path.)
UPDATE sparks
   SET dismissed_at = answered_at,
       answered_at  = NULL
 WHERE answered_at IS NOT NULL
   AND response_memory_id IS NULL;

COMMENT ON COLUMN sparks.dismissed_at IS 'Waved away without answering. Never counted as a response, and never used as an example of a question that worked.';
