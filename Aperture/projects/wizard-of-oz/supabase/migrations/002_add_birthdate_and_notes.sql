-- Add birthdate to user_settings
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS baby_birthdate DATE;

-- Add notes field to photos metadata
-- Note: metadata is already JSONB, so we don't need to alter the column
-- We'll just use metadata.note for storing the memory note

-- Add comment to document the metadata structure
COMMENT ON COLUMN photos.metadata IS 'JSONB field for extensible metadata. Current fields: { note: string (optional memory note) }';
