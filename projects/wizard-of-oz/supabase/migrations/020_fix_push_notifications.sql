-- Fix push notifications: add push_enabled flag to separate from email reminders
-- Previously, the cron job required reminders_enabled=true AND push_subscription IS NOT NULL
-- But enabling push only set push_subscription, never reminders_enabled - so cron never found users!

-- Add push_enabled flag
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;

-- Add comment to document the field
COMMENT ON COLUMN user_settings.push_enabled IS 'Whether user has opted into push notifications for daily reminders';

-- Update the index to include push_enabled for efficient cron queries
DROP INDEX IF EXISTS idx_user_settings_push_subscription;
CREATE INDEX IF NOT EXISTS idx_user_settings_push_enabled
ON user_settings(push_enabled)
WHERE push_enabled = true AND push_subscription IS NOT NULL;

-- For users who already have a push_subscription but no push_enabled,
-- set push_enabled = true to enable their notifications retroactively
UPDATE user_settings
SET push_enabled = true
WHERE push_subscription IS NOT NULL AND push_enabled IS NOT true;
