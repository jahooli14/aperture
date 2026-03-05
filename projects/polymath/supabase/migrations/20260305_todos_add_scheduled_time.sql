-- Add scheduled_time to todos
-- Stores a specific time of day for a task (HH:mm, 24h format)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
