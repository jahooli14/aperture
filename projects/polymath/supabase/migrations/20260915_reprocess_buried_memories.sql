-- Migration: un-bury the notes a schema bug threw away
-- Created: 2026-09-15
--
-- RUN THIS AFTER the deploy carrying the schemas.ts fix, not before.
-- Resetting the counter without the fix just burns the retries again.
--
-- `triage.project_id` was declared `z.string().optional()`. Optional means
-- "may be absent"; Gemini correctly returns `null` when a note belongs to no
-- project, and Zod rejected the whole response. The note then stayed
-- `processed = false` with no title, no themes, no memory_type, no triage
-- and -- worst -- no fragment, so it was attached to no project and invisible
-- to every timeline in the mull channel.
--
-- 53 of 75 memories. 44 on this one error. 42 of them had already burned all
-- five retries, so nothing would ever have tried them again. Eight months.
--
-- The cap itself was sound; what was missing was that a deterministic bug
-- burns five attempts as fast as five transient ones. processMemory now
-- clears the counter on success, so a row that failed for a reason since
-- fixed cannot be one bad day from being buried permanently.

UPDATE memories
   SET process_attempts = 0,
       error = NULL
 WHERE processed = false;
