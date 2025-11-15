-- Fix the RLS policy for shared photos to correctly show photos from accounts the user has joined

-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view their own and shared photos" ON photos;

-- Create corrected SELECT policy that properly includes shared access
CREATE POLICY "Users can view their own and shared photos"
  ON photos FOR SELECT
  USING (
    -- Users can see their own photos
    auth.uid() = user_id
    OR
    -- Users can see photos from people who have joined their account
    auth.uid() IN (
      SELECT shared_user_id FROM user_shares WHERE owner_user_id = user_id
    )
    OR
    -- Users can see photos from accounts they have joined
    user_id IN (
      SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view their own and shared photos" ON photos IS
  'Allows users to view: (1) their own photos, (2) photos from users who joined their account, (3) photos from accounts they joined';
