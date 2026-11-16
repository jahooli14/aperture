-- The picture of the person (api/_lib/portrait.ts): the lines they keep
-- coming back to, each with the rows that show it. Rebuilt nightly.
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS portrait jsonb;
