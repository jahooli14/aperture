-- Fix the RLS policy for shared milestones to correctly show milestones from accounts the user has joined

-- Drop the existing restrictive RLS policies
DROP POLICY IF EXISTS "Users can view their own milestone achievements" ON milestone_achievements;

-- Create new SELECT policy that includes shared access
CREATE POLICY "Users can view their own and shared milestone achievements"
  ON milestone_achievements FOR SELECT
  USING (
    -- Users can see their own milestones
    auth.uid() = user_id
    OR
    -- Users can see milestones from people who have joined their account
    auth.uid() IN (
      SELECT shared_user_id FROM user_shares WHERE owner_user_id = user_id
    )
    OR
    -- Users can see milestones from accounts they have joined
    user_id IN (
      SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
    )
  );

COMMENT ON POLICY "Users can view their own and shared milestone achievements" ON milestone_achievements IS
  'Allows users to view: (1) their own milestones, (2) milestones from users who joined their account, (3) milestones from accounts they joined';
