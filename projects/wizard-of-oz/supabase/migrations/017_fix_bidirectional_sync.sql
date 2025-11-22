-- Fix bidirectional sync for ALL tables
-- Ensures Account Owners can see data created by Shared Users, and vice versa.

-- 1. PHOTOS
DROP POLICY IF EXISTS "Users can view their own and shared photos" ON photos;
CREATE POLICY "Users can view their own and shared photos"
  ON photos FOR SELECT
  USING (
    auth.uid() = user_id -- Own photos
    OR
    -- I am Shared User, viewing Owner's photos
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = user_id 
      AND shared_user_id = auth.uid()
    )
    OR
    -- I am Owner, viewing Shared User's photos
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = auth.uid() 
      AND shared_user_id = user_id
    )
  );

-- 2. PLACES
DROP POLICY IF EXISTS "Users can view their own and shared places" ON places;
CREATE POLICY "Users can view their own and shared places"
  ON places FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = user_id 
      AND shared_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = auth.uid() 
      AND shared_user_id = user_id
    )
  );

-- 3. PLACE VISITS
DROP POLICY IF EXISTS "Users can view their own and shared place visits" ON place_visits;
CREATE POLICY "Users can view their own and shared place visits"
  ON place_visits FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = user_id 
      AND shared_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = auth.uid() 
      AND shared_user_id = user_id
    )
  );

-- 4. MILESTONE ACHIEVEMENTS
DROP POLICY IF EXISTS "Users can view their own and shared milestone achievements" ON milestone_achievements;
CREATE POLICY "Users can view their own and shared milestone achievements"
  ON milestone_achievements FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = user_id 
      AND shared_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_shares 
      WHERE owner_user_id = auth.uid() 
      AND shared_user_id = user_id
    )
  );

-- 5. PHOTO PLACES (Link table)
DROP POLICY IF EXISTS "Users can view photo_places for their and shared photos" ON photo_places;
CREATE POLICY "Users can view photo_places for their and shared photos"
  ON photo_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND (
        photos.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM user_shares 
          WHERE owner_user_id = photos.user_id 
          AND shared_user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM user_shares 
          WHERE owner_user_id = auth.uid() 
          AND shared_user_id = photos.user_id
        )
      )
    )
  );

-- Comments
COMMENT ON POLICY "Users can view their own and shared photos" ON photos IS 'Bidirectional sharing: Owner <-> Shared User';
COMMENT ON POLICY "Users can view their own and shared places" ON places IS 'Bidirectional sharing: Owner <-> Shared User';
COMMENT ON POLICY "Users can view their own and shared place visits" ON place_visits IS 'Bidirectional sharing: Owner <-> Shared User';
COMMENT ON POLICY "Users can view their own and shared milestone achievements" ON milestone_achievements IS 'Bidirectional sharing: Owner <-> Shared User';
