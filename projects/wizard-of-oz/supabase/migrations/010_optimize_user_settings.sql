-- Add missing index on user_settings for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Add invite_code column if it doesn't exist
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- Add comment
COMMENT ON COLUMN user_settings.invite_code IS 'Unique invite code for sharing access to this account';
