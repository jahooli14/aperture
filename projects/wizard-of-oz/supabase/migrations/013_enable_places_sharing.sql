-- Enable places to be shared across shared accounts (same as photos)

-- Drop existing restrictive RLS policies on places table
DROP POLICY IF EXISTS "Users can view their own places" ON places;
DROP POLICY IF EXISTS "Users can insert their own places" ON places;
DROP POLICY IF EXISTS "Users can update their own places" ON places;
DROP POLICY IF EXISTS "Users can delete their own places" ON places;

-- Create new SELECT policy that includes shared access
CREATE POLICY "Users can view their own and shared places"
  ON places FOR SELECT
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

-- Users can still only insert places into their own account
CREATE POLICY "Users can insert their own places"
  ON places FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update places they own
CREATE POLICY "Users can update their own places"
  ON places FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete places they own
CREATE POLICY "Users can delete their own places"
  ON places FOR DELETE
  USING (auth.uid() = user_id);

-- Drop existing restrictive RLS policies on photo_places table
DROP POLICY IF EXISTS "Users can view photo_places for their photos" ON photo_places;
DROP POLICY IF EXISTS "Users can insert photo_places for their photos" ON photo_places;
DROP POLICY IF EXISTS "Users can delete photo_places for their photos" ON photo_places;

-- Create new SELECT policy that includes shared access
CREATE POLICY "Users can view photo_places for their and shared photos"
  ON photo_places FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND (
        photos.user_id = auth.uid()
        OR
        auth.uid() IN (
          SELECT shared_user_id FROM user_shares WHERE owner_user_id = photos.user_id
        )
        OR
        auth.uid() IN (
          SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
        )
      )
    )
  );

-- Users can still only link photos to places for their own photos
CREATE POLICY "Users can insert photo_places for their photos"
  ON photo_places FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND photos.user_id = auth.uid()
    )
  );

-- Users can still only unlink photos from places for their own photos
CREATE POLICY "Users can delete photo_places for their photos"
  ON photo_places FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM photos
      WHERE photos.id = photo_places.photo_id
      AND photos.user_id = auth.uid()
    )
  );

-- Update place_visits RLS to support shared access
DROP POLICY IF EXISTS "Users can view their own place visits" ON place_visits;
DROP POLICY IF EXISTS "Users can insert their own place visits" ON place_visits;
DROP POLICY IF EXISTS "Users can update their own place visits" ON place_visits;
DROP POLICY IF EXISTS "Users can delete their own place visits" ON place_visits;

-- Users can view place visits for places they have access to
-- But they can only view visits from their own account
CREATE POLICY "Users can view their own place visits"
  ON place_visits FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert visits into their own account
CREATE POLICY "Users can insert their own place visits"
  ON place_visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own visits
CREATE POLICY "Users can update their own place visits"
  ON place_visits FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own visits
CREATE POLICY "Users can delete their own place visits"
  ON place_visits FOR DELETE
  USING (auth.uid() = user_id);

-- Recreate the places_with_stats view to support shared access
DROP VIEW places_with_stats;

CREATE VIEW places_with_stats AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.description,
  p.latitude,
  p.longitude,
  p.address,
  p.created_at,
  p.updated_at,
  -- First visit date: use place_visits if available, otherwise use photo dates
  COALESCE(MIN(pv.visit_date), MIN(photos.upload_date))::DATE as first_visit_date,
  -- Count photos linked to this place
  COUNT(DISTINCT CASE WHEN pp.photo_id IS NOT NULL THEN pp.photo_id END) as photo_count,
  -- Count visits to this place
  COUNT(DISTINCT pv.id) as visit_count,
  -- Array of all visit dates
  ARRAY_AGG(DISTINCT pv.visit_date ORDER BY pv.visit_date) FILTER (WHERE pv.visit_date IS NOT NULL) as visit_dates
FROM places p
LEFT JOIN place_visits pv ON p.id = pv.place_id AND pv.user_id = p.user_id
LEFT JOIN photo_places pp ON p.id = pp.place_id
LEFT JOIN photos ON pp.photo_id = photos.id AND photos.user_id = p.user_id
WHERE
  p.user_id = auth.uid()
  OR
  p.user_id IN (
    -- Places from accounts this user has joined
    SELECT owner_user_id FROM user_shares WHERE shared_user_id = auth.uid()
  )
  OR
  auth.uid() IN (
    -- Places from accounts joined by this user
    SELECT shared_user_id FROM user_shares WHERE owner_user_id = p.user_id
  )
GROUP BY p.id, p.user_id, p.name, p.description, p.latitude, p.longitude, p.address, p.created_at, p.updated_at;

ALTER VIEW places_with_stats SET (security_invoker = true);

-- Comment explaining the shared access system
COMMENT ON TABLE places IS 'Stores special locations visited with baby. Places are shared bidirectionally with connected accounts through user_shares.';
