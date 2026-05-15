-- Customisable "suggest a project" brief.
--
-- Adds a free-text column to user_settings so the user can override the
-- default editorial brief used by the fast-path Flash prompt on the home
-- "suggest a project" button. NULL means "use the built-in default" — the
-- server falls back to DEFAULT_IDEA_BRIEF from api/_lib/project-ideas/
-- default-prompt.ts when the column is null or empty.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS idea_prompt TEXT;
