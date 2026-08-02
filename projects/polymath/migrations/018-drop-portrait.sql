-- Drop the Portrait — prototype slice, never surfaced past the masthead
-- icon, killed per its own two-week trial criteria (docs/PORTRAIT_SPEC.md,
-- now removed). See migrations/017-portrait.sql for the tables this undoes.

DROP TABLE IF EXISTS portrait_reckonings;
DROP TABLE IF EXISTS portrait_predictions;
DROP TABLE IF EXISTS portrait_snapshots;
