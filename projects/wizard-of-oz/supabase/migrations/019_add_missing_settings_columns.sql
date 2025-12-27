-- Add missing columns to user_settings that are expected by the application
-- These columns track whether the user has been prompted for join code and completed onboarding

-- Add join_code_prompted column (defaults to false for existing users)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS join_code_prompted BOOLEAN NOT NULL DEFAULT false;

-- Add onboarding_completed column (defaults to false for existing users)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- Add comments
COMMENT ON COLUMN user_settings.join_code_prompted IS 'Whether the user has been shown the join code prompt on first login';
COMMENT ON COLUMN user_settings.onboarding_completed IS 'Whether the user has completed the onboarding flow';
