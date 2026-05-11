-- Up Next shelf — a user-pinned queue between the priority project and the drawer.
--
-- Position is 1, 2, or 3 (NULL means not pinned). The partial unique index
-- prevents two projects from occupying the same slot for a user. Positions
-- are stable on remove (we don't shift), so the user's mental ordering
-- survives between sessions.
--
-- Priority cap dropped from 3 → 1 at the same time (enforced in the API,
-- not here — existing rows with is_priority=true are left untouched and
-- will only be visible in Keep Going one at a time via the selector).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS up_next_position SMALLINT
    CHECK (up_next_position IS NULL OR up_next_position BETWEEN 1 AND 3);

CREATE UNIQUE INDEX IF NOT EXISTS projects_user_up_next_position_unique
  ON projects (user_id, up_next_position)
  WHERE up_next_position IS NOT NULL;

CREATE INDEX IF NOT EXISTS projects_up_next_idx
  ON projects (user_id, up_next_position)
  WHERE up_next_position IS NOT NULL;
