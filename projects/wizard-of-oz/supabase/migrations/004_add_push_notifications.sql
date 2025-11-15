-- Add push notification subscription storage to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS push_subscription JSONB;

-- Add index for faster lookups when sending push notifications
CREATE INDEX IF NOT EXISTS idx_user_settings_push_subscription
ON user_settings ((push_subscription IS NOT NULL))
WHERE push_subscription IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN user_settings.push_subscription IS 'Web Push API subscription object for sending push notifications. Contains endpoint, keys, etc.';
