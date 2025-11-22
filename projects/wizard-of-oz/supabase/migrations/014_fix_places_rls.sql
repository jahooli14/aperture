-- Fix the RLS policy for shared places to correctly show places from accounts the user has joined

-- Drop the existing incorrect SELECT policy
DROP POLICY IF EXISTS "Users can view their own and shared places" ON places;

-- Create corrected SELECT policy that properly includes shared access
CREATE POLICY "Users can view their own and shared places"
  ON places FOR SELECT
  USING (
    -- Users can see their own places
    auth.uid() = user_id
    OR
    -- Users can see places from people who have joined their account
    auth.uid() IN (
      SELECT shared_user_id FROM user_shares WHERE owner_user_id = user_id
    )
    OR
    -- Users can see places from accounts they have joined
    -- FIX: Check if the place's owner (user_id) is someone I have joined
    user_id IN (
      SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view their own and shared places" ON places IS
  'Allows users to view: (1) their own places, (2) places from users who joined their account, (3) places from accounts they joined';
