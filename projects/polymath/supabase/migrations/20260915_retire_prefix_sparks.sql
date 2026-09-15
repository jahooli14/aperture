-- Migration: retire every question baked before the corpus was repaired
-- Created: 2026-09-15
--
-- RUN AFTER the deploy carrying the echo fix.
--
-- The echo gate compares a new question against recent ones so the channel
-- does not ask the same thing twice. That is right, and it turned poisonous:
-- every question in the history was generated from a corpus where 53 of 75
-- notes were unprocessed and unfiled, and several were the specific bad
-- questions this week's work exists to stop producing.
--
-- Live evidence, from the first healthy run: four good drafts written, three
-- thrown away as echoes -- one of them for sharing the words "arsenal",
-- "winning" and "streak" with the football question that was itself the bug.
-- The channel was protecting its own mistakes from being corrected.
--
-- Marking them dismissed rather than deleting keeps the record of what was
-- asked, and `fetchRecentSparkTexts` now skips dismissed rows -- a question
-- waved away was never a conversation, so its vocabulary should not block
-- the next fourteen days of better ones.

UPDATE sparks
   SET dismissed_at = COALESCE(dismissed_at, now())
 WHERE type = 'mull'
   AND answered_at IS NULL
   AND created_at < now();
