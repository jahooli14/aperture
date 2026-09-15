-- Migration: only a "this was good" verdict keeps an article's embedding
-- Created: 2026-09-13 (rule tightened 2026-09-15)
--
-- The rule is the one in reading-corpus.ts: an article influences what the
-- app says back to you only if you got to the end and voted "This was
-- good". Three of the four code paths that write reading_queue.embedding
-- never checked any of that -- they embedded on save and on extraction,
-- before a verdict could exist -- so the feed backlog sat in the vector
-- space as if it were corpus.
--
-- A looser version of this cleared only the never-opened rows, on the
-- theory that opening an article counted. It doesn't: two articles the
-- owner had archived without reading turned up as sources in a real
-- question. `read_at` isn't even a record of opening -- any path that sets
-- status to 'reading' stamps it, including the right-swipe that means
-- "put this in my list".
--
-- So: keep the embedding only where the verdict is 'good'. Everything else
-- loses it, and earns it back the moment it gets voted on.
UPDATE reading_queue
SET embedding = NULL
WHERE embedding IS NOT NULL
  AND (resonance IS DISTINCT FROM 'good');
