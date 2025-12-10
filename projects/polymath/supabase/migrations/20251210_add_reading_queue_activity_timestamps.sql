-- Add last_active_at and inbox_entry_at to reading_queue for rotting mechanic

ALTER TABLE reading_queue
ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN inbox_entry_at TIMESTAMPTZ DEFAULT now();

-- Update existing entries to set last_active_at and inbox_entry_at to their created_at value
UPDATE reading_queue
SET
  last_active_at = created_at,
  inbox_entry_at = created_at
WHERE
  last_active_at IS NULL OR inbox_entry_at IS NULL;

-- Create a function to update last_active_at on read
CREATE OR REPLACE FUNCTION update_article_last_active_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger that calls the function before an update on reading_queue
-- This trigger will be refined later to only fire on actual reading activity.
-- For now, it's a placeholder.
-- DROP TRIGGER IF EXISTS set_article_last_active_at ON reading_queue;
-- CREATE TRIGGER set_article_last_active_at
-- BEFORE UPDATE ON reading_queue
-- FOR EACH ROW EXECUTE FUNCTION update_article_last_active_at();
