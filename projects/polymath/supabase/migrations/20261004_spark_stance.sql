-- How they reacted to a take: a tap (yes / no / sort of), with or without words.
-- A bare tap leaves no memory, so this is the only record of it.
ALTER TABLE sparks ADD COLUMN IF NOT EXISTS stance text
  CHECK (stance IS NULL OR stance IN ('yes', 'no', 'sort_of'));
