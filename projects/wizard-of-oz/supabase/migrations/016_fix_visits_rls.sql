-- Fix the RLS policy for shared place visits to correctly show visits from accounts the user has joined

-- Drop the existing restrictive RLS policies
DROP POLICY IF EXISTS "Users can view their own place visits" ON place_visits;

-- Create new SELECT policy that includes shared access
CREATE POLICY "Users can view their own and shared place visits"
  ON place_visits FOR SELECT
  USING (
    -- Users can see their own visits
    auth.uid() = user_id
    OR
    -- Users can see visits from people who have joined their account
    auth.uid() IN (
      SELECT shared_user_id FROM user_shares WHERE owner_user_id = user_id
    )
    OR
    -- Users can see visits from accounts they have joined
    user_id IN (
      SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view their own and shared place visits" ON place_visits IS
  'Allows users to view: (1) their own visits, (2) visits from users who joined their account, (3) visits from accounts they joined';
