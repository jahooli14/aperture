-- Fix places_with_stats view to support shared data
-- The original view restricted photos to same user_id as place, breaking sharing

DROP VIEW IF EXISTS places_with_stats;

CREATE VIEW places_with_stats AS
SELECT
  p.id,
  p.user_id,
  p.name,
  p.description,
  p.latitude,
  p.longitude,
  p.address,
  p.category,
  p.created_at,
  p.updated_at,
  MIN(photos.upload_date) as first_visit_date,
  COUNT(DISTINCT pp.photo_id) as photo_count,
  ARRAY_AGG(DISTINCT photos.upload_date ORDER BY photos.upload_date) FILTER (WHERE photos.upload_date IS NOT NULL) as visit_dates
FROM places p
LEFT JOIN photo_places pp ON p.id = pp.place_id
LEFT JOIN photos ON pp.photo_id = photos.id
-- Removed: AND photos.user_id = p.user_id (was breaking sharing)
GROUP BY p.id, p.user_id, p.name, p.description, p.latitude, p.longitude, p.address, p.category, p.created_at, p.updated_at;

-- RLS for the view - inherits from underlying tables
ALTER VIEW places_with_stats SET (security_invoker = true);

COMMENT ON VIEW places_with_stats IS 'Places with photo stats. Supports sharing via underlying RLS policies.';
