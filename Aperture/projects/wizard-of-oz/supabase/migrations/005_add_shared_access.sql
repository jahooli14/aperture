-- Add invite code to user_settings
ALTER TABLE user_settings ADD COLUMN invite_code TEXT;

-- Create unique index on invite_code (only non-null values must be unique)
CREATE UNIQUE INDEX idx_invite_code ON user_settings(invite_code) WHERE invite_code IS NOT NULL;

-- Create user_shares table to track who shares access with whom
CREATE TABLE user_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id, shared_user_id)
);

-- Add RLS policies for user_shares
ALTER TABLE user_shares ENABLE ROW LEVEL SECURITY;

-- Users can see shares where they are either owner or shared user
CREATE POLICY "Users can view their shares"
  ON user_shares FOR SELECT
  USING (auth.uid() = owner_user_id OR auth.uid() = shared_user_id);

-- Users can create shares for their own account
CREATE POLICY "Users can create shares for themselves"
  ON user_shares FOR INSERT
  WITH CHECK (auth.uid() = shared_user_id);

-- Users can delete shares they created (when they joined someone's account)
CREATE POLICY "Users can delete their own shares"
  ON user_shares FOR DELETE
  USING (auth.uid() = shared_user_id);

-- Add index for faster lookups
CREATE INDEX idx_user_shares_owner ON user_shares(owner_user_id);
CREATE INDEX idx_user_shares_shared ON user_shares(shared_user_id);

-- Update photos RLS policy to include shared access
-- First, drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own photos" ON photos;

-- Create new SELECT policy that includes shared access
CREATE POLICY "Users can view their own and shared photos"
  ON photos FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    auth.uid() IN (
      -- Users who have joined this user's account
      SELECT shared_user_id FROM user_shares WHERE owner_user_id = user_id
    )
    OR
    auth.uid() IN (
      -- Users whose account this user has joined
      SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
    )
  );

-- Comment explaining the system
COMMENT ON COLUMN user_settings.invite_code IS 'Unique 6-digit code for inviting partners to share photo access';
COMMENT ON TABLE user_shares IS 'Tracks which users share photo library access. Bidirectional - if A shares with B, both see each others photos';
