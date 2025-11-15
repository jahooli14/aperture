-- Fix the places_with_stats view to properly filter by user
-- The original view was missing the user_id filter in the photo JOIN,
-- causing it to scan all photos in the database instead of just the user's photos

-- Drop the existing view
DROP VIEW IF EXISTS places_with_stats;

-- Recreate the view with the proper user filter
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
  MIN(photos.upload_date) as first_visit_date,
  COUNT(DISTINCT pp.photo_id) as photo_count,
  ARRAY_AGG(DISTINCT photos.upload_date ORDER BY photos.upload_date) as visit_dates
FROM places p
LEFT JOIN photo_places pp ON p.id = pp.place_id
LEFT JOIN photos ON pp.photo_id = photos.id AND photos.user_id = p.user_id
GROUP BY p.id, p.user_id, p.name, p.description, p.latitude, p.longitude, p.address, p.created_at, p.updated_at;

-- RLS for the view
ALTER VIEW places_with_stats SET (security_invoker = true);
