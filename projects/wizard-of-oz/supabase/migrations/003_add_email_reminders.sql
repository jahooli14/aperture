-- Add email reminder settings to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS reminder_email TEXT,
ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN DEFAULT false;

-- Add comment to document the fields
COMMENT ON COLUMN user_settings.reminder_email IS 'Email address for daily photo reminders';
COMMENT ON COLUMN user_settings.reminders_enabled IS 'Whether user has opted into daily email reminders';

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_user_settings_reminders
ON user_settings(reminders_enabled, timezone, reminder_time)
WHERE reminders_enabled = true;
