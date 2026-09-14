-- Migration: clear embeddings written before the resonance verdict existed
-- Created: 2026-09-13
--
-- 20260907_reading_resonance_and_gist.sql documented the rule -- only a
-- "good" verdict earns an embedding, "not for me" is excluded permanently,
-- an un-verdicted RSS item counts for nothing -- but three of the four
-- code paths that write reading_queue.embedding never checked it. They
-- embedded on save and on extraction, before any verdict existed. Fixed
-- in api/reading.ts (generateArticleEmbeddingAndConnect now checks
-- isCorpusEligible before writing), but that only stops new writes.
--
-- This clears the embeddings that already leaked in under the old
-- behaviour, so match_reading and every semantic-search caller
-- (connections.ts, brainstorm.ts, the mull channel) stop treating
-- unread feed noise and rejected articles as real corpus.
-- read_at is part of the rule: an un-verdicted feed item the user actually
-- opened IS corpus, so its embedding stays. Only the never-opened backlog
-- and explicit rejections are cleared.
UPDATE reading_queue
SET embedding = NULL
WHERE embedding IS NOT NULL
  AND (
    resonance = 'not_for_me'
    OR (resonance IS NULL AND tags @> ARRAY['rss']::text[] AND read_at IS NULL)
  );
